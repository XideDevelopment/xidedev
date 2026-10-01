// netlify/functions/check-premium-status.js
// Dipanggil dari browser user. Karena kode unik sekarang di-generate di
// BROWSER (client-side, lihat index.html), function ini melakukan
// "get-or-create": kalau kode belum pernah terdaftar, dia didaftarkan
// sebagai "pending" saat ini (kunjungan pertama). Kalau sudah terdaftar,
// dia cuma ngecek status yang ada.

const { getPremiumStore } = require('../lib/blob-store');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const expectedToken = process.env.APP_TOKEN;
  const givenToken = event.headers['x-app-token'] || event.headers['X-App-Token'];
  if (expectedToken && givenToken !== expectedToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) };
  }

  const { code } = body;
  if (!code || typeof code !== 'string' || !/^XD-[A-Z0-9]{6}$/.test(code)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Format kode tidak valid' }) };
  }

  try {
    const store = getPremiumStore();
    let data = await store.get(code, { type: 'json' });

    if (!data) {
      // kunjungan pertama buat kode ini - daftarkan sebagai pending
      data = { status: 'pending', createdAt: new Date().toISOString() };
      await store.setJSON(code, data);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ found: true, premium: data.status === 'approved', status: data.status })
    };
  } catch (err) {
    console.error('check-premium-status handler error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan server' }) };
  }
};

exports.config = {
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ['ip']
  }
};
