// netlify/lib/blob-store.js
// Helper buat dapetin Netlify Blobs store, dengan kredensial EKSPLISIT
// (siteID + token) daripada mengandalkan auto-configuration Netlify yang
// (di project ini) terbukti nggak jalan - munculnya error
// "MissingBlobsEnvironmentError" walau getStore() sudah dipanggil di
// dalam function handler (bukan di luar, yang seharusnya jadi penyebab
// umum error itu).
//
// Butuh 2 environment variable di Netlify:
//   NETLIFY_SITE_ID    - Project ID/Site ID, dari Project configuration > General
//   NETLIFY_BLOBS_TOKEN - Personal Access Token, dari User settings > Applications

const { getStore } = require('@netlify/blobs');

function getPremiumStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;

  if (siteID && token) {
    // mode eksplisit - selalu jalan, nggak gantung ke auto-detect
    return getStore({ name: 'premium-requests', siteID, token, consistency: 'strong' });
  }

  // fallback ke auto-configuration (buat kasus di mana ini ternyata jalan
  // normal, misal pas testing lokal pake `netlify dev`)
  return getStore({ name: 'premium-requests', consistency: 'strong' });
}

module.exports = { getPremiumStore };
