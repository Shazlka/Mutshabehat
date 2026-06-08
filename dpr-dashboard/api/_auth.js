'use strict';

/**
 * Admin guard for the DPR upload / process endpoints.
 *
 * Fail closed: if ADMIN_TOKEN is not configured on the server, every request is
 * rejected. Callers must send a matching `x-admin-token` request header.
 *
 * NOTE: This is a reference implementation for the standalone Vercel deployment.
 * If your existing project already ships an api/_auth.js, prefer that one.
 */
function requireAdmin(req, res) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(500).json({ error: 'Server misconfiguration: ADMIN_TOKEN not set' });
    return false;
  }
  const provided = req.headers['x-admin-token'];
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { requireAdmin };
