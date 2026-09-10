// netlify/functions/admin-list.js
// Nampilin semua kode premium-request (pending + yang udah diapprove) buat
// halaman admin. Butuh session token dari admin-login.js yang masih valid.

const { getStore } = require('@netlify/blobs');
const { isValidAdminSession } = require('../lib/admin-auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!isValidAdminSession(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getStore({ name: 'premium-requests', consistency: 'strong' });
    const { blobs } = await store.list();

    const items = await Promise.all(
      blobs.map(async (b) => {
        const data = await store.get(b.key, { type: 'json' });
        return { code: b.key, ...data };
      })
    );

    // urutin: pending duluan (paling perlu ditindak), lalu dari yang paling baru
    items.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    };
  } catch (err) {
    console.error('admin-list handler error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan server' }) };
  }
};
