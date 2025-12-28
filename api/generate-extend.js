// =====================================================
// Suno AI Extend Mode API v11.9 (KV RateLimit FIXED)
// 백엔드 전용 - Upstash/Vercel KV 레이트리밋(원자적) + 보안 강화 + 8대 원칙 주입
// =====================================================

// =====================================
// KV 레이트리밋 (원자적: SET NX + INCR in /multi-exec)
// - IP당 1시간에 20회
// - 동시요청에서도 레이트리밋 뚫림 방지
// - KV 실패 시 메모리 fallback
// =====================================
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SEC = 3600;

async function checkRateLimit(ip) {
  // Upstash/Vercel 연결 방식이 섞여도 안전하게 잡기
  const KV_REST_API_URL =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_URL;

  const KV_REST_API_TOKEN =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    console.warn('[Rate Limit] KV not configured, using memory fallback');
    return checkRateLimitFallback(ip);
  }

  const key = `ratelimit_extend:${ip}`;

  try {
    // 1) 처음 요청일 때만 TTL을 걸기 위해 SET NX + EX
    // 2) 그 다음 INCR로 카운트 증가
    // 두 명령을 트랜잭션(/multi-exec)으로 원자적으로 실행
    const txBody = [
      ['SET', key, '0', 'EX', String(RATE_LIMIT_WINDOW_SEC), 'NX'],
      ['INCR', key],
    ];

    const resp = await fetch(`${KV_REST_API_URL}/multi-exec`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(txBody),
    });

    if (!resp.ok) throw new Error(`KV transaction failed: ${resp.status}`);

    const tx = await resp.json();

    // Upstash /multi-exec 응답은 배열이며 각 항목에 { result, error } 형태가 옴
    const incrItem = Array.isArray(tx) ? tx[1] : null;
    const incrErr = incrItem?.error;
    const countRaw = incrItem?.result;

    if (incrErr) throw new Error(`KV INCR error: ${incrErr}`);

    const count = Number(countRaw);

    if (!Number.isFinite(count)) {
      throw new Error(`KV INCR returned non-number: ${String(countRaw)}`);
    }

    if (count > RATE_LIMIT_MAX) {
      throw new Error('Too many requests (max 20/hour). Please try again later.');
    }

    return; // 통과
  } catch (error) {
    console.error('[Rate Limit] KV error, using fallback:', error.message);
    return checkRateLimitFallback(ip);
  }
}

const rateLimitMapFallback = new Map();
function checkRateLimitFallback(ip) {
  const now = Date.now();
  const userRequests = rateLimitMapFallback.get(ip) || [];
  const recentRequests = userRequests.filter(t => now - t < RATE_LIMIT_WINDOW_SEC * 1000);

  if (recentRequests.length >= RATE_LIMIT_MAX) {
    throw new Error('Too many requests (max 20/hour). Please try again later.');
  }

  recentRequests.push(now);
  rateLimitMapFallback.set(ip, recentRequests);
}

// =====================================
// 입력 검증 및 에러 응답 (보안 강화)
// =====================================
function validateExtendInput(body) {
  const errors = [];
  if (!body.existingVerse1 || body.existingVerse1.trim().length === 0) errors.push('기존 Verse 1이 필요합니다');
  if (!body.existingChorus || body.existingChorus.trim().length === 0) errors.push('기존 Chorus가 필요합니다');
  if (!body.userApiKey) errors.push('API 키는 필수입니다');

  if (errors.length > 0) {
    const error = new Error(errors.join(', '));
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
}

function errorResponse(res, status, message, code = 'UNKNOWN_ERROR', retryable = false) {
  return res.status(status).json({
    error: message,
    error_code: code,
    retryable: retryable,
    timestamp: new Date().toISOString(),
  });
}

// =====================================
// 메인 핸들러
// =====================================
module.exports = async (req, res) => {
  // 보안 헤더 및 CORS 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://suno-helper-backend.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const xff = req.headers['x-forwarded-for'];
    const clientIP = xff ? (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim() : 'unknown';

    await checkRateLimit(clientIP);

    validateExtendInput(req.body);

    const {
      userApiKey,
      modelName,
      existingVerse1,
      existingChorus,
      genre,
      keyword,
      structure,
    } = req.body;

    // 🔥 8대 원칙이 주입된 Extend 프롬프트
    // (중요) “연장”만: Verse1/Chorus 재작성 금지
    const extendPrompt = `
You are "Suno AI Extend Master". Generate the continuation based on the provided Verse 1 and Chorus.

🔥🔥🔥 ABSOLUTE RULES (NEVER VIOLATE) 🔥🔥🔥
1) Korean lines: strictly 3~5 syllables per line (6+ forbidden)
2) Chorus full repetition forbidden (keep ONLY ONE anchor line, vary the rest)
3) Force melody variation via syllable pattern changes (e.g., 3→4→5→4)
4) Long notes: use tilde "~" strategically at open vowels (do NOT use "-")
5) Counterpoint: add English counterpoint in parentheses ( ) occasionally
6) Keep it tight: Verse 2 (4 lines), Pre-Chorus (2 lines), Chorus 2 (5~6 lines), Bridge (4 lines)
7) Output ONLY the sections below. No explanations. No syllable counts.

📋 EXISTING SONG:
[Verse 1]
${existingVerse1}

[Chorus]
${existingChorus}

🎯 YOUR TASK:
Generate ONLY:
[Verse 2]
[Pre-Chorus]
[Chorus 2]
[Bridge]

- [Verse 2]: 4 lines, keep the tone of Verse 1
- [Pre-Chorus]: 2 lines, build tension
- [Chorus 2]: 5~6 lines, reuse EXACTLY ONE anchor line from existing chorus, vary all other lines
- [Bridge]: 4 lines, emotional turning point
- Add English counterpoint ( ) irregularly, but keep it meaningful

Now generate the continuation only.
`;

    const model = modelName || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': userApiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: extendPrompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 2048 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);

    const data = await response.json();
    const extension = data?.candidates?.[0]?.content?.parts?.[0]?.text || '생성 실패';

    return res.status(200).json({ extension });
  } catch (error) {
    console.error('Extend API Error:', error.message);

    if (error.code === 'VALIDATION_ERROR') {
      return errorResponse(res, 400, error.message, 'VALIDATION_ERROR');
    }

    if (String(error.message).includes('Too many requests')) {
      return errorResponse(res, 429, error.message, 'RATE_LIMIT_EXCEEDED', true);
    }

    return errorResponse(res, 500, '서버 오류가 발생했습니다.', 'SERVER_ERROR', true);
  }
};
