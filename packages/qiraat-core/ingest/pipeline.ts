import * as fs from 'fs'
import * as path from 'path'
import { DbAdapter } from './dbAdapter'
import { reanchorWord, type AyahWordToken, type ReanchorMatch } from './reanchor'
import { expandAlBaqoon, isValidAuthorityId } from './expand'
import { classifyRuling, splitMultiWordRuleSpan, DB_CATEGORY_CODES } from './classify'
import { planMerges, type IngestItem, type PlannedMergeItem } from './mergePlan'

export interface PipelineOptions {
  pages: number[]
  target: 'staging' | 'prod'
  dryRun: boolean
  inboxDir: string
  repoFixturesDir: string
}

export interface PageProcessResult {
  pageNumber: number
  status: 'done' | 'done-empty' | 'flagged' | 'missing'
  variantCount: number
  ruleCount: number
  corroboratedCount: number
  gapFilledCount: number
  conflictCount: number
  unmatchedCount: number
  flags: string[]
  plannedMerges?: PlannedMergeItem[]
}

export class IngestionPipeline {
  private db: DbAdapter
  private ayahTokensCache = new Map<string, AyahWordToken[]>()

  constructor(private options: PipelineOptions) {
    this.db = new DbAdapter(options.target)
  }

  private async getAyahTokens(surah: number, startAyah: number, endAyah?: number): Promise<AyahWordToken[]> {
    const lastAyah = endAyah && endAyah > startAyah ? endAyah : startAyah
    const key = `${surah}:${startAyah}-${lastAyah}`
    if (this.ayahTokensCache.has(key)) {
      return this.ayahTokensCache.get(key)!
    }
    const tokens = lastAyah > startAyah
      ? await this.db.fetchAyahTokensSpan(surah, startAyah, lastAyah)
      : await this.db.fetchAyahTokens(surah, startAyah)
    this.ayahTokensCache.set(key, tokens)
    return tokens
  }

  /**
   * Reads a page fixture file from inbox or fallback
   */
  private readPageFixture(
    page: number,
    subfolder: 'pages' | 'rulings'
  ): { status: 'found' | 'empty' | 'missing'; data: any[] } {
    const pad = String(page).padStart(3, '0')
    const fileName = `page-${pad}.json`

    // Check inbox first
    const inboxPath = path.join(this.options.inboxDir, subfolder, fileName)
    let filePath = inboxPath

    if (!fs.existsSync(filePath)) {
      // Check repo fixtures fallback
      const repoPath = path.join(this.options.repoFixturesDir, subfolder, fileName)
      if (fs.existsSync(repoPath)) {
        filePath = repoPath
      } else {
        return { status: 'missing', data: [] }
      }
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { status: 'empty', data: [] }
      }
      return { status: 'found', data: parsed }
    } catch {
      return { status: 'missing', data: [] }
    }
  }

  /**
   * Processes a single Mushaf page
   */
  async processPage(page: number): Promise<PageProcessResult> {
    const variantsRes = this.readPageFixture(page, 'pages')
    const rulingsRes = this.readPageFixture(page, 'rulings')

    if (variantsRes.status === 'missing' && rulingsRes.status === 'missing') {
      return {
        pageNumber: page,
        status: 'missing',
        variantCount: 0,
        ruleCount: 0,
        corroboratedCount: 0,
        gapFilledCount: 0,
        conflictCount: 0,
        unmatchedCount: 0,
        flags: [`Page ${page} files missing from inbox`],
      }
    }

    if (variantsRes.status === 'empty' && (rulingsRes.status === 'empty' || rulingsRes.status === 'missing')) {
      if (!this.options.dryRun) {
        await this.db.updatePageStatus(page, 'done-empty', { notes: 'No differences in ten readings' })
      }
      return {
        pageNumber: page,
        status: 'done-empty',
        variantCount: 0,
        ruleCount: 0,
        corroboratedCount: 0,
        gapFilledCount: 0,
        conflictCount: 0,
        unmatchedCount: 0,
        flags: [],
      }
    }

    const flags: string[] = []
    const ingestItems: IngestItem[] = []
    let unmatchedCount = 0

    // 1. Process Farsh Variants
    for (const v of variantsRes.data) {
      const surah = Number(v.surah)
      const ayah = Number(v.ayah)
      const targetText = v.hafsText || v.baseText || v.variantText
      const ayahTokens = await this.getAyahTokens(surah, ayah)

      const anchorMatches = reanchorWord(
        targetText,
        ayahTokens,
        v.startToken ?? v.sourceTokenRaw,
        v.description ?? v.notes
      )

      for (const match of anchorMatches) {
        if (match.confidence === 'unmatched') {
          unmatchedCount++
          flags.push(`Unmatched variant ${v.id} (Surah ${surah}:${ayah} "${targetText}")`)
          continue
        }

        // Authority resolution
        const readingIds: string[] = Array.isArray(v.readingIds) ? v.readingIds : []
        for (const rid of readingIds) {
          if (!isValidAuthorityId(rid)) {
            flags.push(`Invalid authority ID "${rid}" in variant ${v.id}`)
            continue
          }

          ingestItems.push({
            sourceId: v.id,
            surah,
            ayah,
            startWord: match.startWord,
            endWord: match.endWord,
            narratorId: rid,
            kind: 'variant',
            readingText: v.variantText,
            sourceTokenRaw: match.sourceTokenRaw,
            pdfPage: v.sources?.[0]?.pdfPage,
            sourceReference: v.sources?.[0]?.sourceReference,
          })
        }
      }
    }

    // 2. Process Usul Rulings
    for (const r of rulingsRes.data) {
      const surah = Number(r.surah)
      const ayah = Number(r.ayah)
      const endAyah = r.endAyah ? Number(r.endAyah) : ayah
      const targetText = r.baseText || r.text
      const ayahTokens = await this.getAyahTokens(surah, ayah, endAyah)

      const anchorMatches = reanchorWord(
        targetText,
        ayahTokens,
        r.startToken ?? r.sourceTokenRaw,
        r.notes ?? r.categoryAr
      )

      for (const match of anchorMatches) {
        if (match.confidence === 'unmatched') {
          unmatchedCount++
          flags.push(`Unmatched ruling ${r.id} (Surah ${surah}:${ayah} "${targetText}")`)
          continue
        }

        // Classify ruling category
        const classified = classifyRuling(r.category ?? r.categoryAr)
        if (classified.isAmbiguous) {
          flags.push(`Ambiguous ruling category "${r.category ?? r.categoryAr}" in ruling ${r.id}`)
        }

        // Multi-word span splitting (Option 1 / Decision Q2)
        const splitSpans = splitMultiWordRuleSpan(match.startWord, match.endWord)

        // Read readings
        const readings: any[] = Array.isArray(r.readings) ? r.readings : []
        for (const span of splitSpans) {
          for (const rd of readings) {
            const rid = rd.readingId || rd.authorityId
            if (!rid || !isValidAuthorityId(rid)) {
              flags.push(`Invalid reading ID "${rid}" in ruling ${r.id}`)
              continue
            }

            ingestItems.push({
              sourceId: `${r.id}-w${span.startWord}`,
              surah,
              ayah,
              startWord: span.startWord,
              endWord: span.endWord,
              narratorId: rid,
              kind: 'ruling',
              categoryCode: classified.canonicalCategory,
              actionAr: rd.action ?? r.text,
              sourceTokenRaw: match.sourceTokenRaw,
              pdfPage: r.pdfPage,
              sourceReference: r.sourceReference,
            })
          }
        }
      }
    }

    // 3. Merge Planning against DB
    const existingDb = await this.db.fetchExistingPageRecords(page)
    const mergeResult = planMerges(ingestItems, existingDb)

    // 4. Staging Import (if not dry run)
    if (!this.options.dryRun) {
      const sqlStatements: string[] = []

      for (const item of mergeResult.plan) {
        if (item.action === 'GAP_FILL' && item.newItem) {
          const it = item.newItem
          const locusId = `loc-${String(it.surah).padStart(3, '0')}-${String(it.ayah).padStart(3, '0')}-${String(it.startWord).padStart(3, '0')}-${String(it.endWord).padStart(3, '0')}`
          const entryId = `ent-${it.sourceId}-${it.narratorId}`

          const readingText = (it.readingText ?? '').replace(/'/g, "''")
          const actionAr = (it.actionAr ?? '').replace(/'/g, "''")
          const catCode = it.categoryCode ?? 'OTHER'
          const isHafs = it.narratorId === 'Q05-R02'
          const reviewStatus = isHafs ? 'flagged' : 'unreviewed'

          sqlStatements.push(`
            INSERT INTO qiraat_loci (id, page_id, surah_number, start_ayah, start_word, end_ayah, end_word, base_text, base_text_normalized, source_token_raw, pdf_page)
            SELECT 
              '${locusId}', p.id, ${it.surah}, ${it.ayah}, ${it.startWord}, ${it.ayah}, ${it.endWord},
              COALESCE((SELECT text_uthmani FROM quran_words WHERE surah=${it.surah} AND ayah=${it.ayah} AND word_position=${it.startWord}), '${readingText || actionAr}'),
              COALESCE((SELECT text_uthmani FROM quran_words WHERE surah=${it.surah} AND ayah=${it.ayah} AND word_position=${it.startWord}), '${readingText || actionAr}'),
              '${it.sourceTokenRaw ?? ''}', ${it.pdfPage ?? 'NULL'}
            FROM qiraat_pages p WHERE p.mushaf_page_number = ${page}
            ON CONFLICT (id) DO UPDATE SET pdf_page = EXCLUDED.pdf_page
          `)

          sqlStatements.push(`
            INSERT INTO qiraat_entries (id, locus_id, page_id, kind, entry_order, source_token_raw, pdf_page, is_conflict, review_status)
            SELECT 
              '${entryId}', '${locusId}', p.id, '${it.kind}', 
              COALESCE((SELECT MAX(entry_order) FROM qiraat_entries WHERE locus_id = '${locusId}' AND kind = '${it.kind}'), 0) + 1,
              '${it.sourceTokenRaw ?? ''}', ${it.pdfPage ?? 'NULL'}, false, '${reviewStatus}'
            FROM qiraat_pages p WHERE p.mushaf_page_number = ${page}
            ON CONFLICT (id) DO UPDATE SET review_status = '${reviewStatus}'
          `)

          if (it.kind === 'variant') {
            sqlStatements.push(`
              INSERT INTO qiraat_variant_details (entry_id, reading_text, reading_text_normalized, variant_type, is_baseline_reading)
              VALUES ('${entryId}', '${readingText}', '${readingText}', 'other', false)
              ON CONFLICT (entry_id) DO NOTHING
            `)
          } else if (DB_CATEGORY_CODES.has(catCode)) {
            sqlStatements.push(`
              INSERT INTO qiraat_ruling_details (entry_id, category_code, text_ar)
              VALUES ('${entryId}', '${catCode}', '${actionAr}')
              ON CONFLICT (entry_id) DO NOTHING
            `)
          }

          sqlStatements.push(`
            INSERT INTO qiraat_entry_authorities (entry_id, authority_id, action_ar, is_default, wajh_order)
            VALUES ('${entryId}', '${it.narratorId}', '${actionAr || readingText}', true, 1)
            ON CONFLICT DO NOTHING
          `)

          sqlStatements.push(`
            INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, wajh_order, is_default)
            VALUES ('${entryId}', '${it.narratorId}', '${actionAr || readingText}', 1, true)
            ON CONFLICT DO NOTHING
          `)

          sqlStatements.push(`
            INSERT INTO qiraat_entry_sources (entry_id, source_document_id, pdf_page, source_reference)
            VALUES ('${entryId}', 'SRC-BOOK-27159', ${it.pdfPage ?? 'NULL'}, '${(it.sourceReference ?? '').replace(/'/g, "''")}')
            ON CONFLICT DO NOTHING
          `)

          if (isHafs) {
            sqlStatements.push(`
              INSERT INTO qiraat_qa_flags (page_id, locus_id, entry_id, severity, flag_type, original_text, issue_ar, status)
              SELECT p.id, '${locusId}', '${entryId}', 'info', 'D8_HAFS_KEPT', '${(it.readingText ?? it.actionAr ?? '').replace(/'/g, "''")}', 'حفص مدرج في المصدر الجديد مع رواة آخرين - تم تعليمه للمراجعة وفق القاعدة D8', 'open'
              FROM qiraat_pages p 
              WHERE p.mushaf_page_number = ${page}
                AND NOT EXISTS (SELECT 1 FROM qiraat_qa_flags WHERE entry_id = '${entryId}' AND flag_type = 'D8_HAFS_KEPT')
            `)
          }
        } else if (item.action === 'CONFLICT' && item.newItem) {
          const it = item.newItem
          const locusId = item.existingRecord?.locusId || `loc-${String(it.surah).padStart(3, '0')}-${String(it.ayah).padStart(3, '0')}-${String(it.startWord).padStart(3, '0')}-${String(it.endWord).padStart(3, '0')}`
          const entryId = `ent-conflict-${it.sourceId}-${it.narratorId}`
          const diffJson = JSON.stringify(item.conflictDiff ?? {}).replace(/'/g, "''")
          const readingText = (it.readingText ?? '').replace(/'/g, "''")
          const actionAr = (it.actionAr ?? '').replace(/'/g, "''")
          const catCode = it.categoryCode ?? 'OTHER'

          sqlStatements.push(`
            INSERT INTO qiraat_loci (id, page_id, surah_number, start_ayah, start_word, end_ayah, end_word, base_text, base_text_normalized, source_token_raw, pdf_page)
            SELECT 
              '${locusId}', p.id, ${it.surah}, ${it.ayah}, ${it.startWord}, ${it.ayah}, ${it.endWord},
              COALESCE((SELECT text_uthmani FROM quran_words WHERE surah=${it.surah} AND ayah=${it.ayah} AND word_position=${it.startWord}), '${readingText || actionAr}'),
              COALESCE((SELECT text_uthmani FROM quran_words WHERE surah=${it.surah} AND ayah=${it.ayah} AND word_position=${it.startWord}), '${readingText || actionAr}'),
              '${it.sourceTokenRaw ?? ''}', ${it.pdfPage ?? 'NULL'}
            FROM qiraat_pages p WHERE p.mushaf_page_number = ${page}
            ON CONFLICT (id) DO UPDATE SET pdf_page = EXCLUDED.pdf_page
          `)

          sqlStatements.push(`
            INSERT INTO qiraat_entries (id, locus_id, page_id, kind, entry_order, source_token_raw, pdf_page, is_conflict, conflict_diff, review_status)
            SELECT 
              '${entryId}', '${locusId}', p.id, '${it.kind}', 
              COALESCE((SELECT MAX(entry_order) FROM qiraat_entries WHERE locus_id = '${locusId}' AND kind = '${it.kind}'), 0) + 1,
              '${it.sourceTokenRaw ?? ''}', ${it.pdfPage ?? 'NULL'}, true, '${diffJson}'::jsonb, 'flagged'
            FROM qiraat_pages p WHERE p.mushaf_page_number = ${page}
            ON CONFLICT (id) DO UPDATE SET conflict_diff = EXCLUDED.conflict_diff
          `)

          if (it.kind === 'variant') {
            sqlStatements.push(`
              INSERT INTO qiraat_variant_details (entry_id, reading_text, reading_text_normalized, variant_type, is_baseline_reading)
              VALUES ('${entryId}', '${readingText}', '${readingText}', 'other', false)
              ON CONFLICT (entry_id) DO NOTHING
            `)
          } else if (DB_CATEGORY_CODES.has(catCode)) {
            sqlStatements.push(`
              INSERT INTO qiraat_ruling_details (entry_id, category_code, text_ar)
              VALUES ('${entryId}', '${catCode}', '${actionAr}')
              ON CONFLICT (entry_id) DO NOTHING
            `)
          }

          sqlStatements.push(`
            INSERT INTO qiraat_entry_authorities (entry_id, authority_id, action_ar, is_default, wajh_order)
            VALUES ('${entryId}', '${it.narratorId}', '${actionAr || readingText}', true, 1)
            ON CONFLICT DO NOTHING
          `)

          sqlStatements.push(`
            INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, wajh_order, is_default)
            VALUES ('${entryId}', '${it.narratorId}', '${actionAr || readingText}', 1, true)
            ON CONFLICT DO NOTHING
          `)

          sqlStatements.push(`
            INSERT INTO qiraat_entry_sources (entry_id, source_document_id, pdf_page, source_reference)
            VALUES ('${entryId}', 'SRC-BOOK-27159', ${it.pdfPage ?? 'NULL'}, '${(it.sourceReference ?? '').replace(/'/g, "''")}')
            ON CONFLICT DO NOTHING
          `)

          sqlStatements.push(`
            INSERT INTO qiraat_qa_flags (page_id, locus_id, entry_id, severity, flag_type, original_text, issue_ar, status)
            SELECT p.id, '${locusId}', '${entryId}', 'warning', 'SOURCE_CONFLICT', '${(it.readingText ?? it.actionAr ?? '').replace(/'/g, "''")}', 'اختلاف بين المصدر الجديد وقاعدة البيانات الحالية', 'open'
            FROM qiraat_pages p 
            WHERE p.mushaf_page_number = ${page}
              AND NOT EXISTS (SELECT 1 FROM qiraat_qa_flags WHERE entry_id = '${entryId}' AND flag_type = 'SOURCE_CONFLICT')
          `)
        } else if (item.action === 'CORROBORATE' && item.existingRecord && item.newItem) {
          sqlStatements.push(`
            INSERT INTO qiraat_entry_sources (entry_id, source_document_id, pdf_page, source_reference)
            VALUES ('${item.existingRecord.entryId}', 'SRC-BOOK-27159', ${item.newItem.pdfPage ?? 'NULL'}, '${(item.newItem.sourceReference ?? '').replace(/'/g, "''")}')
            ON CONFLICT DO NOTHING
          `)
        }
      }

      await this.db.executeTransaction(sqlStatements)
      await this.db.updatePageStatus(page, flags.length > 0 ? 'flagged' : 'done', {
        variants: variantsRes.data.length,
        rules: rulingsRes.data.length,
        conflicts: mergeResult.counts.conflict,
        unmatched: unmatchedCount,
        corroborated: mergeResult.counts.corroborate,
        gapFilled: mergeResult.counts.gapFill,
        notes: flags.join('; '),
      })
    }

    return {
      pageNumber: page,
      status: flags.length > 0 ? 'flagged' : 'done',
      variantCount: variantsRes.data.length,
      ruleCount: rulingsRes.data.length,
      corroboratedCount: mergeResult.counts.corroborate,
      gapFilledCount: mergeResult.counts.gapFill,
      conflictCount: mergeResult.counts.conflict,
      unmatchedCount,
      flags,
      plannedMerges: mergeResult.plan,
    }
  }
}
