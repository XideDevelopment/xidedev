// netlify/functions/admin-login.js
// Validasi password admin. Sengaja divalidasi di SERVER (bukan cuma
// dicocokin di JavaScript frontend) - kalau validasinya di frontend,
// siapapun bisa buka "View Source" dan baca password-nya langsung.

const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid' }) };
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD belum di-set di Netlify environment variables');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server belum dikonfigurasi' }) };
  }

  const { password } = body;
  if (!password || password !== adminPassword) {
    // delay kecil biar nggak gampang di-brute-force dengan nebak cepat berkali-kali
    await new Promise(r => setTimeout(r, 500));
    return { statusCode: 401, body: JSON.stringify({ error: 'Password salah' }) };
  }

  // Token session sederhana: password asli + tanggal hari ini, di-hash.
  // Otomatis "expired" tiap ganti hari (nggak perlu simpen token di database).
  const today = new Date().toISOString().slice(0, 10);
  const sessionToken = crypto.createHash('sha256').update(adminPassword + today).digest('hex');

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: sessionToken })
  };
};

exports.config = {
  rateLimit: {
    windowLimit: 5,
    windowSize: 60,
    aggregateBy: ['ip']
  }
};
