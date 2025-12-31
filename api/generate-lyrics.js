// =====================================================
// Suno AI Lyrics Generation API v11.6
// Ã«Â°Â±Ã¬â€”â€Ã«â€œÅ“ Ã¬Â â€žÃ¬Å¡Â© - Vercel KV Ã«Â Ë†Ã¬ÂÂ´Ã­Å Â¸Ã«Â¦Â¬Ã«Â°â€¹ + Ã«Â³Â´Ã¬â€¢Ë† ÃªÂ°â€¢Ã­â„¢â€!
// =====================================================

// =====================================
// Vercel KV Ã«Â Ë†Ã¬ÂÂ´Ã­Å Â¸Ã«Â¦Â¬Ã«Â°â€¹ (Ã¬â€ºÂÃ¬Å¾ÂÃ¬Â Â Ã­Å Â¸Ã«Å¾Å“Ã¬Å¾Â­Ã¬â€¦Ëœ)
// =====================================
async function checkRateLimit(ip) {
  // Ã¢Â­Â Vercel KV / Upstash REST Ã­â„¢ËœÃªÂ²Â½Ã«Â³â‚¬Ã¬Ë†Ëœ
  const KV_REST_API_URL =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_URL;

  const KV_REST_API_TOKEN =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  // KVÃªÂ°â‚¬ Ã¬â€žÂ¤Ã¬Â â€¢ Ã¬â€¢Ë† Ã«ÂËœÃ¬â€“Â´ Ã¬Å¾Ë†Ã¬Å“Â¼Ã«Â©Â´ ÃªÂ¸Â°Ã«Â³Â¸ Ã«Â Ë†Ã¬ÂÂ´Ã­Å Â¸Ã«Â¦Â¬Ã«Â°â€¹ (Ã«Â©â€Ã«ÂªÂ¨Ã«Â¦Â¬)
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    console.warn('[Rate Limit] Vercel KV not configured, using memory fallback');
    return checkRateLimitFallback(ip);
  }

  const key = `ratelimit:${ip}`;

  try {
    // Ã¢Å“â€¦ atomic Ã­Å Â¸Ã«Å¾Å“Ã¬Å¾Â­Ã¬â€¦Ëœ: Ã¬ÂµÅ“Ã¬Â´Ë† 1Ã­Å¡Å’Ã«Â§Å’ EX Ã¬â€žÂ¤Ã¬Â â€¢ + INCR
    const txBody = [
      ['SET', key, '0', 'EX', '3600', 'NX'],
      ['INCR', key]
    ];

    const txRes = await fetch(`${KV_REST_API_URL.replace(/\/+$/, '')}/multi-exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(txBody)
    });

    if (!txRes.ok) {
      throw new Error(`KV transaction failed: ${txRes.status}`);
    }

    const txJson = await txRes.json();

    // Vercel KVÃ«Å â€ Ã«Â³Â´Ã­â€ Âµ [ {result}, {result} ] Ã­Ëœâ€¢Ã­Æ’Å“
    const incrItem = Array.isArray(txJson) ? txJson[1] : null;

    if (incrItem?.error) {
      throw new Error(`KV INCR error: ${incrItem.error}`);
    }

    const count = Number(incrItem?.result);
    if (!Number.isFinite(count)) {
      throw new Error(`KV INCR returned non-number: ${String(incrItem?.result)}`);
    }

    if (count > 20) {
      throw new Error('Too many requests (max 20/hour). Please try again later.');
    }

    return;
  } catch (error) {
    console.error('[Rate Limit] KV error, using fallback:', error.message);
    return checkRateLimitFallback(ip);
  }
}

// =====================================
// Fallback Ã«Â Ë†Ã¬ÂÂ´Ã­Å Â¸Ã«Â¦Â¬Ã«Â°â€¹ (KV Ã¬â€¹Â¤Ã­Å’Â¨ Ã¬â€¹Å“)
// =====================================
const rateLimitMapFallback = new Map();
const MAX_FALLBACK_ENTRIES = 1000;

function checkRateLimitFallback(ip) {
  const now = Date.now();
  const userRequests = rateLimitMapFallback.get(ip) || [];
  
  // 1Ã¬â€¹Å“ÃªÂ°â€ž Ã«â€šÂ´ Ã¬Å¡â€Ã¬Â²Â­Ã«Â§Å’ Ã­â€¢â€žÃ­â€žÂ°
  const recentRequests = userRequests.filter(t => now - t < 3600000);
  
  if (recentRequests.length >= 20) {
    throw new Error('Too many requests (max 20/hour). Please try again later.');
  }
  
  recentRequests.push(now);
  rateLimitMapFallback.set(ip, recentRequests);
  
  // MapÃ¬ÂÂ´ Ã«â€žË†Ã«Â¬Â´ Ã¬Â»Â¤Ã¬Â§â‚¬Ã«Â©Â´ Ã¬ËœÂ¤Ã«Å¾ËœÃ«ÂÅ“ IP Ã¬Â â€¢Ã«Â¦Â¬
  if (rateLimitMapFallback.size > MAX_FALLBACK_ENTRIES) {
    const sortedEntries = Array.from(rateLimitMapFallback.entries())
      .sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
    
    const deleteCount = rateLimitMapFallback.size - MAX_FALLBACK_ENTRIES;
    for (let i = 0; i < deleteCount; i++) {
      rateLimitMapFallback.delete(sortedEntries[i][0]);
    }
  }
  
  // Ã¢Â­Â Ã¬Â â€¢Ã¬Æ’Â Ã­â€ ÂµÃªÂ³Â¼ Ã¬â€¹Å“ Ã«Âªâ€¦Ã¬â€¹Å“Ã¬Â Â return (Ã«Â²â€žÃªÂ·Â¸ Ã¬Ë†ËœÃ¬Â â€¢!)
  return;
}




// =====================================
// ê°€ì‚¬ ì¶œë ¥ í›„ì²˜ë¦¬: ê¹¨ë—í•œ ì¶œë ¥ ê°•ì œ (ì˜¤ë¹  ê·œì¹™ ê³ ì •!)
// - í•˜ì´í”ˆ(-) ìœ ì§€ (Suno V5 ê³µì‹ ê¶Œìž¥: ë¡±í†¤ í‘œí˜„ìš©)
// - ìŒì ˆìˆ˜ ê´„í˜¸ (3), (4), (5) ì™„ì „ ì œê±°
// - ë°°ë‹¬ ë…¸íŠ¸ [melancholic delivery] ì™„ì „ ì œê±°
// =====================================
function enforceCleanOutput(text) {
  if (!text || typeof text !== 'string') return text;

  let out = text;

  // 1) â­ í•˜ì´í”ˆ(-) ìœ ì§€! Suno V5ëŠ” í•˜ì´í”ˆìœ¼ë¡œ ë¡±í†¤ í‘œí˜„ (ê³µì‹ ê¶Œìž¥)
  // out = out.replace(/-/g, ''); // â† ì‚­ì œ!

  // 2) âŒ ìŒì ˆìˆ˜ ê´„í˜¸ ì œê±°: (3), (4), (5), (6) ë“±
  // ì •ê·œì‹: \(\d+\) = ê´„í˜¸ ì•ˆì— ìˆ«ìžë§Œ ìžˆëŠ” ê²½ìš°
  out = out.replace(/\(\d+\)/g, '');
  
  // 3) âŒ ë°°ë‹¬ ë…¸íŠ¸ ì œê±°: [melancholic delivery], [energetic delivery] ë“±
  // ì •ê·œì‹: \[.*?delivery.*?\] = ëŒ€ê´„í˜¸ ì•ˆì— delivery í¬í•¨
  out = out.replace(/\[.*?delivery.*?\]/gi, '');

  // 4) ê³µë°± ì •ë¦¬
  out = out.replace(/[\t ]{2,}/g, ' ');
  out = out.replace(/ \n/g, '\n').replace(/\n /g, '\n');

  return out;
}

// í•˜ìœ„ í˜¸í™˜ì„± ìœ ì§€
function enforceNoHyphens(text) {
  return enforceCleanOutput(text);
}

// =====================================
// Ã¬Å¾â€¦Ã«Â Â¥ ÃªÂ²â‚¬Ã¬Â¦Â Ã­â€¢Â¨Ã¬Ë†Ëœ (v11.1 Ã¬Â¶â€ÃªÂ°â‚¬)
// =====================================
function validateInput(body) {
  const errors = [];
  
  // keyword ÃªÂ²â‚¬Ã¬Â¦Â
  if (!body.keyword || typeof body.keyword !== 'string') {
    errors.push('Ã­â€šÂ¤Ã¬â€ºÅ’Ã«â€œÅ“Ã«Å â€ Ã­â€¢â€žÃ¬Ë†ËœÃ¬Å¾â€¦Ã«â€¹Ë†Ã«â€¹Â¤');
  } else {
    const trimmedKeyword = body.keyword.trim();
    if (trimmedKeyword.length === 0) {
      errors.push('Ã­â€šÂ¤Ã¬â€ºÅ’Ã«â€œÅ“Ã«Å â€ Ã«Â¹Ë† Ã¬Â¹Â¸Ã¬ÂÂ¼ Ã¬Ë†Ëœ Ã¬â€”â€ Ã¬Å ÂµÃ«â€¹Ë†Ã«â€¹Â¤');
    }
    if (trimmedKeyword.length > 2000) { // Ã¢Â­Â 100Ã¬Å¾Â Ã¢â€ â€™ 2000Ã¬Å¾Â (Ã¬Æ’ÂÃ¬â€¹ÂÃ¬Â ÂÃ¬Å“Â¼Ã«Â¡Å“!)
      errors.push('Ã­â€šÂ¤Ã¬â€ºÅ’Ã«â€œÅ“Ã«Å â€ 2000Ã¬Å¾Â Ã¬ÂÂ´Ã­â€¢ËœÃ«Â¡Å“ Ã¬Å¾â€¦Ã«Â Â¥Ã­â€¢Â´Ã¬Â£Â¼Ã¬â€žÂ¸Ã¬Å¡â€');
    }
    // Ã¬Â â€¢Ã¬Æ’ÂÃ¬ÂÂ´Ã«Â©Â´ trimÃ«ÂÅ“ ÃªÂ°â€™Ã¬Å“Â¼Ã«Â¡Å“ ÃªÂµÂÃ¬Â²Â´
    body.keyword = trimmedKeyword;
  }
  
  // userApiKey ÃªÂ²â‚¬Ã¬Â¦Â
  if (!body.userApiKey || typeof body.userApiKey !== 'string') {
    errors.push('API Ã­â€šÂ¤Ã«Å â€ Ã­â€¢â€žÃ¬Ë†ËœÃ¬Å¾â€¦Ã«â€¹Ë†Ã«â€¹Â¤');
  } else if (body.userApiKey.trim().length === 0) {
    errors.push('API Ã­â€šÂ¤Ã«Å â€ Ã«Â¹Ë† Ã¬Â¹Â¸Ã¬ÂÂ¼ Ã¬Ë†Ëœ Ã¬â€”â€ Ã¬Å ÂµÃ«â€¹Ë†Ã«â€¹Â¤');
  }
  
  // Ã¢Å“â€¦ modelName ÃªÂ²â‚¬Ã¬Â¦Â (v11.3 Ã¬Â¶â€ÃªÂ°â‚¬ - Ã­â€”Ë†Ã¬Å¡Â© Ã«ÂªÂ¨Ã«ÂÂ¸Ã«Â§Å’)
  const allowedModels = [
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash'
  ];
  if (body.modelName && typeof body.modelName === 'string') {
    const m = body.modelName.trim();
    if (!allowedModels.includes(m)) {
      console.warn(`Invalid modelName: ${body.modelName}, using default (gemini-3-flash-preview)`);
      body.modelName = 'gemini-3-flash-preview';
    } else {
      body.modelName = m;
    }
  }
  
  // genre ÃªÂ²â‚¬Ã¬Â¦Â (Ã¬Å“Â Ã­Å¡Â¨Ã­â€¢ËœÃ¬Â§â‚¬ Ã¬â€¢Å Ã¬Å“Â¼Ã«Â©Â´ ÃªÂ¸Â°Ã«Â³Â¸ÃªÂ°â€™)
  const validGenres = [
    'pop80s', 'trot', 'ballad', 'acoustic_folk', 'rock_ballad', 'rnb',
    'kpop_dance', 'city_pop', 'lofi_hiphop',
    'europop', 'metal',
    'hip_hop_boom_bap', 'trap_melodic', 'funk_pop', 'reggaeton', 'future_bass', 'indie_pop'
  ];
  if (body.genre && !validGenres.includes(body.genre)) {
    console.warn(`Invalid genre: ${body.genre}, using default (pop80s)`);
    body.genre = 'pop80s';
  }
  
  // structure ÃªÂ²â‚¬Ã¬Â¦Â (Ã¬â€”â€ ÃªÂ±Â°Ã«â€šËœ Ã¬Å“Â Ã­Å¡Â¨Ã­â€¢ËœÃ¬Â§â‚¬ Ã¬â€¢Å Ã¬Å“Â¼Ã«Â©Â´ ÃªÂ¸Â°Ã«Â³Â¸ÃªÂ°â€™ ÃªÂ°â€¢Ã¬Â Å“!)
  const validStructures = ['standard', 'short', 'extended'];
  if (!body.structure || !validStructures.includes(body.structure)) {
    if (body.structure) {
      console.warn(`Invalid structure: ${body.structure}, using default (standard)`);
    }
    body.structure = 'standard'; // Ã¢Â­Â Ã¬â€”â€ Ã¬Å“Â¼Ã«Â©Â´ Ã«Â¬Â´Ã¬Â¡Â°ÃªÂ±Â´ ÃªÂ¸Â°Ã«Â³Â¸ÃªÂ°â€™!
  }
  
  // modifier Ã­â€¢â€žÃ«â€œÅ“Ã«â€œÂ¤ ÃªÂ¸Â¸Ã¬ÂÂ´ Ã¬Â Å“Ã­â€¢Å“ (Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸ Ã­ÂÂ­Ã«Â°Å“ Ã«Â°Â©Ã¬Â§â‚¬)
  const modifierFields = [
    'vocalModifier', 'genreFusionModifier', 'vocalConfigModifier',
    'emotionIntensityModifier', 'moodModifier',
    'sectionVerse', 'sectionPrechorus', 'sectionChorus', 'sectionBridge', 'sectionFinal', 'sectionOutro'
  ];
  
  modifierFields.forEach(field => {
    if (body[field] && typeof body[field] === 'string' && body[field].length > 1000) { // Ã¢Â­Â 200Ã¬Å¾Â Ã¢â€ â€™ 1000Ã¬Å¾Â
      errors.push(`${field}Ã«Å â€ 1000Ã¬Å¾Â Ã¬ÂÂ´Ã­â€¢ËœÃ«Â¡Å“ Ã¬Å¾â€¦Ã«Â Â¥Ã­â€¢Â´Ã¬Â£Â¼Ã¬â€žÂ¸Ã¬Å¡â€`);
    }
  });
  
  // Ã¬â€”ÂÃ«Å¸Â¬ÃªÂ°â‚¬ Ã¬Å¾Ë†Ã¬Å“Â¼Ã«Â©Â´ throw
  if (errors.length > 0) {
    const error = new Error(errors.join(', '));
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  
  return body;
}

// =====================================
// Ã¬â€”ÂÃ«Å¸Â¬ Ã¬Ââ€˜Ã«â€¹Âµ Ã­â€”Â¬Ã­ÂÂ¼ Ã­â€¢Â¨Ã¬Ë†Ëœ (v11.1 Ã¬Â¶â€ÃªÂ°â‚¬)
// =====================================
function errorResponse(res, status, message, code = 'UNKNOWN_ERROR', retryable = false) {
  return res.status(status).json({
    error: message,
    error_code: code,
    retryable: retryable,
    timestamp: new Date().toISOString()
  });
}

// Ã¬Å¾Â¥Ã«Â¥Â´Ã«Â³â€ž ÃªÂ°â‚¬Ã¬â€šÂ¬ ÃªÂ³ÂµÃ¬â€¹Â Ã¬â€žÂ¤Ã¬Â â€¢
const GENRE_CONFIGS = {
  // Ã°Å¸â€™Å½ ÃªÂ°ÂÃ¬â€žÂ± Ã¬Å¾Â¥Ã¬ÂÂ¸ Ã­Å’Â© (Ã«Â°Å“Ã«ÂÂ¼Ã«â€œÅ“ ÃªÂ³â€žÃ¬â€”Â´)
  pop80s: {
    name: '80s Ã­Å’Â Ã«Â°Å“Ã«ÂÂ¼Ã«â€œÅ“',
    syllableRule: '3-6Ã¬ÂÅ’Ã¬Â Ë† (Ã¬Å¾ÂÃ¬â€”Â°Ã¬Å Â¤Ã«Å¸Â¬Ã¬Å¡Â´ Ã­ËœÂ¸Ã­ÂÂ¡)',
    finalChorusMax: 8,
    chorusLines: '5-6Ã¬Â¤â€ž',
    special: 'Ã­â€™ÂÃ«Â¶â‚¬Ã­â€¢Å“ Ã­â„¢â€Ã¬ÂÅ’ÃªÂ³Â¼ ÃªÂ°ÂÃ¬Â â€¢Ã¬Â Â Ã«Â¹Å’Ã«â€œÅ“Ã¬â€”â€¦'
  },
  trot: {
    name: 'Ã¬Â â€¢Ã­â€ Âµ Ã­Å Â¸Ã«Â¡Å“Ã­Å Â¸',
    syllableRule: '3-6Ã¬ÂÅ’Ã¬Â Ë† (ÃªÂºÂ¾ÃªÂ¸Â° Ã¬Å“Â Ã«Ââ€ž)',
    finalChorusMax: 8,
    chorusLines: '5-6Ã¬Â¤â€ž',
    special: 'Ã­â€¢Å“(Ã¦ÂÂ¨)Ã¬ÂËœ Ã«Â¯Â¸Ã­â€¢â„¢, Ã¬â€“ÂµÃ¬Â Å“Ã«ÂÅ“ Ã¬Å Â¬Ã­â€â€, ÃªÂºÂ¾ÃªÂ¸Â° ÃªÂ¸Â°Ã«Â²â€¢(kkeok-gi) Ã­â€¢â€žÃ¬Ë†Ëœ'
  },
  ballad: {
    name: 'Ã­â€¢Å“ÃªÂµÂ­Ã­Ëœâ€¢ ÃªÂ°ÂÃ¬â€žÂ± Ã«Â°Å“Ã«ÂÂ¼Ã«â€œÅ“',
    syllableRule: '3-6Ã¬ÂÅ’Ã¬Â Ë†',
    finalChorusMax: 8,
    chorusLines: '5-6Ã¬Â¤â€ž',
    special: 'Ã«â€žâ€œÃ¬Ââ‚¬ Ã«Â¹â€žÃ«Â¸Å’Ã«ÂÂ¼Ã­â€ Â , Ã«Â©Å“Ã«Â¡Å“Ã«â€â€ Ã¬Â¤â€˜Ã¬â€¹Â¬'
  },
  acoustic_folk: {
    name: 'Ã¬â€“Â´Ã¬Â¿Â Ã¬Å Â¤Ã­â€¹Â± Ã­ÂÂ¬Ã­ÂÂ¬',
    syllableRule: '3-6Ã¬ÂÅ’Ã¬Â Ë† (Ã¬Å¾ÂÃ¬â€”Â°Ã¬Å Â¤Ã«Å¸Â¬Ã¬Å¡Â´ Ã«Â§ÂÃ­Ë†Â¬)',
    finalChorusMax: 8,
    chorusLines: '5-6Ã¬Â¤â€ž',
    special: 'Ã¬ÂÂ´Ã¬â€¢Â¼ÃªÂ¸Â° Ã¬Â â€žÃ«â€¹Â¬ Ã¬Â¤â€˜Ã¬â€¹Â¬, Ã«Å’â‚¬Ã­â„¢â€Ã­â€¢ËœÃ«â€œÂ¯ Ã¬Å¾ÂÃ¬â€”Â°Ã¬Å Â¤Ã«Å¸Â½ÃªÂ²Å’'
  },
  rock_ballad: {
    name: 'Ã«Â¡Â Ã«Â°Å“Ã«ÂÂ¼Ã«â€œÅ“',
    syllableRule: '3-6Ã¬ÂÅ’Ã¬Â Ë† (ÃªÂ³Â Ã¬ÂÅ’ Ã«Â¡Â±Ã­â€ Â¤ Ã¬Å“Â Ã«Ââ€ž)',
    finalChorusMax: 9,
    chorusLines: '5-6Ã¬Â¤â€ž',
    special: 'Ã¬Â Ë†Ã¬Â Å“Ã«ÂÅ“ Ã­Å¾Ëœ, ÃªÂ³Â Ã¬ÂÅ’ Ã­ÂÂ­Ã«Â°Å“Ã¬Ââ‚¬ Final ChorusÃ¬â€”ÂÃ«Â§Å’ 1Ã­Å¡Å’!'
  },
  rnb: {
    name: 'Ã­â€¢Å“ÃªÂµÂ­Ã­Ëœâ€¢ R&B Ã«Â°Å“Ã«ÂÂ¼Ã«â€œÅ“',
    syllableRule: '3-6Ã¬ÂÅ’Ã¬Â Ë†',
    finalChorusMax: 8,
    chorusLines: '5-6Ã¬Â¤â€ž',
    special: 'Call-and-response, Ã¬Å Â¤Ã­Æ’Â Ã«Â³Â´Ã¬Â»Â¬, ÃªÂ°â€¢Ã«Â Â¥Ã­â€¢Å“ Ã­ÂÂ´Ã«ÂÂ¼Ã¬ÂÂ´Ã«Â§Â¥Ã¬Å Â¤'
  },
  
  // Ã°Å¸Å½Âµ MZ Ã¬â€¡Â¼Ã¬Â¸Â  Ã­Å’Â©
  kpop_dance: {
    name: 'K-Pop Ã¬â€¢â€žÃ¬ÂÂ´Ã«ÂÅ’ Ã«Å’â€žÃ¬Å Â¤',
    syllableRule: 'Ã¬Å¾ÂÃ¬Å“Â  (Ã­â€ºâ€žÃ­ÂÂ¬Ã«Å â€ 2-3Ã¬ÂÅ’Ã¬Â Ë† Ã«Â°ËœÃ«Â³Âµ)',
    finalChorusMax: 12,
    chorusLines: '6-8Ã¬Â¤â€ž',
    special: 'Ã¬Â¤â€˜Ã«Ââ€¦Ã¬â€žÂ± Ã­â€ºâ€žÃ­ÂÂ¬ Ã«Â°ËœÃ«Â³ÂµÃ¬ÂÂ´ Ã¬Æ’ÂÃ«Âªâ€¦! "Ã«â€šËœÃ«â€šËœÃ«â€šËœ", "Ã¬ËœË†Ã¬ËœË†Ã¬ËœË†" ÃªÂ°â„¢Ã¬Ââ‚¬ Ã¬ÂºÂÃ¬Â¹ËœÃ­â€â€žÃ«Â Ë†Ã¬ÂÂ´Ã¬Â¦Ë† Ã­â€¢â€žÃ¬Ë†Ëœ! Ã¬ÂÅ’Ã¬Â Ë† Ã¬Â Å“Ã­â€¢Å“ Ã¬â€”â€ Ã¬ÂÂ´ Ã«Â¦Â¬Ã«â€œÂ¬ÃªÂ°Â Ã¬Å¡Â°Ã¬â€žÂ !'
  },
  city_pop: {
    name: 'Ã¬â€¹Å“Ã­â€¹Â° Ã­Å’Â',
    syllableRule: '4-6Ã¬ÂÅ’Ã¬Â Ë† (Ã¬â€”Â¬Ã¬Å“Â Ã«Â¡Å“Ã¬Å¡Â´ ÃªÂ·Â¸Ã«Â£Â¨Ã«Â¸Å’)',
    finalChorusMax: 10,
    chorusLines: '6-7Ã¬Â¤â€ž',
    special: 'Ã¬Â§ÂÃ¬â€žÂ¤Ã¬Â Â Ã¬Å Â¬Ã­â€â€Ã«Â³Â´Ã«â€¹Â¤ Ã«Ââ€žÃ¬â€¹Å“Ã¬Â Â Ã«â€šÂ­Ã«Â§Å’ÃªÂ³Â¼ Ã­â€“Â¥Ã¬Ë†Ëœ Ã­â€˜Å“Ã­Ëœâ€ž'
  },
  lofi_hiphop: {
    name: 'Ã«Â¡Å“Ã­Å’Å’Ã¬ÂÂ´ Ã­Å¾â„¢Ã­â€¢Â©',
    syllableRule: 'Ã¬ÂµÅ“Ã¬â€ Å’ (Ã¬ÂÂ¸Ã¬Å Â¤Ã­Å Â¸Ã«Â£Â¨Ã«Â©ËœÃ­Æ’Ë† Ã¬Â¤â€˜Ã¬â€¹Â¬)',
    finalChorusMax: 4,
    chorusLines: '2-3Ã¬Â¤â€ž',
    special: 'ÃªÂ°â‚¬Ã¬â€šÂ¬ ÃªÂ±Â°Ã¬ÂËœ Ã¬â€”â€ Ã¬ÂÅ’! Ã¬Â§Â§Ã¬Ââ‚¬ Ã­â€ºâ€žÃ«Â Â´ Ã«ËœÂÃ«Å â€ Ã­â€”Ë†Ã«Â°ÂÃ«Â§Å’! "hmm...", "yeah..." ÃªÂ°â„¢Ã¬Ââ‚¬ Ã¬ÂµÅ“Ã¬â€ Å’ Ã«Â³Â´Ã¬Â»Â¬! Ã«Â¶â€žÃ¬Å“â€žÃªÂ¸Â° Ã¬Â¤â€˜Ã¬â€¹Â¬!'
  },
  
  // Ã°Å¸Å’Å¸ Ã¬Å Â¤Ã­Å½ËœÃ¬â€¦Å“ Ã¬â€”ÂÃ«â€â€Ã¬â€¦Ëœ
  europop: {
    name: 'ABBA Ã¬Å Â¤Ã­Æ’â‚¬Ã¬ÂÂ¼ Ã¬Å“Â Ã«Â¡Å“Ã­Å’Â',
    syllableRule: '3-5Ã¬ÂÅ’Ã¬Â Ë† (Ã«â€¹Â¤Ã¬Â¸Âµ Ã­â„¢â€Ã¬ÂÅ’ Ã¬Å“Â Ã«Ââ€ž)',
    finalChorusMax: 9,
    chorusLines: '6-7Ã¬Â¤â€ž',
    special: 'Ã¬â€šÂ¬Ã¬Å¡Â´Ã«â€œÅ“Ã¬ÂËœ Ã«Â²Â½! Ã«â€œÅ“Ã«ÂÂ¼Ã«Â§Ë†Ã­â€¹Â±Ã­â€¢Å“ Ã¬Â â€žÃªÂ°Å“Ã¬â„¢â‚¬ Ã­â€™ÂÃ«Â¶â‚¬Ã­â€¢Å“ Ã­â„¢â€Ã¬ÂÅ’'
  },
  metal: {
    name: 'Ã¬â€¹Â¬Ã­ÂÂ¬Ã«â€¹â€°/ÃªÂ³Â Ã«â€â€¢ Ã«Â©â€Ã­Æ’Ë†',
    syllableRule: '3-5Ã¬ÂÅ’Ã¬Â Ë†',
    finalChorusMax: 9,
    chorusLines: '6-7Ã¬Â¤â€ž',
    special: 'Ã¬ËœÂ¤Ã­Å½ËœÃ«ÂÂ¼Ã­â€¹Â± Ã«Â³Â´Ã¬Â»Â¬, ÃªÂ±Â°Ã«Å’â‚¬Ã­â€¢Å“ Ã¬â€¹Â¬Ã­ÂÂ¬Ã«â€¹â€° Ã­â€¢Â©Ã¬Â°Â½Ã«â€¹Â¨'
  },
  
  // Ã°Å¸Å’Â ÃªÂ¸â‚¬Ã«Â¡Å“Ã«Â²Å’ Ã­Å¾Ë†Ã­Å Â¸ Ã­Å’Â©
  hip_hop_boom_bap: {
    name: 'Hip-Hop Boom Bap',
    syllableRule: '7-12Ã¬ÂÅ’Ã¬Â Ë† (Ã¬Å“Â Ã«Ââ„¢Ã¬Â Â)',
    finalChorusMax: 10,
    chorusLines: '4-6Ã¬Â¤â€ž (Hook)',
    special: 'End Rhyme Ã­â€¢â€žÃ¬Ë†Ëœ (AABB/ABAB), Internal Rhyme ÃªÂ¶Å’Ã¬Å¾Â¥, Ã«Âªâ€¦Ã­â„¢â€¢Ã­â€¢Å“ Ã«Â°Å“Ã¬ÂÅ’, 90s ÃªÂ³Â¨Ã«â€œÂ  Ã¬â€”ÂÃ¬ÂÂ´Ã¬Â§â‚¬ Ã«Â°â€Ã¬ÂÂ´Ã«Â¸Å’'
  },
  trap_melodic: {
    name: 'Melodic Trap',
    syllableRule: '7-12Ã¬ÂÅ’Ã¬Â Ë† (Triplet flow)',
    finalChorusMax: 8,
    chorusLines: '4-6Ã¬Â¤â€ž',
    special: 'Auto-Tune Ã«Â©Å“Ã«Â¡Å“Ã«â€â€¢ Ã«Å¾Â©, 3Ã¬â€”Â°Ã¬ÂÅ’ Ã­â„¢Å“Ã¬Å¡Â©, ÃªÂ°ÂÃ¬â€žÂ±Ã¬Â Â Ã¬Â â€žÃ«â€¹Â¬, Ã«â€¦Â¸Ã«Å¾Ëœ+Ã«Å¾Â© Ã­ËœÂ¼Ã­â€¢Â©'
  },
  funk_pop: {
    name: 'Funk Pop',
    syllableRule: '5-10Ã¬ÂÅ’Ã¬Â Ë† (Ã¬Å¾ÂÃ¬Å“Â Ã«Â¡Å“Ã¬â€ºâ‚¬)',
    finalChorusMax: 10,
    chorusLines: '6-8Ã¬Â¤â€ž',
    special: 'Syncopation Ã¬Â¤â€˜Ã¬Å¡â€, Call-and-Response ÃªÂµÂ¬Ã¬Â¡Â°, ÃªÂ·Â¸Ã«Â£Â¨Ã«Â¹â€žÃ­â€¢Å“ Ã«Â²Â Ã¬ÂÂ´Ã¬Å Â¤Ã«ÂÂ¼Ã¬ÂÂ¸, Ã«Â¸Å’Ã«ÂÂ¼Ã¬Å Â¤ Ã¬â€žÂ¹Ã¬â€¦Ëœ'
  },
  reggaeton: {
    name: 'Reggaeton',
    syllableRule: '7-12Ã¬ÂÅ’Ã¬Â Ë† (Ã«Å¾ËœÃ­â€¢â€˜ Ã¬Å Â¤Ã­Æ’â‚¬Ã¬ÂÂ¼)',
    finalChorusMax: 8,
    chorusLines: '4-6Ã¬Â¤â€ž (Hook)',
    special: 'Dembow rhythm (3+3+2), Hook Ã¬ÂµÅ“Ã¬â€ Å’ 3Ã­Å¡Å’ Ã«Â°ËœÃ«Â³Âµ Ã­â€¢â€žÃ¬Ë†Ëœ, Ã«Å¾ËœÃ­â€¢â€˜+Ã«â€¦Â¸Ã«Å¾Ëœ Ã­ËœÂ¼Ã­â€¢Â©, Ã«ÂÂ¼Ã­â€¹Â´ Ã«Â°â€Ã¬ÂÂ´Ã«Â¸Å’'
  },
  future_bass: {
    name: 'Future Bass',
    syllableRule: '4-8Ã¬ÂÅ’Ã¬Â Ë† (Ã¬Â§Â§ÃªÂ²Å’)',
    finalChorusMax: 6,
    chorusLines: '3-5Ã¬Â¤â€ž',
    special: 'Vocal chops ÃªÂ³Â Ã«Â Â¤, ÃªÂ·Â¹Ã«Ââ€žÃ«Â¡Å“ Ã¬Â§Â§Ã¬Ââ‚¬ ÃªÂµÂ¬Ã¬Â Ë†, DropÃ¬Ââ‚¬ Ã«Â³Â´Ã¬Â»Â¬ Ã¬ÂµÅ“Ã¬â€ Å’, ÃªÂ°ÂÃ¬â€žÂ±Ã¬Â Â Ã¬â€”ÂÃ«â€žË†Ã¬Â§â‚¬'
  },
  indie_pop: {
    name: 'Indie Pop (Bedroom Pop)',
    syllableRule: '3-10Ã¬ÂÅ’Ã¬Â Ë† (Ã¬Å¾ÂÃ¬Å“Â Ã«Â¡Å“Ã¬â€ºâ‚¬)',
    finalChorusMax: 8,
    chorusLines: '4-6Ã¬Â¤â€ž',
    special: 'Ã¬Â§â€žÃ¬â€ â€Ã­â€¢Â¨ÃªÂ³Â¼ Ã¬Â·Â¨Ã¬â€¢Â½Ã­â€¢Â¨, Lo-fi ÃªÂ°ÂÃ¬â€žÂ±, Ã«Â¹â€žÃ¬Â â€žÃ­â€ ÂµÃ¬Â Â ÃªÂµÂ¬Ã¬Â¡Â° ÃªÂ°â‚¬Ã«Å Â¥, Spoken-wordÃ¬Â²ËœÃ«Å¸Â¼ Ã¬Å¾ÂÃ¬â€”Â°Ã¬Å Â¤Ã«Å¸Â½ÃªÂ²Å’'
  }
};

// =====================================
// 토큰 최대 출력 설정 (v12.2.1 - 대폭 상향!)
// =====================================
function getMaxOutputTokens(genre, structure, abModeActive) {
  let tokens = 5000; // ⭐ 기본값 대폭 상향! (3000 → 5000)
  
  // 장르별 조정
  if (genre === 'lofi_hiphop') tokens = 1500;  // 900 → 1500
  else if (genre === 'future_bass') tokens = 2000;  // 1500 → 2000
  else if (structure === 'short') tokens = 3500;  // 2200 → 3500
  else if (structure === 'extended') tokens = 6500;  // 3800 → 6500
  
  // ⭐⭐ A/B 모드 보너스 대폭 증가! (완성률 100% 보장!)
  if (abModeActive) {
    tokens += 1000; // A/B 모드에서 +1000 토큰 추가
  }
  
  return tokens;
}


// =====================================
// ìž¥ë¥´ë³„ ìµœì  ì˜¨ë„(Temperature) ì„¤ì • (v11.8 ì¶”ê°€)
// =====================================
function getTemperature(genre) {
  // ðŸŽ¯ ê·œì¹™ ì—„ìˆ˜í˜• (0.3 ~ 0.4): 8ëŒ€ ì›ì¹™ ì—„ìˆ˜ê°€ ìµœìš°ì„ 
  const strictGenres = ['pop80s', 'trot', 'ballad', 'acoustic_folk', 'lofi_hiphop'];
  if (strictGenres.includes(genre)) return 0.4;
  
  // ðŸŽµ ë¦¬ë“¬/ê°ì„± ì¡°ì ˆí˜• (0.5 ~ 0.6): ê·œì¹™ + ì„¸ë ¨ë¯¸
  const balancedGenres = ['rnb', 'rock_ballad', 'city_pop', 'hip_hop_boom_bap'];
  if (balancedGenres.includes(genre)) return 0.5;
  
  // ðŸ”¥ ì°½ì˜ì„± í­ë°œí˜• (0.7 ~ 0.8): ì¤‘ë…ì„± ìžˆëŠ” í›„í¬ ì°½ìž‘
  const creativeGenres = ['kpop_dance', 'funk_pop', 'reggaeton', 'trap_melodic', 'future_bass', 'indie_pop', 'europop', 'metal'];
  if (creativeGenres.includes(genre)) return 0.7;
  
  // ê¸°ë³¸ê°’ (ë°œë¼ë“œ ê³„ì—´ ê¸°ì¤€)
  return 0.4;
}

module.exports = async (req, res) => {
  // CORS Ã­â€”Â¤Ã«Ââ€ Ã¬â€žÂ¤Ã¬Â â€¢ (v11.4 Ã«Â³Â´Ã¬â€¢Ë† ÃªÂ°â€¢Ã­â„¢â€)
  // Ã¢Â­Â Ã«Â³Â´Ã¬â€¢Ë† ÃªÂ°Å“Ã¬â€žÂ : Ã­Å Â¹Ã¬Â â€¢ Ã«Ââ€žÃ«Â©â€Ã¬ÂÂ¸Ã«Â§Å’ Ã­â€”Ë†Ã¬Å¡Â©
  const allowedOrigins = [
    'https://suno-helper-backend.vercel.app',
    'http://localhost:3000', // Ã«Â¡Å“Ã¬Â»Â¬ Ã­â€¦Å’Ã¬Å Â¤Ã­Å Â¸Ã¬Å¡Â© (Ã¬â€žÂ Ã­Æ’Â)
    'http://localhost:5000'  // Ã«Â¡Å“Ã¬Â»Â¬ Ã­â€¦Å’Ã¬Å Â¤Ã­Å Â¸Ã¬Å¡Â© (Ã¬â€žÂ Ã­Æ’Â)
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Ã­â€”Ë†Ã¬Å¡Â©Ã«ÂËœÃ¬Â§â‚¬ Ã¬â€¢Å Ã¬Ââ‚¬ Ã«Ââ€žÃ«Â©â€Ã¬ÂÂ¸Ã¬Ââ‚¬ ÃªÂ¸Â°Ã«Â³Â¸ÃªÂ°â€™
    res.setHeader('Access-Control-Allow-Origin', 'https://suno-helper-backend.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Ã¢Â­Â Ã«Â³Â´Ã¬â€¢Ë† Ã­â€”Â¤Ã«Ââ€ Ã¬Â¶â€ÃªÂ°â‚¬ (v11.5)
  res.setHeader('X-Content-Type-Options', 'nosniff'); // MIME Ã­Æ’â‚¬Ã¬Å¾â€¦ Ã¬Å Â¤Ã«â€¹Ë†Ã­â€¢â€˜ Ã«Â°Â©Ã¬Â§â‚¬
  res.setHeader('X-Frame-Options', 'DENY'); // Ã­ÂÂ´Ã«Â¦Â­Ã¬Å¾Â¬Ã­â€šÂ¹ Ã«Â°Â©Ã¬Â§â‚¬
  res.setHeader('X-XSS-Protection', '1; mode=block'); // XSS ÃªÂ³ÂµÃªÂ²Â© Ã«Â°Â©Ã¬Â§â‚¬
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // HTTPS ÃªÂ°â€¢Ã¬Â Å“

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ã¢Â­Â Ã¬Å¡â€Ã¬Â²Â­ Ã­ÂÂ¬ÃªÂ¸Â° Ã¬Â Å“Ã­â€¢Å“ (v11.5 - DDoS/Ã­ÂÂ­Ã­Æ’â€ž Ã¬Å¡â€Ã¬Â²Â­ Ã«Â°Â©Ã¬Â§â‚¬)
    const MAX_PAYLOAD_SIZE = 102400; // 100KB (10KB Ã¢â€ â€™ 100KBÃ«Â¡Å“ Ã«Â³â‚¬ÃªÂ²Â½!)
    const payloadSize = JSON.stringify(req.body).length;
    
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      return errorResponse(
        res,
        413,
        'Ã¬Å¡â€Ã¬Â²Â­ Ã­ÂÂ¬ÃªÂ¸Â°ÃªÂ°â‚¬ Ã«â€žË†Ã«Â¬Â´ Ã­ÂÂ½Ã«â€¹Ë†Ã«â€¹Â¤. Ã¬Å¾â€¦Ã«Â Â¥ÃªÂ°â€™Ã¬Ââ€ž Ã¬Â¤â€žÃ¬â€”Â¬Ã¬Â£Â¼Ã¬â€žÂ¸Ã¬Å¡â€.',
        'PAYLOAD_TOO_LARGE',
        false
      );
    }

    // Rate Limiting Ã¬Â²Â´Ã­ÂÂ¬ (v11.6 - Vercel KV)
    const xff = req.headers['x-forwarded-for'];
    const clientIP = xff 
      ? (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim()
      : (req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown');
    await checkRateLimit(clientIP); // Ã¢Â­Â Vercel KVÃ«Å â€ async!

    // Ã¢Å“â€¦ Ã¬Å¾â€¦Ã«Â Â¥ ÃªÂ²â‚¬Ã¬Â¦Â (v11.1 Ã¬Â¶â€ÃªÂ°â‚¬)
    validateInput(req.body);

    const {
      userApiKey,
      modelName,
      keyword,
      genre,
      structure,
      vocalModifier,
      genreFusionModifier,
      vocalConfigModifier,
      emotionIntensityModifier,
      moodModifier,
      autoChorusVariation,
      sectionVerse,
      sectionPrechorus,
      sectionChorus,
      sectionBridge,
      sectionFinal,
      sectionOutro,
      abModeActive
    } = req.body;

    // Ã¬Å¾Â¥Ã«Â¥Â´ Ã¬â€žÂ¤Ã¬Â â€¢ ÃªÂ°â‚¬Ã¬Â Â¸Ã¬ËœÂ¤ÃªÂ¸Â°
    const genreConfig = GENRE_CONFIGS[genre] || GENRE_CONFIGS['pop80s'];

    // Ã¢Ëœâ€¦Ã¢Ëœâ€¦Ã¢Ëœâ€¦ ÃªÂµÂ¬Ã¬Â¡Â°Ã«Â³â€ž Ã­Æ’â‚¬Ã¬Å¾â€žÃ«ÂÂ¼Ã¬ÂÂ¸ Ã¢Ëœâ€¦Ã¢Ëœâ€¦Ã¢Ëœâ€¦
    const STRUCTURE_TIMELINES = {
      'standard': { info: '3:40 (Ã­â€˜Å“Ã¬Â¤â‚¬)', intro: '0:08', v1: '0:28', pre1: '0:16', c1: '0:32', break: '0:15', v2: '0:28', pre2: '0:16', c2: '0:32', bridge: '0:24', build: '0:12', final: '0:37', outro: '0:12' },
      'short': { info: '2:30 (Ã¬â€¡Â¼Ã¬Â¸Â )', intro: '0:05', v1: '0:22', pre1: '0:12', c1: '0:28', break: '0:00', v2: '0:00', pre2: '0:12', c2: '0:28', bridge: '0:18', build: '0:08', final: '0:30', outro: '0:07' },
      'extended': { info: '4:30 (Ã­â€™â‚¬Ã«Â²â€žÃ¬Â â€ž)', intro: '0:12', v1: '0:32', pre1: '0:18', c1: '0:36', break: '0:20', v2: '0:32', pre2: '0:18', c2: '0:36', bridge: '0:28', build: '0:15', final: '0:42', outro: '0:15' }
    };

    // Ã¢Ëœâ€¦Ã¢Ëœâ€¦Ã¢Ëœâ€¦ Ã¬Å¾Â¥Ã«Â¥Â´Ã«Â³â€ž Ã¬â„¢â€žÃ¬Â â€ž Ã«Â§Å¾Ã¬Â¶Â¤ Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸ Ã¬Æ’ÂÃ¬â€žÂ± Ã¢Ëœâ€¦Ã¢Ëœâ€¦Ã¢Ëœâ€¦
    let lyricsPrompt = '';

    // === MZ Ã¬â€¡Â¼Ã¬Â¸Â  Ã­Å’Â© ===
    if (genre === 'kpop_dance') {
      lyricsPrompt = generateKPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'lofi_hiphop') {
      lyricsPrompt = generateLofiPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier);
    } else if (genre === 'city_pop') {
      lyricsPrompt = generateCityPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } 
    // === ÃªÂ¸â‚¬Ã«Â¡Å“Ã«Â²Å’ Ã­Å¾Ë†Ã­Å Â¸ Ã­Å’Â© ===
    else if (genre === 'hip_hop_boom_bap') {
      lyricsPrompt = generateHipHopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'trap_melodic') {
      lyricsPrompt = generateTrapPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'funk_pop') {
      lyricsPrompt = generateFunkPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'reggaeton') {
      lyricsPrompt = generateReggaetonPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'future_bass') {
      lyricsPrompt = generateFutureBassPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'indie_pop') {
      lyricsPrompt = generateIndiePopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } 
    // === Ã«Â°Å“Ã«ÂÂ¼Ã«â€œÅ“ ÃªÂ³â€žÃ¬â€”Â´ (ÃªÂ¸Â°Ã«Â³Â¸ ÃªÂ³ÂµÃ¬â€¹Â) ===
    else {
      lyricsPrompt = generateBalladPrompt(
        keyword, 
        genre, 
        genreConfig, 
        STRUCTURE_TIMELINES[structure], 
        vocalModifier, 
        genreFusionModifier,
        vocalConfigModifier,
        emotionIntensityModifier,
        moodModifier,
        autoChorusVariation,
        sectionVerse,
        sectionPrechorus,
        sectionChorus,
        sectionBridge,
        sectionFinal,
        sectionOutro,
        abModeActive
      );
    }

    // Gemini API Ã­ËœÂ¸Ã¬Â¶Å“ (v11.3 ÃªÂ°Å“Ã¬â€žÂ : Ã­â€”Â¤Ã«Ââ€ Ã«Â°Â©Ã¬â€¹Â + Ã­â€ Â Ã­ÂÂ° Ã¬Å¾ÂÃ«Ââ„¢ Ã¬Â¡Â°Ã¬Â Ë†)
    const model = modelName || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const payload = {
      contents: [{ parts: [{ text: lyricsPrompt }] }],
      generationConfig: {
        temperature: getTemperature(genre), // â­ ìž¥ë¥´ë³„ ìµœì  ì˜¨ë„ (v11.8)
        topK: 40,
        topP: 0.95,
        maxOutputTokens: getMaxOutputTokens(genre, structure, abModeActive) // Ã¢Â­Â Ã¬Å¾Â¥Ã«Â¥Â´/ÃªÂµÂ¬Ã¬Â¡Â°Ã«Â³â€ž Ã¬Å¾ÂÃ«Ââ„¢ Ã¬Â¡Â°Ã¬Â Ë†
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': userApiKey // Ã¢Â­Â URLÃ¬ÂÂ´ Ã¬â€¢â€žÃ«â€¹Å’ Ã­â€”Â¤Ã«Ââ€Ã«Â¡Å“ Ã¬Â â€žÃ¬â€ Â¡ (Ã«Â³Â´Ã¬â€¢Ë† Ã­â€“Â¥Ã¬Æ’Â)
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Gemini API Error: ${response.status} - ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const rawLyrics = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Ã¬Æ’ÂÃ¬â€žÂ± Ã¬â€¹Â¤Ã­Å’Â¨';
    const lyrics = enforceNoHyphens(rawLyrics);

    return res.status(200).json({ lyrics });

  } catch (error) {
    console.error('Error:', error);
    
    // Ã¢Å“â€¦ Ã¬â€”ÂÃ«Å¸Â¬ Ã­Æ’â‚¬Ã¬Å¾â€¦Ã«Â³â€ž Ã¬Ââ€˜Ã«â€¹Âµ (v11.1 ÃªÂ°Å“Ã¬â€žÂ )
    
    // 1. Ã¬Å¾â€¦Ã«Â Â¥ ÃªÂ²â‚¬Ã¬Â¦Â Ã¬â€”ÂÃ«Å¸Â¬
    if (error.code === 'VALIDATION_ERROR') {
      return errorResponse(res, 400, error.message, 'VALIDATION_ERROR', false);
    }
    
    // 2. Rate Limit Ã¬â€”ÂÃ«Å¸Â¬
    if (error.message.includes('Too many requests')) {
      return errorResponse(res, 429, error.message, 'RATE_LIMIT_EXCEEDED', true);
    }
    
    // 3. Gemini API Ã¬â€”ÂÃ«Å¸Â¬
    if (error.message.includes('Gemini API Error')) {
      const isRetryable = error.message.includes('429') || error.message.includes('503');
      return errorResponse(
        res, 
        500, 
        'Gemini API Ã­ËœÂ¸Ã¬Â¶Å“Ã¬â€”Â Ã¬â€¹Â¤Ã­Å’Â¨Ã­â€“Ë†Ã¬Å ÂµÃ«â€¹Ë†Ã«â€¹Â¤. API Ã­â€šÂ¤Ã«Â¥Â¼ Ã­â„¢â€¢Ã¬ÂÂ¸Ã­â€¢ËœÃªÂ±Â°Ã«â€šËœ Ã¬Å¾Â Ã¬â€¹Å“ Ã­â€ºâ€ž Ã«â€¹Â¤Ã¬â€¹Å“ Ã¬â€¹Å“Ã«Ââ€žÃ­â€¢Â´Ã¬Â£Â¼Ã¬â€žÂ¸Ã¬Å¡â€.', 
        'GEMINI_API_ERROR', 
        isRetryable
      );
    }
    
    // 4. ÃªÂ¸Â°Ã­Æ’â‚¬ Ã¬â€žÅ“Ã«Â²â€ž Ã¬â€”ÂÃ«Å¸Â¬
    return errorResponse(
      res, 
      500, 
      'Ã¬â€žÅ“Ã«Â²â€ž Ã¬ËœÂ¤Ã«Â¥ËœÃªÂ°â‚¬ Ã«Â°Å“Ã¬Æ’ÂÃ­â€“Ë†Ã¬Å ÂµÃ«â€¹Ë†Ã«â€¹Â¤. Ã¬Å¾Â Ã¬â€¹Å“ Ã­â€ºâ€ž Ã«â€¹Â¤Ã¬â€¹Å“ Ã¬â€¹Å“Ã«Ââ€žÃ­â€¢Â´Ã¬Â£Â¼Ã¬â€žÂ¸Ã¬Å¡â€.', 
      'SERVER_ERROR', 
      true
    );
  }
};

// =====================================
// K-Pop Ã«Å’â€žÃ¬Å Â¤ Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateKPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI K-Pop Dance Lab" - elite K-Pop songwriting system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate K-Pop Dance lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ K-POP DANCE RULES (CRITICAL!):

1Ã¯Â¸ÂÃ¢Æ’Â£ **HOOK REPETITION** (Most important!):
   - Create ADDICTIVE 2-3 syllable hook (Ã¬ËœË†: "Ã«â€šËœÃ«â€šËœÃ«â€šËœ", "Ã¬ËœË†Ã¬ËœË†Ã¬ËœË†", "Ã¬ËœÂ¤Ã¬ËœÂ¤Ã¬ËœÂ¤")
   - Repeat hook 4-6 times in EVERY chorus
   - Hook should be catchy and easy to sing along
   - Examples: "Ã«â€˜ÂÃªÂ·Â¼Ã«â€˜ÂÃªÂ·Â¼", "Ã«Â°ËœÃ¬Â§ÂÃ«Â°ËœÃ¬Â§Â", "Ã«Â¹â„¢ÃªÂ¸â‚¬Ã«Â¹â„¢ÃªÂ¸â‚¬"

2Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE FREEDOM** (No 3-5 limit!):
   - Verse/Pre-Chorus: Any syllable count OK for rhythm
   - Chorus: Focus on rhythmic repetition, not syllable limits
   - Final Chorus: Up to **12 lines** allowed (not 8!)
   - More lines = more energy!

3Ã¯Â¸ÂÃ¢Æ’Â£ **RHYTHM OVER MELODY**:
   - K-Pop is rhythm-first, NOT melody-first
   - Use percussive words: "Ã­Æ’ÂÃ­Æ’ÂÃ­Æ’Â", "Ã¬Â¿ÂµÃ¬Â¿ÂµÃ¬Â¿Âµ"
   - Short bursts of energy better than long melodic lines

4Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): 1-2 lines (or just hook!)
   - Verse 1 (${timeline.v1}): **4-6 lines** (free syllables)
   - Pre-Chorus (${timeline.pre1}): **2-4 lines** (build energy!)
   - Chorus 1 (${timeline.c1}): **6-8 lines** (HOOK REPEAT!)
   ${timeline.break !== '0:00' ? `- Dance Break (${timeline.break}): (no lyrics or just hook!)` : ''}
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6 lines**` : ''}
   - Pre-Chorus (${timeline.pre2}): **2-4 lines**
   - Chorus 2 (${timeline.c2}): **6-8 lines** (HOOK VARIATION!)
   - Bridge (${timeline.bridge}): **4 lines** (slower moment)
   - Dance Break Build (${timeline.build}): (just hook or "Let's go!")
   - Final Chorus (${timeline.final}): **8-12 lines** (MAX ENERGY!)
   - Outro (${timeline.outro}): 1-2 lines (hook fade)

5Ã¯Â¸ÂÃ¢Æ’Â£ **CHORUS VARIATION** (MUST!):
   ${autoChorusVariation || abModeActive ? `
   - Chorus 1, 2, Final MUST have different verses
   - Keep ONLY the hook the same
   - Change the rap-like verses around the hook
   - Example:
     * Chorus 1: "verse1 / Ã«â€šËœÃ«â€šËœÃ«â€šËœ Ã«â€šËœÃ«â€šËœÃ«â€šËœ / verse2 / Ã«â€šËœÃ«â€šËœÃ«â€šËœ Ã«â€šËœÃ«â€šËœÃ«â€šËœ"
     * Chorus 2: "DIFFERENT1 / Ã«â€šËœÃ«â€šËœÃ«â€šËœ Ã«â€šËœÃ«â€šËœÃ«â€šËœ / DIFFERENT2 / Ã«â€šËœÃ«â€šËœÃ«â€šËœ Ã«â€šËœÃ«â€šËœÃ«â€šËœ"
   ` : `
   - Hook stays the same
   - Verses can vary slightly
   `}

6Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY** (K-Pop style):
   - (tight idol harmonies) in all choruses
   - (power vocals) in Final Chorus
   - NO counterpoint ad-libs (they break K-Pop rhythm!)
   - Korean ad-libs OK: (yeah!), (let's go!), (come on!)

7Ã¯Â¸ÂÃ¢Æ’Â£ **NO BALLAD VIBES**:
   - NO tildes (~) for long notes
   - NO slow vibrato
   - Fast, energetic, percussive!

8Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Heavy synth-bass drop, EDM build-up)
   - [Verse 1]: (Minimal beat, synth stabs, clear vocals)
   - [Pre-Chorus]: (Energy rising, drums building, tension)
   - [Chorus]: (Full EDM drop, heavy bass, synth lead, powerful beat)
   - [Dance Break]: (Instrumental, heavy bass, no vocals)
   - [Bridge]: (Stripped down, just synth pad and vocal)
   - [Dance Break Build]: (Building intensity, risers, tension)
   - **[Key change up]** Ã¢â€ Â MANDATORY TAG!
   - [Final Chorus]: (Maximum energy, all instruments, vocal power)

9Ã¯Â¸ÂÃ¢Æ’Â£ **OUTPUT FORMAT**:
   - Title: "Ã¬Â Å“Ã«ÂªÂ©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts (3), (4), (5) in output!
   - NO delivery notes [energetic delivery] in output!
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics! K-Pop uses rhythm, not long notes.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ K-POP CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ 2-3 syllable hook created?
Ã¢â€“Â¡ Hook repeated 4-6 times per chorus?
Ã¢â€“Â¡ Final Chorus 8-12 lines?
Ã¢â€“Â¡ Rhythm-focused, not melody-focused?
Ã¢â€“Â¡ NO tildes (~)?
Ã¢â€“Â¡ Chorus variation (if enabled)?
Ã¢â€“Â¡ Clean output (no annotations)?

Ã°Å¸Å½Âµ Generate K-Pop Dance lyrics now!
  `;
}

// =====================================
// Ã«Â¡Å“Ã­Å’Å’Ã¬ÂÂ´ Ã­Å¾â„¢Ã­â€¢Â© Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateLofiPrompt(keyword, config, timeline, vocalModifier) {
  return `
You are "Suno AI Lo-fi Lab" - minimalist Lo-fi hip-hop system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate Lo-fi Hip-hop lyrics for "${keyword}"
Structure: ${timeline.info}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ LO-FI RULES (MINIMAL VOCALS!):

1Ã¯Â¸ÂÃ¢Æ’Â£ **MINIMAL LYRICS** (Most important!):
   - This is INSTRUMENTAL-FOCUSED music!
   - Very few lyrics - mostly humming/vocalizations
   - Examples: "hmm...", "yeah...", "uh...", "ah..."
   - Keep it chill and atmospheric

2Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): (no lyrics - just instrumental)
   - Verse 1 (${timeline.v1}): **1-2 lines MAX** (soft spoken)
   - Chorus (${timeline.c1}): **2-3 lines** (humming or minimal words)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **1-2 lines MAX**` : ''}
   - Chorus 2 (${timeline.c2}): **2-3 lines** (same or slight variation)
   - Bridge (${timeline.bridge}): **1-2 lines** (whispered)
   - Final Chorus (${timeline.final}): **3-4 lines MAX** (fade out)
   - Outro (${timeline.outro}): (no lyrics - instrumental fade)

3Ã¯Â¸ÂÃ¢Æ’Â£ **VOCAL STYLE**:
   - Spoken/whispered, NOT sung
   - Soft, breathy, intimate
   - Example: "Ã«Â¹â€”Ã¬â€ Å’Ã«Â¦Â¬... Ã¬Â°Â½Ã«Â¬Â¸Ã¬â€”Â... Ã«Â©ÂÃ­â€¢ËœÃ«â€¹Ë†..."
   - NO powerful vocals, NO belting

4Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY**:
   - NO harmonies needed
   - Just soft, single voice
   - Or just humming: "hmm... hmm..."

5Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Jazzy piano loop, vinyl crackle, dusty atmosphere)
   - [Verse 1]: (Soft boom bap drums enter, mellow piano)
   - [Chorus]: (Bass adds gentle groove, atmospheric pads)
   - [Bridge]: (Piano solo, minimal drums)
   - [Instrumental Build]: (Gentle build, subtle layers)
   - **[Key change up]** Ã¢â€ Â Optional for lo-fi
   - [Final Chorus]: (All elements, but still chill and mellow)
   - [Outro]: (Piano fades, vinyl crackle remains)

6Ã¯Â¸ÂÃ¢Æ’Â£ **OUTPUT FORMAT**:
   - Very short output!
   - Most sections have NO lyrics (instrumental)
   - Only a few soft spoken/hummed lines total
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics!

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ LO-FI CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ Minimal lyrics (under 20 lines total)?
Ã¢â€“Â¡ Soft spoken/whispered style?
Ã¢â€“Â¡ Lots of instrumental sections?
Ã¢â€“Â¡ Chill vibe maintained?

Ã°Å¸Å½Âµ Generate Lo-fi Hip-hop lyrics now!
  `;
}

// =====================================
// Ã¬â€¹Å“Ã­â€¹Â°Ã­Å’Â Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateCityPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI City Pop Lab" - retro 80s City Pop system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate City Pop lyrics for "${keyword}"
Structure: ${timeline.info}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ CITY POP RULES:

1Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE RULE** (4-6 syllables, relaxed groove):
   - Verse/Pre-Chorus: 4-6 syllables (more relaxed than ballad)
   - Chorus: 4-6 syllables (smooth, not choppy)
   - Final Chorus: **10 lines MAX**

2Ã¯Â¸ÂÃ¢Æ’Â£ **VIBE** (Urban nostalgia, NOT sadness):
   - Focus on city lights, late nights, coffee, jazz bars
   - Romantic but NOT tragic
   - Breezy, sophisticated, feel-good
   - Examples: "Ã«â€žÂ¤Ã¬ËœÂ¨ Ã«Â¶Ë†Ã«Â¹â€º", "Ã¬Å¾Â¬Ã¬Â¦Ë† Ã¬Â¹Â´Ã­Å½Ëœ", "Ã«Ââ€žÃ¬â€¹Å“Ã¬ÂËœ Ã«Â°Â¤", "Ã­â€¦â€¦ Ã«Â¹Ë† ÃªÂ±Â°Ã«Â¦Â¬"

3Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): 2 lines
   - Verse 1 (${timeline.v1}): **4 lines**
   - Pre-Chorus (${timeline.pre1}): **2 lines**
   - Chorus 1 (${timeline.c1}): **6-7 lines**
   ${timeline.break !== '0:00' ? `- Instrumental Break (${timeline.break}): (saxophone or synth solo)` : ''}
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4 lines**` : ''}
   - Pre-Chorus (${timeline.pre2}): **2 lines**
   - Chorus 2 (${timeline.c2}): **6-7 lines**
   - Bridge (${timeline.bridge}): **4 lines**
   - Instrumental Build (${timeline.build}): (funky bass, building tension)
   - Final Chorus (${timeline.final}): **8-10 lines**
   - Outro (${timeline.outro}): 2 lines

4Ã¯Â¸ÂÃ¢Æ’Â£ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Chorus 1, 2, Final MUST vary
   - Keep 1 anchor line the same
   - Change the rest with different urban imagery
   ` : `
   - Some variation recommended for sophistication
   `}

5Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY** (Jazzy, smooth):
   - (smooth jazz harmonies) in choruses
   - ${abModeActive ? '2-3' : '1-2'} English ad-libs: (city lights), (midnight drive)
   - (voices blend) in Final Chorus

6Ã¯Â¸ÂÃ¢Æ’Â£ **TILDES** (Moderate use):
   - Use ~ for smooth sustained notes
   - But NOT as much as ballads
   - Distribution: Verse (minimal) Ã¢â€ â€™ Chorus (moderate)

7Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Shimmering synth arpeggio, funky bass line)
   - [Verse 1]: (Clean electric guitar, soft drums, intimate vocal)
   - [Pre-Chorus]: (Synth layers build, bass groove intensifies)
   - [Chorus]: (Full 80s production, shimmering synths, funky bass, breezy vocals)
   - [Instrumental Break]: (Saxophone solo over funky groove)
   - [Bridge]: (Stripped to synth pad and vocal)
   - [Instrumental Build]: (Funky bass, synth arpeggios, building tension)
   - **[Key change up]** Ã¢â€ Â MANDATORY TAG!
   - [Final Chorus]: (Maximum 80s polish, all synth layers, warm analog sound)

8Ã¯Â¸ÂÃ¢Æ’Â£ **OUTPUT FORMAT**:
   - NO syllable counts in output!
   - NO delivery notes in output!
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics! Use "~" for smooth sustained notes.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ CITY POP CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ 4-6 syllables per line?
Ã¢â€“Â¡ Final Chorus 10 lines max?
Ã¢â€“Â¡ Urban/romantic vibe (not tragic)?
Ã¢â€“Â¡ Smooth, jazzy feel?
Ã¢â€“Â¡ Chorus variation?

Ã°Å¸Å½Âµ Generate City Pop lyrics now!
  `;
}

// =====================================
// Ã«Â°Å“Ã«ÂÂ¼Ã«â€œÅ“ ÃªÂ³â€žÃ¬â€”Â´ ÃªÂ¸Â°Ã«Â³Â¸ Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸ (ÃªÂ¸Â°Ã¬Â¡Â´ ÃªÂ³ÂµÃ¬â€¹Â)
// =====================================
function generateBalladPrompt(keyword, genre, config, timeline, vocalModifier, genreFusionModifier, vocalConfigModifier, emotionIntensityModifier, moodModifier, autoChorusVariation, sectionVerse, sectionPrechorus, sectionChorus, sectionBridge, sectionFinal, sectionOutro, abModeActive) {
  
  // ABBA Ã¬Å Â¤Ã­Æ’â‚¬Ã¬ÂÂ¼ Ã­Å Â¹Ã«Â³â€ž Ã¬Â²ËœÃ«Â¦Â¬
  const abbaSpecial = (genre === 'pop80s') ? `
Ã¢Å¡Â Ã¯Â¸Â ABBA STYLE SPECIAL RULES (Wall of Sound):
- Rich, multi-layered MALE AND FEMALE vocal harmonies
- Piano-driven power pop with lush orchestral strings
- Absolutely NO shouting, NO belting - controlled delivery only
- Create "Wall of Sound" with stacked vocals and instruments
- Catchy hooks with unexpected melodic twists
` : '';

  // Ã­Å Â¸Ã«Â¡Å“Ã­Å Â¸ Ã­Å Â¹Ã«Â³â€ž Ã¬Â²ËœÃ«Â¦Â¬
  const trotSpecial = (genre === 'trot') ? `
Ã¢Å¡Â Ã¯Â¸Â TROT SPECIAL RULES:
- Emphasize "han" (Ã¦ÂÂ¨) - deep unresolved sorrow
- Use Korean twist technique (kkeok-gi) in Final Chorus
- Vibrato should be wide and expressive
- Repressed emotion, NOT explosion
- Avoid direct emotion words, use sensory imagery
- Include [Climb] section before Chorus for emotional peak
` : '';

  // Ã­ÂÂ¬Ã­ÂÂ¬ Ã­Å Â¹Ã«Â³â€ž Ã¬Â²ËœÃ«Â¦Â¬
  const folkSpecial = (genre === 'acoustic_folk') ? `
Ã¢Å¡Â Ã¯Â¸Â FOLK SPECIAL RULES:
- Storyteller vibe - conversational, natural phrasing
- Avoid overly poetic language, keep it sincere
- Focus on narrative and personal details
- Simple imagery: "Ã«â€šÂ¡Ã¬Ââ‚¬ ÃªÂ¸Â°Ã­Æ’â‚¬", "Ã«Â¹Ë† Ã¬ÂËœÃ¬Å¾Â", "Ã¬Â°Â¨ÃªÂ°â‚¬Ã¬Å¡Â´ Ã¬Â»Â¤Ã­â€Â¼"
` : '';

  // Ã«Â¡Â Ã«Â°Å“Ã«ÂÂ¼Ã«â€œÅ“ Ã­Å Â¹Ã«Â³â€ž Ã¬Â²ËœÃ«Â¦Â¬
  const rockSpecial = (genre === 'rock_ballad') ? `
Ã¢Å¡Â Ã¯Â¸Â ROCK BALLAD SPECIAL RULES:
- Controlled power - don't scream!
- High note ONLY in Final Chorus (one controlled belt)
- Build intensity gradually from Verse to Final
- Epic orchestral strings in Final Chorus
` : '';

  return `
You are "Suno AI Ballad Mastery Lab" - elite Korean songwriting system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate professional ${config.name} lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€Â¥Ã°Å¸â€Â¥Ã°Å¸â€Â¥ 8Ã«Å’â‚¬ Ã¬â€ºÂÃ¬Â¹â„¢ (Ã¬Â Ë†Ã«Å’â‚¬ Ã¬Â¤â‚¬Ã¬Ë†Ëœ!) Ã°Å¸â€Â¥Ã°Å¸â€Â¥Ã°Å¸â€Â¥
**Ã¢Å¡Â Ã¯Â¸Â Korean vs English = Different Rules!**
Ã¢â€˜Â  Ã­â€¢Å“ÃªÂ¸â‚¬: 3~6Ã¬ÂÅ’Ã¬Â Ë† / English: 8~12Ã¬ÂÅ’Ã¬Â Ë† (Ã¬â€“Â¸Ã¬â€“Â´Ã«Â³â€ž Ã«â€¹Â¤Ã«Â¦â€ž!)
Ã¢â€˜Â¡ Final Chorus 7~8Ã¬Â¤â€ž Ã¬Â Ë†Ã«Å’â‚¬ Ã­â€¢Å“ÃªÂ³â€ž!
Ã¢â€˜Â¢ Ã¬Â½â€Ã«Å¸Â¬Ã¬Å Â¤ Ã¬â„¢â€žÃ¬Â â€ž Ã«Â°ËœÃ«Â³Âµ ÃªÂ¸Ë†Ã¬Â§â‚¬ (Ã¬â€¢ÂµÃ¬Â»Â¤ 1Ã¬Â¤â€žÃ«Â§Å’!)
Ã¢â€˜Â£ Ã«Â©Å“Ã«Â¡Å“Ã«â€â€ Ã«Â³â‚¬Ã­â„¢â€ Ã­â€¢â€žÃ¬Ë†Ëœ!
Ã¢â€˜Â¤ Ã«Â¡Â±Ã­â€ Â¤ Ã­â€¹Â¸Ã«â€œÅ“(~) Ã¬Â â€žÃ«Å¾ÂµÃ¬Â Â Ã«Â°Â°Ã¬Â¹Ëœ! (Ã­â€¢ËœÃ¬ÂÂ´Ã­â€Ë† Ã¬â€¢â€žÃ«â€¹Ëœ!)
Ã¢â€˜Â¥ Ã«Å’â‚¬Ã¬Å“â€žÃ«Â²â€¢ Ã­â€¢â€žÃ¬Ë†Ëœ (Ã¬â€”Â°Ã¬â€ Â ÃªÂ¸Ë†Ã¬Â§â‚¬ + ~( ) ÃªÂ°â„¢Ã¬Ââ‚¬ Ã¬Â¤â€ž ÃªÂ¸Ë†Ã¬Â§â‚¬!)
Ã¢â€˜Â¦ Final Chorus Ã­â„¢â€Ã¬ÂÅ’ 3ÃªÂ²Â¹!
Ã¢â€˜Â§ Ã¬â€¢Â Ã«â€œÅ“Ã«Â¦Â½ 2Ã¬Â¤â€ž Ã¬ÂÂ´Ã­â€¢Ëœ!
**Version Note:** V4.5+ = emotional depth, V5 = precision
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

${abbaSpecial}
${trotSpecial}
${folkSpecial}
${rockSpecial}

Ã°Å¸â€œâ€¹ ABSOLUTE RULES (NEVER VIOLATE):

1Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE RULE** (CRITICAL - Language-specific!):
   
   Ã°Å¸â€¡Â°Ã°Å¸â€¡Â· **KOREAN LYRICS** (3~6 syllables - Natural flow!):
   - **Verse: 3~6 syllables** (7+ = rap delivery!)
   - **Pre-Chorus: 3~5 syllables** (shorter = tension build!)
   - **Chorus: 4~6 syllables** (sweet spot: 5~6)
   - **Bridge: 3~6 syllables**
   - **Final Chorus: 4~7 syllables** (8+ = rap!)
   - **Outro: 2~5 syllables** (shorter = emotional fade)
   - Ã¢Å¡Â Ã¯Â¸Â Korean: 7+ syllables = GUARANTEED rap delivery!
   
   **Korean Examples:**
   Ã¢Å“â€¦ "Ã¬â€ ÂÃ«ÂÂ Ã¬Â°Â¨ÃªÂ°â‚¬Ã¬â€ºÅ’" (4Ã¬ÂÅ’Ã¬Â Ë†)
   Ã¢Å“â€¦ "Ã«ÂÅ’Ã¬â€¢â€žÃªÂ°â‚¬" (3Ã¬ÂÅ’Ã¬Â Ë†)
   Ã¢Å“â€¦ "Ã«â€žË†Ã«Â¬Â´Ã«â€šËœÃ«Ââ€ž ÃªÂ·Â¸Ã«Â¦Â¬Ã¬â€ºÅ’" (6Ã¬ÂÅ’Ã¬Â Ë†) Ã¢â€ Â Perfect!
   Ã¢ÂÅ’ "Ã«â€žË†Ã«Â¬Â´Ã«â€šËœÃ«Ââ€ž Ã«Â³Â´ÃªÂ³Â  Ã¬â€¹Â¶Ã¬â€“Â´Ã¬â€žÅ“" (7Ã¬ÂÅ’Ã¬Â Ë† = Ã«Å¾Â©!)
   
   Ã°Å¸â€¡ÂºÃ°Å¸â€¡Â¸ **ENGLISH LYRICS** (8~12 syllables - More flexible):
   - **Verse: 8~10 syllables per line**
   - **Chorus: 10~12 syllables per line**
   - **Bridge: 6~10 syllables**
   - **Final Chorus: 10~12 syllables**
   - English allows longer lines without rap effect
   
   **English Examples:**
   Ã¢Å“â€¦ "Walking through the shadows of my mind" (9 syllables)
   Ã¢Å“â€¦ "I can't forget the way you looked at me" (11 syllables)
   
   Ã¢Å¡Â Ã¯Â¸Â **VERSION DIFFERENCES** (Suno AI Model Behavior):
   - **V4.5+**: More flexible, handles 6 Korean syllables gracefully
   - **V5**: Stricter syllable adherence, better for precision
   - **Both versions produce different vibes** - neither is "better," choose based on desired feel
   - V4.5+ = richer vibrato, emotional depth for Korean ballads
   - V5 = cleaner pronunciation, better genre mixing

2ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info} @ 72-84 BPM):
   
   ðŸ”¥ðŸ”¥ðŸ”¥ YOU MUST GENERATE ALL SECTIONS BELOW - NO EXCEPTIONS! ðŸ”¥ðŸ”¥ðŸ”¥
   
   **â­ COMPLETE SONG STRUCTURE (EVERY SECTION MANDATORY!):**
   âœ… [Intro] (${timeline.intro}): 2 lines
   âœ… [Verse 1] (${timeline.v1}): **4 lines ONLY**
   âœ… [Pre-Chorus] (${timeline.pre1}): **2 lines ONLY**
   âœ… [Chorus] (${timeline.c1}): **${config.chorusLines}**
   ${timeline.break !== '0:00' ? `âœ… [Instrumental Break] (${timeline.break}): (no lyrics)` : ''}
   ${timeline.v2 !== '0:00' ? `âœ… [Verse 2] (${timeline.v2}): **4 lines ONLY**` : ''}
   âœ… [Pre-Chorus] (${timeline.pre2}): **2 lines ONLY**
   âœ… [Chorus] (${timeline.c2}): **${config.chorusLines}**
   âœ…âœ…âœ… **[Bridge]** (${timeline.bridge}): **4 lines** â† DO NOT SKIP THIS SECTION!
   âœ… [Instrumental Build] (${timeline.build}): (no lyrics)
   âœ…âœ…âœ… **[Key change up]** â† MANDATORY TAG! Write this tag exactly!
   âœ…âœ…âœ… **[Final Chorus]** (${timeline.final}): **${config.finalChorusMax} lines MAX!** â† DO NOT SKIP! (${config.finalChorusMax + 1}+ = guaranteed rap!)
   âœ… [Outro] (${timeline.outro}): 2 lines
   
   ðŸš¨ðŸš¨ðŸš¨ CRITICAL RULES ðŸš¨ðŸš¨ðŸš¨
   - Bridge, [Key change up], and [Final Chorus] are NOT OPTIONAL!
   - Stopping at Chorus 2 is INCOMPLETE - you MUST continue to Final Chorus!
   - ALL sections listed above MUST appear in your output!


3Ã¯Â¸ÂÃ¢Æ’Â£ **CHORUS REPETITION BAN** (CRITICAL!):
   ${autoChorusVariation || abModeActive ? `
   Ã°Å¸â€Â¥Ã°Å¸â€Â¥Ã°Å¸â€Â¥ CHORUS VARIATION MANDATORY Ã°Å¸â€Â¥Ã°Å¸â€Â¥Ã°Å¸â€Â¥
   ` : ''}
   Ã¢ÂÅ’ FORBIDDEN: Identical lyrics across Chorus 1, 2, Final
   Ã¢Å“â€¦ REQUIRED: 
   - **Pick 1 "anchor line"** that stays the same
   - **ALL other lines MUST vary** (different words, imagery, perspective)
   - Example:
     * Chorus 1: "Ã¬Å¾â€¦Ã¬Ë†Â Ã¬Ââ‚¬ Ã¬â€ºÆ’ÃªÂ³Â  (anchor) / Ã«Ë†Ë†Ã¬Ââ‚¬ Ã¬Â â€“Ã¬â€“Â´ ÃªÂ°â‚¬ / Ã«â€žË† Ã¬â€”â€ Ã«Å â€ Ã¬â€¹ÂÃ­Æ’Â / Ã­ËœÂ¼Ã¬Å¾Â Ã«â€šÂ¨Ã¬Ââ‚¬ Ã¬Â£â€ž"
     * Chorus 2: "Ã¬Å¾â€¦Ã¬Ë†Â Ã¬Ââ‚¬ Ã¬â€ºÆ’ÃªÂ³Â  (same anchor) / Ã¬â€ ÂÃ¬ÂÂ´ Ã­â€¦â€¦ Ã«Â¹â€žÃ¬â€“Â´ ÃªÂ°â‚¬ (NEW!) / Ã¬Â°Â¨ÃªÂ°â‚¬Ã¬Å¡Â´ ÃªÂ·Â¸Ã«Â¦â€¡Ã«Â§Å’ (NEW!) / Ã­â€¢ËœÃ«â€šËœ Ã«â€šÂ¨Ã¬Ââ‚¬ Ã«Â°Â¤ (NEW!)"

4Ã¯Â¸ÂÃ¢Æ’Â£ **MELODY VARIATION TECHNIQUES**:
   a) **Syllable Count Shifts**: 3 Ã¢â€ â€™ 4 Ã¢â€ â€™ 5 Ã¢â€ â€™ 4 pattern (create rhythmic interest)
   b) **Sentence Structure**: Mix noun/verb/adjective phrases
   c) **Consonant Ending Strategy**: 
      - Soft endings (Ã£â€žÂ¹/Ã£â€¦â€¡) for sustained notes
      - Hard endings (Ã£â€¦â€š/Ã£â€žÂ±/Ã£â€žÂ·) for abrupt stops
   d) **Tilde Placement**: Irregular distribution across lines
   e) **Ellipsis Usage** (Ã«Â§ÂÃ¬Â¤â€žÃ¬Å¾â€žÃ­â€˜Å“):
      - Max 0~2 per section
      - Use for emotional pause, hesitation
      - Examples: "ÃªÂ·Â¸Ã«Å¸Â° Ã¬â€šÂ¬Ã«Å¾Å’Ã¬ÂÂ¸ ÃªÂ±Â¸...", "Ã«â€šÂ¨Ã¬â€¢â€žÃ¬â€žÅ“..."
      - Ã¢Å¡Â Ã¯Â¸Â Too many = feels choppy and amateur!

5Ã¯Â¸ÂÃ¢Æ’Â£ **LONG NOTE HYPHEN** (Suno V5 Official Method):
   - Use **hyphen + vowel repetition** for sustained notes
   - **Open vowels = BEST for long notes!** (Ã¬â€¢â€ž/Ã¬ËœÂ¤/Ã¬Å¡Â°/Ã¬Å“Â¼)
   - Distribution: Verse (minimal) Ã¢â€ â€™ Chorus (moderate) Ã¢â€ â€™ Final Chorus (heavy)
   - Examples: "ë–¨ë ¤-ì–´" (lo-ove style), "ëŒì•„-ì•„", "ì°¨ê°€ì›Œ-ì–´", "í˜ëŸ¬-ì–´"
   - Alternative: "ì‚¬ëž‘í•´-ì• -ì• " (multiple vowels for extra length)
   - Max 2-3 per section
   
   âš ï¸ **HYPHEN AND COUNTERPOINT COEXIST**: 
   - Hyphen (-) and English ad-lib ( ) CAN be on the same line (unlike ~)
   - âœ… ALLOWED: "ì›ƒë˜ ìž¥ë©´-ë©´ (only you)" â†’ Works perfectly!
   - âœ… ALLOWED: "ì°¨ê°€ìš´ ë°¤-ì•” (cold night)" â†’ No conflict!

6Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY & COUNTERPOINT** (MANDATORY):
   
   ${abModeActive ? `
   Ã°Å¸Å½Â­ **VERSION B MODE - COUNTERPOINT MAXIMIZED**:
   - **Chorus 1 & 2**: ${abModeActive ? '2-3' : '1-2'} English call-and-response
   - **Final Chorus**: ${abModeActive ? '2-3' : '1-2'} English ad-libs
   ` : `
   - **Chorus 1 & 2**: 1-2 English call-and-response ONLY
   - **Final Chorus**: 1-2 English ad-libs ONLY
   `}
   
   - Placement: **Irregular spacing** (Line 1 & 3, OR Line 2 & 4, NOT consecutive!)
   - Ã¢ÂÅ’ FORBIDDEN: 1+2, 2+3, 3+4 (consecutive = cheap!)
   - Examples: (stay with me), (hold me tight), (fading light)
   - Ã¢Å¡Â Ã¯Â¸Â **Lines with counterpoint ( ) and hyphen (-) work together!**
   
   ðŸš¨ðŸš¨ðŸš¨ COUNTERPOINT CRITICAL RULES ðŸš¨ðŸš¨ðŸš¨
   
   **RULE 1: SAME LINE ONLY** (NEVER new line!)
   âŒ WRONG - Counterpoint on new line:
   ì°°ë‚˜ì˜ ì¡°ê°
   ë’¤í‹€ë¦° í™˜ì˜
   (Only shadows dancing in the dark)  â† NEW LINE = FORBIDDEN!
   
   âœ… CORRECT - Counterpoint on same line:
   ì°°ë‚˜ì˜ ì¡°ê°
   ë’¤í‹€ë¦° í™˜ì˜ (shadows)  â† SAME LINE!
   ê¸°ê´´í•œ ë¹›ê¹”~
   
   **RULE 2: LENGTH MATCHING** (Korean length = English length!)
   - Korean 4ìŒì ˆ â†’ English 2-3 words (~4 syllables)
   - Examples:
     * "ë’¤í‹€ë¦° í™˜ì˜" (4ìŒì ˆ) â†’ (twisted dreams) âœ…
     * "ì°°ë‚˜ì˜ ì¡°ê°" (4ìŒì ˆ) â†’ (fading light) âœ…
     * "ê¸°ê´´í•œ ë¹›ê¹”" (4ìŒì ˆ) â†’ (strange glow) âœ…
   
   âŒ TOO LONG - 7+ words forbidden:
   - "Only shadows dancing in the dark" (7 words) â† TOO LONG!
   - Suno V5 won't harmonize properly with long counterpoint!
   
   âœ… CORRECT LENGTH - Max 3 words:
   - (shadows) âœ…
   - (twisted dreams) âœ…
   - (fading light) âœ…
   - (hold me tight) âœ…
   
   - Placement: **Irregular spacing** (Line 1 & 3, OR Line 2 & 4, NOT consecutive!)
   - âŒ FORBIDDEN: 1+2, 2+3, 3+4 (consecutive = cheap!)
   - âš ï¸ **Lines with counterpoint ( ) and hyphen (-) work together!**
   
   
   **Final Chorus 3-Layer Harmony**:
   - Layer 1: (warm close harmonies) 
   - Layer 2: (softly echoing) OR (tenderly humming) - pick ONE
   - Layer 3: (voices intertwine)
   - Ad-libs: **2 lines MAXIMUM** - Korean (Ã¬â€¢â€ž~), (Ã¬ËœÂ¤~)

7Ã¯Â¸ÂÃ¢Æ’Â£ **LITERARY TONE** (No direct emotion words):
   Ã¢ÂÅ’ FORBIDDEN: "Ã¬Å Â¬Ã­â€â€žÃ«â€¹Â¤", "Ã«Â³Â´ÃªÂ³Â  Ã¬â€¹Â¶Ã«â€¹Â¤", "Ã¬â€šÂ¬Ã«Å¾â€˜Ã­â€¢Â´", "Ã¬â„¢Â¸Ã«Â¡Å“Ã¬â€ºÅ’"
   Ã¢Å“â€¦ REQUIRED: Sensory imagery & metaphors
   - Examples: "Ã¬Â°Â¨ÃªÂ°â‚¬Ã¬Å¡Â´ Ã¬â€ ÂÃ«ÂÂ", "Ã­ÂÂÃ«Â¦Â° Ã¬Â°Â½Ã«Â¬Â¸", "Ã«Â¹Ë† Ã¬ÂËœÃ¬Å¾Â", "Ã¬â€¹Å“Ã«â€œÂ  ÃªÂ½Æ’Ã¬Å¾Å½"
   - Use symbols: scales, shadows, rain, empty rooms
   - Open endings (don't resolve the story)

8Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES** (One per section, English, at section start):
   - [Intro]: (Sparse piano, melancholic ostinato)
   - [Verse 1]: (Piano-driven, intimate vocal, minimal strings)
   ${genre === 'trot' ? '- [Pre-Chorus]: (Strings swell, building sorrow)\n   - [Climb]: (Tension peaks, melody intensely sorrowful with powerful strings)\n   - [Chorus]: (Full emotion, deep vibrato and kkeok-gi technique)' : '- [Pre-Chorus]: (Strings swell gently, building tension)\n   - [Chorus]: (Full instrumentation, piano ostinato leads)'}
   ${timeline.break !== '0:00' ? '- [Instrumental Break]: (Cello answers piano, short and mournful)' : ''}
   ${timeline.v2 !== '0:00' ? '- [Verse 2]: (Piano and strings, vocal more emotional)' : ''}
   ${genre === 'trot' ? '- [Pre-Chorus]: (Strings rising again)\n   - [Climb]: (Peak emotional tension)\n   - [Chorus]: (Kkeok-gi technique emphasized)' : '- [Pre-Chorus]: (Orchestra builds, drums enter subtly)\n   - [Chorus]: (Strings fuller, bass added, driving rhythm)'}
   - [Bridge]: (Music strips down, piano and vocal only)
   - [Instrumental Build]: (Orchestra builds, drums enter, rising tension)
   - **[Key change up]** Ã¢â€ Â MANDATORY TAG! (no lyrics, no parentheses)
   - [Final Chorus]: (Full voice, wide vibrato, sustained high notes)
   - [Outro]: (Piano fades, strings hold final chord, unresolved)

9Ã¯Â¸ÂÃ¢Æ’Â£ **FORBIDDEN TERMS**:
   Ã¢ÂÅ’ Do NOT use: kkeokgi, Korean twist, piri, gayageum, shamisen, dreamy, ambient, ethereal, flowing

Ã°Å¸â€Å¸ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs and section tags)
   - Title: "Ã¬Â Å“Ã«ÂªÂ©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   
   Ã¢Å¡Â Ã¯Â¸ÂÃ¢Å¡Â Ã¯Â¸ÂÃ¢Å¡Â Ã¯Â¸Â **CLEAN OUTPUT RULES** Ã¢Å¡Â Ã¯Â¸ÂÃ¢Å¡Â Ã¯Â¸ÂÃ¢Å¡Â Ã¯Â¸Â
   
   **FORBIDDEN in lyrics:**
   Ã¢ÂÅ’ Syllable counts: (3), (4), (5) Ã¢â€ â€™ NEVER!
   Ã¢ÂÅ’ Delivery notes: [melancholic delivery] Ã¢â€ â€™ NEVER!
   Ã¢ÂÅ’ Numbers in parentheses
   â­ Hyphens "-" for long notes! (Suno V5 Official: "ì‚¬ëž‘-ì•™", "ë–¨ë ¤-ì–´")

   **CORRECT long note notation:**
   **CORRECT long note notation (Suno V5 Official):**
   âœ… "ë–¨ë ¤-ì–´" (hyphen + vowel repetition)
   âœ… "ëŒì•„-ì•„" (hyphen + vowel repetition)
   âœ… "ì‚¬ëž‘í•´-ì• -ì• " (multiple vowels for extra length)

   **INCORRECT notation:**
   âŒ "ë–¨ë ¤~" (tilde not officially supported in V5!)
   âŒ "ëŒì•„~" (use hyphen instead!)
   
   **ALLOWED in parentheses:**
   Ã¢Å“â€¦ English ad-libs ONLY: (stay with me), (hold me tight)
   Ã¢Å“â€¦ Harmony directives in [Final Chorus]: (warm close harmonies)
   Ã¢Å“â€¦ Korean ad-libs in [Final Chorus]: (Ã¬â€¢â€ž~), (Ã¬ËœÂ¤~)

${(sectionVerse || sectionPrechorus || sectionChorus || sectionBridge || sectionFinal || sectionOutro) ? `
Ã°Å¸Å½Â­Ã°Å¸Å½Â­Ã°Å¸Å½Â­ SECTION-BY-SECTION EMOTIONAL DIRECTING Ã°Å¸Å½Â­Ã°Å¸Å½Â­Ã°Å¸Å½Â­
Apply these emotional directions to INFLUENCE your word choice:
${sectionVerse ? `- [Verse]: ${sectionVerse} delivery` : ''}
${sectionPrechorus ? `- [Pre-Chorus]: ${sectionPrechorus} delivery` : ''}
${sectionChorus ? `- [Chorus]: ${sectionChorus} delivery` : ''}
${sectionBridge ? `- [Bridge]: ${sectionBridge} delivery` : ''}
${sectionFinal ? `- [Final Chorus]: ${sectionFinal} delivery` : ''}
${sectionOutro ? `- [Outro]: ${sectionOutro} delivery` : ''}

Ã¢Å¡Â Ã¯Â¸Â DO NOT write delivery notes in output! EMBODY emotions through word choices!
` : ''}

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
âœ… VALIDATION CHECKLIST (8ëŒ€ ì›ì¹™ + Language-specific):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
â–¡ Language identified? (Korean = 3~6 / English = 8~12 syllables)
â–¡ Korean: All lines 3~6ìŒì ˆ? (Pre 3~5, Outro 2~5)
â–¡ English: Verse 8~10 / Chorus 10~12 syllables?
â–¡ â­ [Bridge] section included? (MANDATORY!)
â–¡ â­ [Key change up] tag included? (MANDATORY!)
â–¡ â­ [Final Chorus] section included? (MANDATORY!)
â–¡ Final Chorus ${config.finalChorusMax} lines max? (${config.finalChorusMax + 1}+ = rap!)
â–¡ Chorus 1/2/Final different (except 1 anchor)?
â–¡ Melody variation applied? (ìŒì ˆìˆ˜/êµ¬ì¡°/ë°›ì¹¨/í‹¸ë“œ~)
â–¡ Hyphens (-) for long notes? (vowel repetition: "ì‚¬ëž‘-ì•™")
â–¡ Ellipsis (...) max 0~2 per section?
â–¡ Counterpoint ${abModeActive ? '2-3' : '1-2'} times per chorus?
â–¡ â­ Counterpoint on SAME LINE (NOT new line)?
â–¡ â­ Counterpoint length max 3 words? (NO 7+ word phrases!)
â–¡ Counterpoint on irregular spacing? (NOT consecutive!)
â–¡ Final Chorus 3-layer harmony? (warm/echoing/intertwine)
â–¡ Ad-libs 2 lines max?
â–¡ âš ï¸ CRITICAL: Tilde (~) and counterpoint ( ) NEVER on same line?
â–¡ Literary imagery (no direct emotion words)?
â–¡ Clean output (no annotations)?
${genre === 'trot' ? 'â–¡ [Climb] sections included before Chorus?' : ''}
${genre === 'pop80s' ? 'â–¡ Male AND female harmonies mentioned?' : ''}
â–¡ Version consideration? (V4.5+ = emotional / V5 = precise)

ðŸŽµ Generate the COMPLETE song NOW! MUST include ALL sections: [Intro] â†’ [Verse 1] â†’ [Pre-Chorus] â†’ [Chorus] â†’ ... â†’ [Bridge] â†’ [Instrumental Build] â†’ [Key change up] â†’ [Final Chorus] â†’ [Outro]!
  `;
}

// =====================================
// Hip-Hop Boom Bap Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateHipHopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Hip-Hop Lab" - elite Old School Hip-Hop songwriting system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate Hip-Hop Boom Bap lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ HIP-HOP BOOM BAP RULES (CRITICAL!):

1Ã¯Â¸ÂÃ¢Æ’Â£ **RHYME SCHEMES** (Most important!):
   - End Rhyme MANDATORY: Use AABB or ABAB pattern
   - Internal Rhyme RECOMMENDED: Mid-line rhymes for complexity
   - Examples:
     * AABB: "ÃªÂ±Â°Ã«Â¦Â¬ Ã¬Å“â€žÃ«Â¥Â¼ ÃªÂ±Â¸Ã¬â€“Â´ / ÃªÂ¿Ë†Ã¬Ââ€ž Ã­â€“Â¥Ã­â€¢Â´ Ã«Ââ€ / Ã«Â°Â¤Ã­â€¢ËœÃ«Å Ëœ Ã«Â³â€žÃ¬ÂÂ´ Ã«Â¹â€ºÃ«â€šËœ / Ã«â€šÂ´ ÃªÂ¸Â¸Ã¬Ââ€ž Ã«Â¹â€žÃ¬Â¶Â° Ã«Â°ÂÃ¬â€¢â€ž"
     * ABAB: "Ã«Ââ€žÃ¬â€¹Å“Ã¬ÂËœ Ã«Â°Â¤ (A) / Ã«â€šÂ´ Ã«Â°Å“ÃªÂ±Â¸Ã¬ÂÅ’Ã¬Ââ‚¬ ÃªÂ³â€žÃ¬â€ ÂÃ«ÂÂ¼ (B) / ÃªÂ¿Ë†Ã¬Ââ€ž Ã­â€“Â¥Ã­â€¢Å“ Ã«Â°Â¤ (A) / Ã«Â©Ë†Ã¬Â¶â€Ã¬Â§â‚¬ Ã¬â€¢Å Ã¬Ââ€ž Ã«Å¾Â©Ã¬ÂÂ´Ã«â€žÂ¤ (B)"

2Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (flexible for flow)
   - Hook: **6~10 syllables** (catchy, sung)
   - Bridge: **5~8 syllables**
   - Final Hook: Up to **10 lines** allowed

3Ã¯Â¸ÂÃ¢Æ’Â£ **FLOW & DELIVERY**:
   - Clear enunciation (Ã«Âªâ€¦Ã­â„¢â€¢Ã­â€¢Å“ Ã«Â°Å“Ã¬ÂÅ’)
   - Confident delivery (Ã¬Å¾ÂÃ¬â€¹Â ÃªÂ°Â)
   - 4th beat stress (4Ã«Â²Ë†Ã¬Â§Â¸ Ã«Â¹â€žÃ­Å Â¸Ã¬â€”Â ÃªÂ°â€¢Ã¬â€žÂ¸)
   - NO mumble rap, NO trap hi-hats

4Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Scratching/Sample (1-2 lines optional)
   - Verse 1 (${timeline.v1}): **4-8 lines** (rap, rhyme-focused)
   - Hook (${timeline.c1}): **2-4 lines** (sung chorus)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-8 lines** (evolved rhyme)` : ''}
   - Hook (${timeline.c2}): **2-4 lines** (same or variation)
   - Bridge (${timeline.bridge}): **2-4 lines** (mood change)
   - Final Hook (${timeline.final}): **2-4 lines** (powerful)
   - Outro (${timeline.outro}): Fade out

5Ã¯Â¸ÂÃ¢Æ’Â£ **HOOK VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Hooks can vary slightly but keep core message
   - Example:
     * Hook 1: "Ã¬ÂÂ´ÃªÂ²Æ’Ã¬ÂÂ´ Ã«â€šÂ´ ÃªÂ¸Â¸ / Ã¬Â Ë†Ã«Å’â‚¬ Ã«Â©Ë†Ã¬Â¶â€Ã¬Â§â‚¬ Ã¬â€¢Å Ã¬â€¢â€ž"
     * Hook 2: "Ã¬ÂÂ´ÃªÂ²Æ’Ã¬ÂÂ´ Ã«â€šÂ´ Ã¬â€šÂ¶ / ÃªÂ³â€žÃ¬â€ Â ÃªÂ±Â¸Ã¬â€“Â´ÃªÂ°Ë† ÃªÂ±Â°Ã¬â€¢Â¼"
   ` : `
   - Hook stays consistent
   `}

6Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY** (Hip-Hop style):
   - (tight backing vocals) in hooks
   - (call-and-response) in verses
   - Korean ad-libs OK: (yeah!), (uh!), (let's go!)

7Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Scratching, vinyl crackle, boom-bap drums)
   - [Verse 1]: (Jazzy piano loop, deep bass, clear drums)
   - [Hook]: (Full instrumentation, melodic hook)
   - [Bridge]: (Stripped beat, just bass and snare)
   - [Instrumental Build]: (Building intensity, drum fills)
   - **[Key change up]** Ã¢â€ Â MANDATORY TAG!
   - [Final Hook]: (All elements, maximum energy)

8Ã¯Â¸ÂÃ¢Æ’Â£ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "Ã¬Â Å“Ã«ÂªÂ©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Hook], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics!

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ HIP-HOP CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ End rhyme scheme (AABB/ABAB)?
Ã¢â€“Â¡ 7-12 syllables in verses?
Ã¢â€“Â¡ Clear, confident delivery?
Ã¢â€“Â¡ Hook is catchy and sung?
Ã¢â€“Â¡ NO mumble rap, NO trap sounds?
Ã¢â€“Â¡ Clean output (no annotations)?

Ã°Å¸Å½Âµ Generate Hip-Hop Boom Bap lyrics now!
  `;
}

// =====================================
// Melodic Trap Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateTrapPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Trap Lab" - elite Melodic Trap songwriting system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate Melodic Trap lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ MELODIC TRAP RULES (CRITICAL!):

1Ã¯Â¸ÂÃ¢Æ’Â£ **TRIPLET FLOW** (Most important!):
   - Use 3Ã¬â€”Â°Ã¬ÂÅ’ (1Ã«Â°â€¢Ã¬â€”Â 3Ã¬ÂÅ’Ã¬Â Ë†)
   - Example: "Ã«â€žË†Ã«Â¥Â¼ Ã¬Å¾Æ’Ã¬Ââ‚¬ / ÃªÂ·Â¸ Ã¬Ë†Å“ÃªÂ°â€žÃ«Â¶â‚¬Ã­â€žÂ° / Ã«â€šÅ“ Ã«Â§ÂÃªÂ°â‚¬Ã¬Â Â¸"
   - Melodic phrasing over strict rhyme
   - Auto-Tune friendly delivery

2Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (triplet flow)
   - Chorus: **5~8 syllables** (sung, melodic)
   - Bridge: **4~6 syllables** (vulnerable)
   - Final Chorus: Up to **8 lines**

3Ã¯Â¸ÂÃ¢Æ’Â£ **RAP + SINGING MIX**:
   - Verses: Rap with melody (Auto-Tuned)
   - Chorus: Full singing (emotional)
   - Pre-Chorus: Building emotion
   - NO traditional clear rap (blur the line!)

4Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Atmospheric pad (1-2 lines)
   - Verse 1 (${timeline.v1}): **4-6 lines** (melodic rap)
   - Pre-Chorus (${timeline.pre1}): **2 lines** (emotion rise)
   - Chorus (${timeline.c1}): **4Ã¬Â¤â€ž** (sung)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6 lines** (melodic rap)` : ''}
   - Chorus (${timeline.c2}): **4Ã¬Â¤â€ž**
   - Bridge (${timeline.bridge}): **2-4 lines** (vulnerable)
   - Final Chorus (${timeline.final}): **4-6 lines** (emotion peak)
   - Outro (${timeline.outro}): Fade

5Ã¯Â¸ÂÃ¢Æ’Â£ **EMOTION DELIVERY**:
   - Dark minor-key mood
   - Emotionally vulnerable
   - Pain, heartbreak, struggle themes
   - NO aggressive shouting

6Ã¯Â¸ÂÃ¢Æ’Â£ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Keep melodic core, vary words
   - Example:
     * Chorus 1: "Ã«â€žÅ’ Ã«â€“Â Ã«â€šËœÃªÂ°â€Ã¬â€“Â´ / Ã«â€šÅ“ Ã¬â€”Â¬ÃªÂ¸Â° Ã«â€šÂ¨Ã¬â€¢â€ž"
     * Chorus 2: "Ã«â€žÅ’ Ã«Â©â‚¬Ã¬â€“Â´Ã¬Â¡Å’Ã¬â€“Â´ / Ã«â€šÅ“ Ã­ËœÂ¼Ã¬Å¾Â Ã¬â€žÅ“Ã¬Å¾Ë†Ã¬â€“Â´"
   ` : `
   - Chorus stays consistent
   `}

7Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY** (Trap style):
   - (Auto-Tuned harmonies) in chorus
   - (atmospheric pads) throughout
   - (emotional ad-libs) in final chorus
   - Korean ad-libs: (ooh), (yeah), (ah~)

8Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Atmospheric synth pad, dark mood)
   - [Verse 1]: (808 bass hits, rolling hi-hats, melodic rap)
   - [Pre-Chorus]: (Tension building, synths rising)
   - [Chorus]: (Full 808, atmospheric pads, emotional singing)
   - [Bridge]: (Stripped down, just pads and vocal)
   - [Instrumental Build]: (808 builds, hi-hats intensify)
   - **[Key change up]** Ã¢â€ Â MANDATORY TAG!
   - [Final Chorus]: (Maximum emotion, layered vocals)

9Ã¯Â¸ÂÃ¢Æ’Â£ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "Ã¬Â Å“Ã«ÂªÂ©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics!

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ MELODIC TRAP CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ Triplet flow (3Ã¬â€”Â°Ã¬ÂÅ’)?
Ã¢â€“Â¡ Rap + singing mixed?
Ã¢â€“Â¡ Emotional, vulnerable themes?
Ã¢â€“Â¡ Auto-Tune friendly phrasing?
Ã¢â€“Â¡ Dark minor-key mood?
Ã¢â€“Â¡ Clean output (no annotations)?

Ã°Å¸Å½Âµ Generate Melodic Trap lyrics now!
  `;
}

// =====================================
// Funk Pop Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateFunkPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Funk Pop Lab" - elite Bruno Mars-style songwriting system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate Funk Pop lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ FUNK POP RULES (CRITICAL!):

1Ã¯Â¸ÂÃ¢Æ’Â£ **CALL-AND-RESPONSE** (Most important!):
   - Lead: "Ã¬â€ ÂÃ¬Ââ€ž Ã«â€œÂ¤Ã¬â€“Â´" / Response: "(Ã«â€ â€™Ã¬ÂÂ´!)"
   - Lead: "Ã«â€¹Â¤ ÃªÂ°â„¢Ã¬ÂÂ´ Ã¬Â¶Â¤Ã¬Â¶Â°" / Response: "(Let's go!)"
   - Create party vibe, audience participation
   - Tight harmonies throughout

2Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE RULES** (5-10 syllables):
   - Verse: **5~10 syllables** (free, groovy)
   - Chorus: **6~10 syllables** (repetitive)
   - Bridge: **4~8 syllables**
   - Final Chorus: Up to **10 lines** (ad-libs!)

3Ã¯Â¸ÂÃ¢Æ’Â£ **SYNCOPATION & GROOVE**:
   - Offbeat phrasing (Ã¬â€”â€¡Ã«Â°â€¢)
   - Rhythmic, percussive words
   - Feeling over strict rhyme
   - Danceable energy

4Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Brass hit + groove (1-2 lines)
   - Verse 1 (${timeline.v1}): **4Ã¬Â¤â€ž** (spoken/sung)
   - Pre-Chorus (${timeline.pre1}): **2Ã¬Â¤â€ž** (build energy)
   - Chorus (${timeline.c1}): **4-6Ã¬Â¤â€ž** (full energy)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4Ã¬Â¤â€ž**` : ''}
   - Chorus (${timeline.c2}): **4-6Ã¬Â¤â€ž**
   - Bridge (${timeline.bridge}): **2-4Ã¬Â¤â€ž** (break it down)
   - Final Chorus (${timeline.final}): **6-8Ã¬Â¤â€ž** (ad-libs)
   - Outro (${timeline.outro}): Instrumental fade

5Ã¯Â¸ÂÃ¢Æ’Â£ **PARTY ENERGY**:
   - Confident, upbeat themes
   - Celebration, dancing, fun
   - Bruno Mars / Uptown Funk vibe
   - NO sad ballad emotions

6Ã¯Â¸ÂÃ¢Æ’Â£ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Keep hook, vary supporting lines
   - Example:
     * Chorus 1: "Ã¬Â¶Â¤Ã¬Â¶Â° Ã¬Â¶Â¤Ã¬Â¶Â° / Ã«Â°Â¤Ã¬Æ’Ë†Ã«Ââ€žÃ«Â¡Â (yeah!)"
     * Chorus 2: "Ã«â€ºÂ°Ã¬â€“Â´ Ã«â€ºÂ°Ã¬â€“Â´ / Ã¬â€¢â€žÃ¬Â¹Â¨ÃªÂ¹Å’Ã¬Â§â‚¬ (come on!)"
   ` : `
   - Chorus stays consistent
   `}

7Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY** (Funk Pop style):
   - (tight harmonies) in all choruses
   - (brass hits) punctuating phrases
   - (call-and-response vocals) throughout
   - English ad-libs OK: (yeah!), (come on!), (let's go!)

8Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Brass hit, groovy bassline, syncopated guitar)
   - [Verse 1]: (Minimal groove, funky bass, clear vocals)
   - [Pre-Chorus]: (Building energy, brass rising)
   - [Chorus]: (Full brass section, groovy bass, tight rhythm)
   - [Bridge]: (Breakdown, just bass and vocals)
   - [Instrumental Build]: (Funky bass build, brass crescendo)
   - **[Key change up]** Ã¢â€ Â MANDATORY TAG!
   - [Final Chorus]: (Maximum funk, all instruments, ad-libs)

9Ã¯Â¸ÂÃ¢Æ’Â£ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "Ã¬Â Å“Ã«ÂªÂ©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics!

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ FUNK POP CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ Call-and-response structure?
Ã¢â€“Â¡ Syncopation & groove?
Ã¢â€“Â¡ Party, celebration energy?
Ã¢â€“Â¡ Tight harmonies?
Ã¢â€“Â¡ NO slow ballad vibes?
Ã¢â€“Â¡ Clean output (no annotations)?

Ã°Å¸Å½Âµ Generate Funk Pop lyrics now!
  `;
}

// =====================================
// Reggaeton Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateReggaetonPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Reggaeton Lab" - elite Latin dance songwriting system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate Reggaeton lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ REGGAETON RULES (CRITICAL!):

1Ã¯Â¸ÂÃ¢Æ’Â£ **DEMBOW RHYTHM** (3+3+2 pattern):
   - Example: "Ã«Â°Â¤Ã¬ÂÂ´ / ÃªÂ¹Å Ã¬â€“Â´ÃªÂ°â‚¬ / Ã¬Â¶Â¤Ã¬Â¶Â°" (3+3+2)
   - Hook repetition minimum 3 times per chorus
   - Latin percussion rhythm
   - Perreo beat feel

2Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (rap style)
   - Hook: **4~8 syllables** (ÃªÂ°â€¢Ã«Â Â¥Ã­â€¢Å“ Ã«Â°ËœÃ«Â³Âµ)
   - Bridge: **5~8 syllables**
   - Final Hook: Up to **8 lines**

3Ã¯Â¸ÂÃ¢Æ’Â£ **RAP + SINGING MIX**:
   - Verses: Rap delivery (Spanish-influenced)
   - Hook: Catchy, repetitive singing
   - Minimum 3 hook repetitions per chorus
   - Danceable, party vibe

4Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Dembow drum + hook preview (1-2 lines)
   - Verse 1 (${timeline.v1}): **4-6Ã¬Â¤â€ž** (rap)
   - Hook (${timeline.c1}): **2-4Ã¬Â¤â€ž** (repeat 3x minimum)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6Ã¬Â¤â€ž** (rap)` : ''}
   - Hook (${timeline.c2}): **2-4Ã¬Â¤â€ž** (repeat 3x)
   - Bridge (${timeline.bridge}): **2Ã¬Â¤â€ž** (breakdown)
   - Final Hook (${timeline.final}): **3-4Ã¬Â¤â€ž** (ÃªÂ°â€¢Ã­â„¢â€Ã«ÂÅ“ Ã«Â°ËœÃ«Â³Âµ)
   - Outro (${timeline.outro}): Hook fade

5Ã¯Â¸ÂÃ¢Æ’Â£ **LATIN VIBE**:
   - Tropical, beach atmosphere
   - Spanish-influenced melody
   - Party, dance themes
   - 90-100 BPM feel

6Ã¯Â¸ÂÃ¢Æ’Â£ **HOOK VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Hook core stays same, add variations
   - Example:
     * Hook 1: "Ã«Â°â€Ã¬ÂÂ¼Ã«ÂÂ¼ Ã«Â°â€Ã¬ÂÂ¼Ã«ÂÂ¼ / Ã¬Â¶Â¤Ã¬Â¶Â° Ã«Â°Â¤Ã¬Æ’Ë† / Ã«Â°â€Ã¬ÂÂ¼Ã«ÂÂ¼ Ã«Â°â€Ã¬ÂÂ¼Ã«ÂÂ¼"
     * Hook 2: "Ã«Â°â€Ã¬ÂÂ¼Ã«ÂÂ¼ Ã«Â°â€Ã¬ÂÂ¼Ã«ÂÂ¼ / Ã«â€ºÂ°Ã¬â€“Â´ Ã¬â€¢â€žÃ¬Â¹Â¨ÃªÂ¹Å’Ã¬Â§â‚¬ / Ã«Â°â€Ã¬ÂÂ¼Ã«ÂÂ¼ Ã«Â°â€Ã¬ÂÂ¼Ã«ÂÂ¼"
   ` : `
   - Hook stays consistent (ÃªÂ°â€¢Ã«Â Â¥Ã­â€¢Å“ Ã«Â°ËœÃ«Â³Âµ!)
   `}

7Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY** (Reggaeton style):
   - (Latin percussion) throughout
   - (catchy vocal hooks) in chorus
   - (dembow rhythm) driving beat
   - Spanish/English ad-libs: (baila!), (vamos!), (dale!)

8Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Dembow drum pattern, Latin percussion)
   - [Verse 1]: (Minimal beat, reggaeton drums, rap vocal)
   - [Hook]: (Full dembow, bass drop, catchy melody)
   - [Bridge]: (Breakdown, just dembow and vocal)
   - [Instrumental Build]: (Dembow intensifies, percussion builds)
   - **[Key change up]** Ã¢â€ Â MANDATORY TAG!
   - [Final Hook]: (Maximum energy, all percussion, powerful hooks)

9Ã¯Â¸ÂÃ¢Æ’Â£ **OUTPUT FORMAT**:
   - Language: Korean (except Spanish/English ad-libs)
   - Title: "Ã¬Â Å“Ã«ÂªÂ©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Hook], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics!

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ REGGAETON CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ Dembow rhythm (3+3+2)?
Ã¢â€“Â¡ Hook repeated 3+ times?
Ã¢â€“Â¡ Rap + singing mixed?
Ã¢â€“Â¡ Latin, tropical vibe?
Ã¢â€“Â¡ Danceable energy?
Ã¢â€“Â¡ Clean output (no annotations)?

Ã°Å¸Å½Âµ Generate Reggaeton lyrics now!
  `;
}

// =====================================
// Future Bass Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateFutureBassPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Future Bass Lab" - elite EDM songwriting system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate Future Bass lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ FUTURE BASS RULES (CRITICAL!):

1Ã¯Â¸ÂÃ¢Æ’Â£ **MINIMAL VOCALS** (Most important!):
   - Keep lyrics SHORT and SIMPLE
   - Vocal chops in mind
   - Drop section = minimal or NO vocals
   - Focus on emotion over words

2Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE RULES** (4-8 syllables - VERY SHORT):
   - Verse: **4~8 syllables** (Ã¬Â§Â§ÃªÂ²Å’!)
   - Chorus: **3~6 syllables** (ÃªÂ·Â¹Ã«Ââ€žÃ«Â¡Å“ Ã¬Â§Â§ÃªÂ²Å’!)
   - Drop: **1-2 lines** (Ã«Â³Â´Ã¬Â»Â¬ Ã¬ÂµÅ“Ã¬â€ Å’)
   - Final Drop: Up to **6 lines** max

3Ã¯Â¸ÂÃ¢Æ’Â£ **EMOTIONAL & UPLIFTING**:
   - Introspective, emotional themes
   - Uplifting major key (or emotional minor)
   - Love, self-discovery, freedom
   - Festival-ready energy

4Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Synth pad (1-2 lines)
   - Verse 1 (${timeline.v1}): **2-4Ã¬Â¤â€ž** (minimal vocal)
   - Build (${timeline.pre1}): Rising tension (1Ã¬Â¤â€ž or instrumental)
   - Drop (${timeline.c1}): **1-2Ã¬Â¤â€ž** (vocal chop, mostly instrumental)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **2-4Ã¬Â¤â€ž**` : ''}
   - Build: Rising (1Ã¬Â¤â€ž)
   - Drop 2 (${timeline.c2}): **1-2Ã¬Â¤â€ž**
   - Bridge (${timeline.bridge}): **2Ã¬Â¤â€ž** (breakdown)
   - Final Drop (${timeline.final}): **2-3Ã¬Â¤â€ž** (maximum energy)
   - Outro (${timeline.outro}): Fade

5Ã¯Â¸ÂÃ¢Æ’Â£ **VOCAL CHOPS**:
   - Write simple, choppable phrases
   - Example: "Ã«â€šÂ Ã¬â€¢â€žÃ¬ËœÂ¬Ã«ÂÂ¼" Ã¢â€ â€™ can be chopped "Ã«â€šÂ -Ã¬â€¢â€ž-Ã¬ËœÂ¬-Ã«ÂÂ¼"
   - Short syllables work best
   - Repetitive phrases OK

6Ã¯Â¸ÂÃ¢Æ’Â£ **DROP VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Drops can vary slightly
   - Example:
     * Drop 1: "Ã«â€šÂ Ã¬â€¢â€žÃ¬ËœÂ¬Ã«ÂÂ¼"
     * Drop 2: "Ã«â€ â€™Ã¬ÂÂ´ Ã«â€“Â Ã¬ËœÂ¬Ã«ÂÂ¼"
   ` : `
   - Drops stay consistent
   `}

7Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY** (Future Bass style):
   - (lush synth chords) throughout
   - (chopped vocal samples) in drops
   - (bright supersaws) in drops
   - (atmospheric pads) in verses

8Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Synth pad, faded melody, emotional atmosphere)
   - [Verse 1]: (Minimal synths, intimate vocals, light percussion)
   - [Build]: (Rising synths, white noise, snare rolls, tension)
   - [Drop]: (Bright supersaws, chopped vocals, energetic bass, 128 BPM energy)
   - [Bridge]: (Breakdown, just pads and vocal, emotional moment)
   - [Instrumental Build]: (Synths rising, white noise build)
   - **[Key change up]** Ã¢â€ Â MANDATORY TAG!
   - [Final Drop]: (Maximum energy, all synths, festival vibes)

9Ã¯Â¸ÂÃ¢Æ’Â£ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "Ã¬Â Å“Ã«ÂªÂ©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Drop], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics!

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ FUTURE BASS CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ Very short phrases (4-8 syllables)?
Ã¢â€“Â¡ Drop sections minimal vocals?
Ã¢â€“Â¡ Emotional, uplifting themes?
Ã¢â€“Â¡ Vocal chop friendly?
Ã¢â€“Â¡ Festival energy in drops?
Ã¢â€“Â¡ Clean output (no annotations)?

Ã°Å¸Å½Âµ Generate Future Bass lyrics now!
  `;
}

// =====================================
// Indie Pop (Bedroom Pop) Ã¬Â â€žÃ¬Å¡Â© Ã­â€â€žÃ«Â¡Â¬Ã­â€â€žÃ­Å Â¸
// =====================================
function generateIndiePopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Indie Pop Lab" - elite Bedroom Pop songwriting system.

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã°Å¸Å½Â¯ MISSION: Generate Indie Pop lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

Ã°Å¸â€œâ€¹ INDIE POP (BEDROOM POP) RULES (CRITICAL!):

1Ã¯Â¸ÂÃ¢Æ’Â£ **HONESTY & VULNERABILITY** (Most important!):
   - Be authentic, raw, real
   - Personal experiences
   - Relatable emotions
   - NO overproduction, NO perfection

2Ã¯Â¸ÂÃ¢Æ’Â£ **SYLLABLE RULES** (3-10 syllables - FLEXIBLE):
   - Verse: **3~10 syllables** (Ã¬Å¾ÂÃ¬Å“Â Ã«Â¡Å“Ã¬â€ºâ‚¬!)
   - Chorus: **4~8 syllables** (Ã«â€¹Â¨Ã¬Ë†Å“)
   - Bridge: **3~6 syllables**
   - Unconventional structure OK
   - Spoken-word natural flow

3Ã¯Â¸ÂÃ¢Æ’Â£ **SIMPLE & INTIMATE**:
   - Lo-fi production aesthetic
   - Simple, straightforward language
   - NO complex metaphors
   - Direct, honest emotions
   - Melancholic yet catchy

4Ã¯Â¸ÂÃ¢Æ’Â£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Lo-fi guitar/synth (2Ã¬Â¤â€ž)
   - Verse 1 (${timeline.v1}): **4-6Ã¬Â¤â€ž** (intimate)
   - Chorus (${timeline.c1}): **2-4Ã¬Â¤â€ž** (simple hook)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6Ã¬Â¤â€ž**` : ''}
   - Chorus (${timeline.c2}): **2-4Ã¬Â¤â€ž**
   - Bridge (${timeline.bridge}): **2-4Ã¬Â¤â€ž** (vulnerable moment)
   - Outro (${timeline.outro}): Fade or abrupt (1-2Ã¬Â¤â€ž)

5Ã¯Â¸ÂÃ¢Æ’Â£ **NATURAL DELIVERY**:
   - Conversational tone
   - Speak-singing OK
   - Imperfect phrasing OK
   - Examples: "Ã¬Â°Â½Ã«Â°â€“Ã¬â€”â€ Ã«Â¹â€žÃªÂ°â‚¬ Ã«â€šÂ´Ã«Â¦Â¬ÃªÂ³Â  / Ã«â€šÅ“ Ã«â€žÂ¤ Ã¬Æ’ÂÃªÂ°ÂÃ«Â§Å’"
   - Like talking to a friend

6Ã¯Â¸ÂÃ¢Æ’Â£ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Simple variations OK
   - Example:
     * Chorus 1: "Ã«ÂÅ’Ã¬â€¢â€žÃ¬â„¢â‚¬ Ã¬Â¤Ëœ / Ã¬Â Å“Ã«Â°Å“"
     * Chorus 2: "Ã«â€“Â Ã«â€šËœÃ¬Â§â‚¬ Ã«Â§Ë† / Ã«Â¶â‚¬Ã­Æ’ÂÃ¬ÂÂ´Ã¬â€¢Â¼"
   ` : `
   - Chorus stays simple and consistent
   `}

7Ã¯Â¸ÂÃ¢Æ’Â£ **HARMONY** (Indie Pop style):
   - (lo-fi drums) throughout
   - (jangly guitars) in background
   - (dreamy synths) for atmosphere
   - (intimate vocals) front and center
   - Minimal production, maximum emotion

8Ã¯Â¸ÂÃ¢Æ’Â£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Lo-fi guitar/synth, bedroom production)
   - [Verse 1]: (Minimal drums, intimate vocal, simple guitar)
   - [Chorus]: (Full but still lo-fi, catchy hook)
   - [Bridge]: (Stripped down, vulnerable moment, just vocal and one instrument)
   - [Instrumental Build]: (Gentle build, bedroom production)
   - **[Key change up]** Ã¢â€ Â Optional for indie pop
   - [Final Chorus]: (Emotional peak, still lo-fi)
   - [Outro]: (Fade out or abrupt end, natural finish)

9Ã¯Â¸ÂÃ¢Æ’Â£ **THEMES**:
   - Love, heartbreak, loneliness
   - Self-discovery, uncertainty
   - Modern life, relationships
   - Mental health (handled sensitively)
   - Nostalgia, growing up

Ã°Å¸â€Å¸ **OUTPUT FORMAT**:
   - Language: Korean (except minimal English ad-libs)
   - Title: "Ã¬Â Å“Ã«ÂªÂ©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - Ã¢ÂÅ’ NO hyphens "-" in lyrics!

Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢Å“â€¦ INDIE POP CHECKLIST:
Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
Ã¢â€“Â¡ Honest, vulnerable lyrics?
Ã¢â€“Â¡ Simple, direct language?
Ã¢â€“Â¡ Natural, conversational flow?
Ã¢â€“Â¡ Lo-fi aesthetic?
Ã¢â€“Â¡ Relatable themes?
Ã¢â€“Â¡ Clean output (no annotations)?

Ã°Å¸Å½Âµ Generate Indie Pop lyrics now!
  `;
}
