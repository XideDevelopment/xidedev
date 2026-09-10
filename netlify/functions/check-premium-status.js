// netlify/functions/check-premium-status.js
// Dipanggil dari browser user (berkala/pas buka halaman Premium lagi) buat
// ngecek apa kode unik mereka udah di-approve sama admin atau belum.

const { getStore } = require('@netlify/blobs');

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
  if (!code || typeof code !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Kode wajib diisi' }) };
  }

  try {
    const store = getStore({ name: 'premium-requests', consistency: 'strong' });
    const data = await store.get(code.toUpperCase().trim(), { type: 'json' });

    if (!data) {
      return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ found: false, premium: false }) };
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
