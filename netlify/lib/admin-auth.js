// netlify/functions/_admin-auth.js
// Helper dipakai bersama sama admin-list.js dan admin-approve.js buat
// validasi session token yang di-generate admin-login.js. File ini
// diawali underscore biar Netlify TIDAK menganggapnya sebagai endpoint
// tersendiri - dia cuma modul yang di-import.

const crypto = require('crypto');

function isValidAdminSession(event) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const token = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
  if (!token) return false;

  const today = new Date().toISOString().slice(0, 10);
  const expectedToken = crypto.createHash('sha256').update(adminPassword + today).digest('hex');

  return token === expectedToken;
}

module.exports = { isValidAdminSession };
