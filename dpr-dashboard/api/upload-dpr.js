'use strict';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require('ws');
}

const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { ALLOWED_IDS, detectFileType, extractDateFromFilename, getRoute } = require('./upload-routing');
const { requireAdmin } = require('./_auth');

const ALLOWED_EXTENSIONS = new Set(['xlsx', 'xls']);
const MIME_MAP = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  // ── Parse multipart/form-data ───────────────────────────────────────────────
  let fields, files;
  try {
    const form = formidable({ maxFileSize: 100 * 1024 * 1024, keepExtensions: true });
    [fields, files] = await new Promise((resolve, reject) =>
      form.parse(req, (err, f, v) => (err ? reject(err) : resolve([f, v])))
    );
  } catch (parseErr) {
    return res.status(400).json({ error: 'Failed to parse upload', detail: parseErr.message });
  }

  const pick = (v) => (Array.isArray(v) ? v[0] : v);
  const report_date_field = pick(fields.report_date);
  let   file_type         = pick(fields.file_type);
  const uploaded          = pick(files.file);

  if (!uploaded)
    return res.status(400).json({ error: 'file is required' });

  const originalName = uploaded.originalFilename ?? uploaded.name ?? 'upload.xlsx';
  const ext = originalName.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext))
    return res.status(400).json({ error: 'Only .xlsx and .xls files are accepted', filename: originalName });

  // Reject empty files early — a 0-byte upload would parse to an empty workbook.
  if (typeof uploaded.size === 'number' && uploaded.size === 0)
    return res.status(400).json({ error: 'Uploaded file is empty (0 bytes)', filename: originalName });

  // ── Auto-detect file type from filename if not provided / set to 'auto' ──────
  let detectedRoute = null;
  if (!file_type || file_type === 'auto') {
    detectedRoute = detectFileType(originalName);
    if (!detectedRoute)
      return res.status(400).json({
        error: 'Could not auto-detect file type from filename. Please select the file type manually.',
        filename: originalName,
      });
    file_type = detectedRoute.id;
  } else {
    if (!ALLOWED_IDS.has(file_type))
      return res.status(400).json({
        error: `Unknown file_type "${file_type}". Valid types: ${[...ALLOWED_IDS].join(', ')}`,
      });
    detectedRoute = getRoute(file_type);

    // Surface a mismatch between the chosen type and what the filename looks like,
    // so an accidental wrong selection doesn't silently store mis-typed data.
    const fromName = detectFileType(originalName);
    if (fromName && fromName.id !== detectedRoute.id) {
      return res.status(409).json({
        error: 'Selected file type does not match the filename.',
        selected: detectedRoute.id,
        filename_suggests: fromName.id,
        hint: 'Re-select the correct type, or rename the file, or send file_type="auto".',
      });
    }
  }

  // ── Derive report date: prefer form field, fall back to filename ─────────────
  let report_date = report_date_field;
  if (!report_date || !/^\d{4}-\d{2}-\d{2}$/.test(report_date)) {
    report_date = extractDateFromFilename(originalName, detectedRoute);
  }
  if (!report_date) {
    report_date = new Date().toISOString().slice(0, 10);
  }

  // ── Supabase (server-side secret key — never exposed to browser) ─────────────
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY)
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
  const batchId = randomUUID();
  const fileId  = randomUUID();

  // ── 1. Create batch record ───────────────────────────────────────────────────
  const { error: batchErr } = await supabase
    .from('dpr_upload_batches')
    .insert({ id: batchId, report_date })
    .select()
    .single();

  if (batchErr)
    return res.status(500).json({ error: 'Failed to create upload batch', detail: batchErr.message });

  // ── 2. Upload file to Supabase Storage ───────────────────────────────────────
  const storagePath = `dpr/${report_date}/${batchId}/${originalName}`;
  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(uploaded.filepath);
  } catch (readErr) {
    await supabase.from('dpr_upload_batches').delete().eq('id', batchId);
    return res.status(500).json({ error: 'Failed to read uploaded file', detail: readErr.message });
  }

  const { error: storageErr } = await supabase.storage
    .from('dpr-uploads')
    .upload(storagePath, fileBuffer, {
      contentType: MIME_MAP[ext] ?? 'application/octet-stream',
      upsert: false,
    });

  if (storageErr) {
    await supabase.from('dpr_upload_batches').delete().eq('id', batchId);
    return res.status(500).json({ error: 'Failed to upload to storage', detail: storageErr.message });
  }

  // ── 3. Record file metadata ──────────────────────────────────────────────────
  const { error: fileErr } = await supabase
    .from('dpr_uploaded_files')
    .insert({ id: fileId, batch_id: batchId, original_filename: originalName, file_type, storage_path: storagePath });

  if (fileErr) {
    await supabase.storage.from('dpr-uploads').remove([storagePath]);
    await supabase.from('dpr_upload_batches').delete().eq('id', batchId);
    return res.status(500).json({ error: 'Failed to record file metadata', detail: fileErr.message });
  }

  return res.status(200).json({
    success: true,
    batchId,
    fileId,
    storagePath,
    file_type,
    label: detectedRoute?.label,
    implemented: detectedRoute?.implemented ?? false,
    report_date,
    detectedFromFilename: !pick(fields.file_type) || pick(fields.file_type) === 'auto',
    dashboardSections: detectedRoute?.dashboardSections || [],
  });
};
