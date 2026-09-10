// netlify/functions/admin-page.js
// Nge-serve halaman admin (HTML) - TAPI HANYA kalau URL-nya nyertain kode
// rahasia yang benar di query string (?key=...). Tanpa itu, orang yang coba
// akses langsung bakal dapet 404 polos, seolah-olah halaman ini nggak pernah
// ada - bukan cuma "diminta password" (itu baru lapisan proteksi kedua,
// dicek beneran di admin-login.js/admin-list.js/admin-approve.js).
//
// Cara pakai: buka https://NAMA-SITE-KAMU.netlify.app/admin?key=KODE_RAHASIA
// (KODE_RAHASIA harus sama persis dengan ADMIN_URL_KEY di environment variable)

const NOT_FOUND_BODY = `<!DOCTYPE html>
<html><head><title>Not Found</title></head>
<body><h1>404 Not Found</h1></body></html>`;

function notFound() {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html' },
    body: NOT_FOUND_BODY
  };
}

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>XideDev Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:system-ui,-apple-system,sans-serif;background:#141726;color:#e8eaf0;min-height:100vh;padding:20px;}
  .wrap{max-width:640px;margin:0 auto;}
  h1{font-size:1.3rem;margin-bottom:20px;}
  .card{background:#1e2233;border:1px solid #2c3149;border-radius:14px;padding:20px;margin-bottom:16px;}
  input{width:100%;padding:12px;border-radius:10px;border:1.5px solid #2c3149;background:#141726;color:#fff;font-size:1rem;margin-bottom:12px;}
  button{padding:10px 16px;border-radius:10px;border:none;background:#4ECDC4;color:#0a0c14;font-weight:700;cursor:pointer;font-size:.9rem;}
  button:hover{opacity:.9;}
  button.reject{background:#e74c3c;color:#fff;}
  button:disabled{opacity:.4;cursor:not-allowed;}
  .item{display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid #2c3149;gap:10px;flex-wrap:wrap;}
  .item:last-child{border-bottom:none;}
  .code{font-family:monospace;font-size:1.1rem;font-weight:700;letter-spacing:.5px;}
  .meta{font-size:.75rem;color:#8b93a8;}
  .badge{font-size:.72rem;padding:3px 8px;border-radius:99px;font-weight:600;}
  .badge.pending{background:rgba(255,193,7,.15);color:#ffc107;}
  .badge.approved{background:rgba(78,205,196,.15);color:#4ECDC4;}
  .badge.rejected{background:rgba(231,76,60,.15);color:#e74c3c;}
  .actions{display:flex;gap:8px;}
  .error{color:#e74c3c;font-size:.85rem;margin-top:8px;}
  .empty{text-align:center;color:#8b93a8;padding:30px 0;}
</style>
</head>
<body>
<div class="wrap">
  <h1>🔐 XideDev Admin — Premium Requests</h1>

  <div class="card" id="login-card">
    <input type="password" id="password-input" placeholder="Password admin" onkeydown="if(event.key==='Enter')login()"/>
    <button onclick="login()">Login</button>
    <div class="error" id="login-error"></div>
  </div>

  <div class="card" id="list-card" style="display:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <strong>Daftar Kode</strong>
      <button onclick="loadList()" style="background:#2c3149;color:#e8eaf0;">↻ Refresh</button>
    </div>
    <div id="list-container"></div>
  </div>
</div>

<script>
let adminToken = sessionStorage.getItem('xide-admin-token') || null;

async function login() {
  const password = document.getElementById('password-input').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  if (!password) return;

  try {
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Login gagal';
      return;
    }
    adminToken = data.token;
    sessionStorage.setItem('xide-admin-token', adminToken);
    document.getElementById('login-card').style.display = 'none';
    document.getElementById('list-card').style.display = 'block';
    loadList();
  } catch (err) {
    errorEl.textContent = 'Gagal menghubungi server';
  }
}

async function loadList() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="empty">Memuat...</div>';
  try {
    const res = await fetch('/api/admin-list', {
      headers: { 'X-Admin-Token': adminToken }
    });
    if (res.status === 401) {
      sessionStorage.removeItem('xide-admin-token');
      adminToken = null;
      document.getElementById('login-card').style.display = 'block';
      document.getElementById('list-card').style.display = 'none';
      document.getElementById('login-error').textContent = 'Sesi habis, login lagi ya.';
      return;
    }
    const data = await res.json();
    if (!data.items || !data.items.length) {
      container.innerHTML = '<div class="empty">Belum ada request.</div>';
      return;
    }
    container.innerHTML = data.items.map(item => \`
      <div class="item">
        <div>
          <div class="code">\${item.code}</div>
          <div class="meta">\${new Date(item.createdAt).toLocaleString('id-ID')}</div>
        </div>
        <span class="badge \${item.status}">\${item.status}</span>
        \${item.status === 'pending' ? \`
          <div class="actions">
            <button onclick="approve('\${item.code}','approve')">✓ Approve</button>
            <button class="reject" onclick="approve('\${item.code}','reject')">✕ Reject</button>
          </div>
        \` : ''}
      </div>
    \`).join('');
  } catch (err) {
    container.innerHTML = '<div class="error">Gagal memuat data</div>';
  }
}

async function approve(code, action) {
  try {
    const res = await fetch('/api/admin-approve', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'X-Admin-Token': adminToken},
      body: JSON.stringify({ code, action })
    });
    if (!res.ok) {
      alert('Gagal memproses: ' + res.status);
      return;
    }
    loadList();
  } catch (err) {
    alert('Gagal menghubungi server');
  }
}

if (adminToken) {
  document.getElementById('login-card').style.display = 'none';
  document.getElementById('list-card').style.display = 'block';
  loadList();
}
</script>
</body>
</html>`;

exports.handler = async function (event) {
  const urlKey = process.env.ADMIN_URL_KEY;

  // Kalau ADMIN_URL_KEY belum di-set di server, kita TIDAK bisa memverifikasi
  // apa-apa - fail closed (selalu 404), bukan fail open (keliatan tanpa kunci).
  if (!urlKey) {
    console.error('ADMIN_URL_KEY belum di-set - halaman admin dikunci total (fail closed)');
    return notFound();
  }

  const givenKey = (event.queryStringParameters || {}).key;
  if (!givenKey || givenKey !== urlKey) {
    return notFound();
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex, nofollow' },
    body: ADMIN_HTML
  };
};

exports.config = {
  rateLimit: {
    windowLimit: 15,
    windowSize: 60,
    aggregateBy: ['ip']
  }
};
