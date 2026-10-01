import { execSync } from 'child_process'
import type { AyahWordToken } from './reanchor'
import type { ExistingDbRecord } from './mergePlan'

export class DbAdapter {
  private targetDb: string
  private containerName: string

  constructor(targetDb: 'staging' | 'prod' = 'staging', containerName: string = 'mutshabehat-db') {
    this.targetDb = targetDb === 'staging' ? 'mutshabehat_staging' : 'postgres'
    this.containerName = containerName
  }

  getTargetDbName(): string {
    return this.targetDb
  }

  private runPsqlQuery(sql: string): string {
    const escapedSql = sql.replace(/"/g, '\\"')
    const cmd = `docker exec ${this.containerName} psql -U postgres -d ${this.targetDb} -t -A -c "${escapedSql}"`
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  }

  /**
   * Fetches all words for a given ayah ordered by word_position
   */
  async fetchAyahTokens(surah: number, ayah: number): Promise<AyahWordToken[]> {
    const sql = `
      SELECT json_agg(t) FROM (
        SELECT ayah as ayah_number, word_position, text_uthmani 
        FROM quran_words 
        WHERE surah = ${surah} AND ayah = ${ayah} 
        ORDER BY word_position
      ) t;
    `
    const raw = this.runPsqlQuery(sql).trim()
    if (!raw || raw === 'null' || raw === '') return []
    try {
      return JSON.parse(raw) as AyahWordToken[]
    } catch {
      return []
    }
  }

  /**
   * Fetches all words for an ayah span ordered by ayah, word_position
   */
  async fetchAyahTokensSpan(surah: number, startAyah: number, endAyah: number): Promise<AyahWordToken[]> {
    const sql = `
      SELECT json_agg(t) FROM (
        SELECT ayah as ayah_number, word_position, text_uthmani 
        FROM quran_words 
        WHERE surah = ${surah} AND ayah >= ${startAyah} AND ayah <= ${endAyah} 
        ORDER BY ayah, word_position
      ) t;
    `
    const raw = this.runPsqlQuery(sql).trim()
    if (!raw || raw === 'null' || raw === '') return []
    try {
      return JSON.parse(raw) as AyahWordToken[]
    } catch {
      return []
    }
  }

  /**
   * Fetches existing readings and rulings for a given Mushaf page
   */
  async fetchExistingPageRecords(page: number): Promise<ExistingDbRecord[]> {
    const sql = `
      SELECT json_agg(t) FROM (
        SELECT 
          e.id as "entryId",
          e.locus_id as "locusId",
          l.surah_number as "surah",
          l.start_ayah as "ayah",
          l.start_word as "startWord",
          l.end_word as "endWord",
          r.reading_id as "narratorId",
          e.kind::text as "kind",
          rd.category_code as "categoryCode",
          vd.reading_text as "readingText",
          r.action_ar as "actionAr"
        FROM qiraat_entries e
        JOIN qiraat_loci l ON l.id = e.locus_id
        JOIN qiraat_entry_readings r ON r.entry_id = e.id
        LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id
        LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
        JOIN qiraat_pages p ON p.id = e.page_id
        WHERE p.mushaf_page_number = ${page} AND e.deleted_at IS NULL AND l.deleted_at IS NULL
      ) t;
    `
    const raw = this.runPsqlQuery(sql).trim()
    if (!raw || raw === 'null' || raw === '') return []
    try {
      return JSON.parse(raw) as ExistingDbRecord[]
    } catch {
      return []
    }
  }

  /**
   * Executes SQL in a single transaction
   */
  async executeTransaction(sqlStatements: readonly string[]): Promise<void> {
    if (sqlStatements.length === 0) return
    const combined = `BEGIN;\n${sqlStatements.join(';\n')};\nCOMMIT;`
    // Write to stdin of docker exec
    const cmd = `docker exec -i ${this.containerName} psql -U postgres -d ${this.targetDb} -v ON_ERROR_STOP=1`
    execSync(cmd, { input: combined, encoding: 'utf8' })
  }

  /**
   * Updates page status
   */
  async updatePageStatus(
    page: number,
    status: 'pending' | 'done' | 'done-empty' | 'flagged' | 'missing',
    stats: {
      variants?: number
      rules?: number
      conflicts?: number
      unmatched?: number
      corroborated?: number
      gapFilled?: number
      notes?: string
    } = {}
  ): Promise<void> {
    const v = stats.variants ?? 0
    const r = stats.rules ?? 0
    const c = stats.conflicts ?? 0
    const u = stats.unmatched ?? 0
    const corr = stats.corroborated ?? 0
    const gf = stats.gapFilled ?? 0
    const note = stats.notes ? `'${stats.notes.replace(/'/g, "''")}'` : 'NULL'

    const sql = `
      INSERT INTO qiraat_page_ingestion_status (
        page_number, status, variant_count, rule_count, 
        conflict_count, unmatched_count, corroborated_count, 
        gap_filled_count, last_ingested_at, notes
      ) VALUES (
        ${page}, '${status}', ${v}, ${r}, ${c}, ${u}, ${corr}, ${gf}, now(), ${note}
      )
      ON CONFLICT (page_number) DO UPDATE SET
        status = EXCLUDED.status,
        variant_count = EXCLUDED.variant_count,
        rule_count = EXCLUDED.rule_count,
        conflict_count = EXCLUDED.conflict_count,
        unmatched_count = EXCLUDED.unmatched_count,
        corroborated_count = EXCLUDED.corroborated_count,
        gap_filled_count = EXCLUDED.gap_filled_count,
        last_ingested_at = now(),
        notes = EXCLUDED.notes;
    `
    this.runPsqlQuery(sql)
  }
}
