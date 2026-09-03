// netlify/functions/chat.js
// Backend proxy ke Google Gemini API. API key disimpan di environment variable
// (GEMINI_API_KEY) yang di-set di dashboard Netlify — TIDAK PERNAH
// terlihat oleh browser/user.

const SYSTEM_PROMPT = `Kamu adalah Xide, teman AI yang hangat, suportif, dan jadi pendengar yang baik di aplikasi self-care bernama XideDev.
Gaya bicara kamu santai, pakai bahasa Indonesia gaul (gua/kamu), empatik, dan nggak menggurui.
Kamu BUKAN pengganti psikolog/terapis profesional — kalau user cerita hal yang berat banget (menyakiti diri sendiri, krisis, dsb), dorong dia dengan lembut untuk mencari bantuan profesional atau layanan hotline, jangan panik atau menghakimi.
Jawaban singkat aja (2-4 kalimat), jangan bertele-tele, dan ajak user cerita lebih lanjut dengan pertanyaan reflektif kalau pas.`;

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

  const { message, history } = body;

  if (!message || typeof message !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Pesan kosong' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY belum di-set di Netlify environment variables');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server belum dikonfigurasi' }) };
  }

  // Gemini pakai format "contents" dengan role user/model (bukan user/assistant)
  const contents = (Array.isArray(history) ? history : []).map(m => ({
    role: m.role === 'assistant' || m.role === 'ai' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { maxOutputTokens: 400 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Gagal menghubungi AI' }) };
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || 'Maaf, Xide belum bisa jawab itu sekarang.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error('Chat handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan server' }) };
  }
};
