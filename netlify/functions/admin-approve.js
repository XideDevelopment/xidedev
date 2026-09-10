// netlify/functions/admin-approve.js
// Approve atau reject satu kode premium-request. Butuh session token dari
// admin-login.js yang masih valid.

const { getStore } = require('@netlify/blobs');
const { isValidAdminSession } = require('../lib/admin-auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!isValidAdminSession(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) };
  }

  const { code, action } = body;
  if (!code || !['approve', 'reject'].includes(action)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'code dan action (approve/reject) wajib diisi' }) };
  }

  try {
    const store = getStore({ name: 'premium-requests', consistency: 'strong' });
    const existing = await store.get(code, { type: 'json' });
    if (!existing) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Kode tidak ditemukan' }) };
    }

    existing.status = action === 'approve' ? 'approved' : 'rejected';
    existing.updatedAt = new Date().toISOString();
    await store.setJSON(code, existing);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, status: existing.status })
    };
  } catch (err) {
    console.error('admin-approve handler error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan server' }) };
  }
};
