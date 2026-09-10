// netlify/functions/request-premium.js
// Dipanggil pas user klik "Mulai Premium". Bikin kode unik, simpen sebagai
// "pending" di Netlify Blobs. User nanti diminta cantumin kode ini di catatan
// donasi SociaBuzz, biar admin (kamu) bisa cocokin siapa yang udah bayar.

const { getStore } = require('@netlify/blobs');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I biar nggak ketuker pas diketik manual
  let code = 'XD-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const expectedToken = process.env.APP_TOKEN;
  const givenToken = event.headers['x-app-token'] || event.headers['X-App-Token'];
  if (expectedToken && givenToken !== expectedToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getStore({ name: 'premium-requests', consistency: 'strong' });

    // generate kode yang belum kepake (harusnya nyaris selalu berhasil di percobaan pertama)
    let code, exists = true, attempts = 0;
    while (exists && attempts < 5) {
      code = generateCode();
      const existing = await store.get(code);
      exists = existing !== null;
      attempts++;
    }
    if (exists) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Gagal generate kode, coba lagi' }) };
    }

    await store.setJSON(code, {
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    };
  } catch (err) {
    console.error('request-premium handler error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan server' }) };
  }
};

exports.config = {
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip']
  }
};
