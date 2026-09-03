// netlify/functions/chat.js
// Backend proxy ke Groq API. API key disimpan di environment variable
// (GROQ_API_KEY) yang di-set di dashboard Netlify — TIDAK PERNAH
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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY belum di-set di Netlify environment variables');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server belum dikonfigurasi' }) };
  }

  // Groq pakai format OpenAI-compatible: messages dengan role system/user/assistant
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const m of (Array.isArray(history) ? history : [])) {
    messages.push({
      role: m.role === 'assistant' || m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    });
  }
  messages.push({ role: 'user', content: message });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        max_tokens: 400,
        temperature: 0.8
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Gagal menghubungi AI', detail: errText.slice(0,300) }) };
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content
      || 'Maaf, Xide belum bisa jawab itu sekarang.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error('Chat handler error:', err.name, err.message);
    const isTimeout = err.name === 'AbortError';
    return { statusCode: 500, body: JSON.stringify({ error: isTimeout ? 'Timeout menghubungi AI' : 'Terjadi kesalahan server', detail: err.message }) };
  }
};
