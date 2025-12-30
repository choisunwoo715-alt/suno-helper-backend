// =====================================================
// Suno AI Lyrics Generation API v12.2
// 백엔드 전용 - Vercel KV 레이트리밋 + 보안 강화 + 하이픈 고정판!
// =====================================================

// =====================================
// Vercel KV ë ˆì´íŠ¸ë¦¬ë°‹ (ì›ìžì  íŠ¸ëžœìž­ì…˜)
// =====================================
async function checkRateLimit(ip) {
  // â­ Vercel KV / Upstash REST í™˜ê²½ë³€ìˆ˜
  const KV_REST_API_URL =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_URL;

  const KV_REST_API_TOKEN =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  // KVê°€ ì„¤ì • ì•ˆ ë˜ì–´ ìžˆìœ¼ë©´ ê¸°ë³¸ ë ˆì´íŠ¸ë¦¬ë°‹ (ë©”ëª¨ë¦¬)
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    console.warn('[Rate Limit] Vercel KV not configured, using memory fallback');
    return checkRateLimitFallback(ip);
  }

  const key = `ratelimit:${ip}`;

  try {
    // âœ… atomic íŠ¸ëžœìž­ì…˜: ìµœì´ˆ 1íšŒë§Œ EX ì„¤ì • + INCR
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

    // Vercel KVëŠ” ë³´í†µ [ {result}, {result} ] í˜•íƒœ
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
// Fallback ë ˆì´íŠ¸ë¦¬ë°‹ (KV ì‹¤íŒ¨ ì‹œ)
// =====================================
const rateLimitMapFallback = new Map();
const MAX_FALLBACK_ENTRIES = 1000;

function checkRateLimitFallback(ip) {
  const now = Date.now();
  const userRequests = rateLimitMapFallback.get(ip) || [];
  
  // 1ì‹œê°„ ë‚´ ìš”ì²­ë§Œ í•„í„°
  const recentRequests = userRequests.filter(t => now - t < 3600000);
  
  if (recentRequests.length >= 20) {
    throw new Error('Too many requests (max 20/hour). Please try again later.');
  }
  
  recentRequests.push(now);
  rateLimitMapFallback.set(ip, recentRequests);
  
  // Mapì´ ë„ˆë¬´ ì»¤ì§€ë©´ ì˜¤ëž˜ëœ IP ì •ë¦¬
  if (rateLimitMapFallback.size > MAX_FALLBACK_ENTRIES) {
    const sortedEntries = Array.from(rateLimitMapFallback.entries())
      .sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
    
    const deleteCount = rateLimitMapFallback.size - MAX_FALLBACK_ENTRIES;
    for (let i = 0; i < deleteCount; i++) {
      rateLimitMapFallback.delete(sortedEntries[i][0]);
    }
  }
  
  // â­ ì •ìƒ í†µê³¼ ì‹œ ëª…ì‹œì  return (ë²„ê·¸ ìˆ˜ì •!)
  return;
}




// =====================================
// 가사 출력 후처리: 깨끗한 출력 강제 (오빠 규칙 고정!)
// - 하이픈(-) 유지 (Suno V5 공식 권장: 롱톤 표현용)
// - 음절수 괄호 (3), (4), (5) 완전 제거
// - 배달 노트 [melancholic delivery] 완전 제거
// =====================================
function enforceCleanOutput(text) {
  if (!text || typeof text !== 'string') return text;

  let out = text;

  // 1) ⭐ 하이픈(-) 유지! Suno V5는 하이픈으로 롱톤 표현 (공식 권장)
  // out = out.replace(/-/g, ''); // ← 삭제!

  // 2) ❌ 음절수 괄호 제거: (3), (4), (5), (6) 등
  // 정규식: \(\d+\) = 괄호 안에 숫자만 있는 경우
  out = out.replace(/\(\d+\)/g, '');
  
  // 3) ❌ 배달 노트 제거: [melancholic delivery], [energetic delivery] 등
  // 정규식: \[.*?delivery.*?\] = 대괄호 안에 delivery 포함
  out = out.replace(/\[.*?delivery.*?\]/gi, '');

  // 4) 공백 정리
  out = out.replace(/[\t ]{2,}/g, ' ');
  out = out.replace(/ \n/g, '\n').replace(/\n /g, '\n');

  return out;
}

// 하위 호환성 유지
function enforceNoHyphens(text) {
  return enforceCleanOutput(text);
}

// =====================================
// ìž…ë ¥ ê²€ì¦ í•¨ìˆ˜ (v11.1 ì¶”ê°€)
// =====================================
function validateInput(body) {
  const errors = [];
  
  // keyword ê²€ì¦
  if (!body.keyword || typeof body.keyword !== 'string') {
    errors.push('í‚¤ì›Œë“œëŠ” í•„ìˆ˜ìž…ë‹ˆë‹¤');
  } else {
    const trimmedKeyword = body.keyword.trim();
    if (trimmedKeyword.length === 0) {
      errors.push('í‚¤ì›Œë“œëŠ” ë¹ˆ ì¹¸ì¼ ìˆ˜ ì—†ìŠµë‹ˆë‹¤');
    }
    if (trimmedKeyword.length > 2000) { // â­ 100ìž â†’ 2000ìž (ìƒì‹ì ìœ¼ë¡œ!)
      errors.push('í‚¤ì›Œë“œëŠ” 2000ìž ì´í•˜ë¡œ ìž…ë ¥í•´ì£¼ì„¸ìš”');
    }
    // ì •ìƒì´ë©´ trimëœ ê°’ìœ¼ë¡œ êµì²´
    body.keyword = trimmedKeyword;
  }
  
  // userApiKey ê²€ì¦
  if (!body.userApiKey || typeof body.userApiKey !== 'string') {
    errors.push('API í‚¤ëŠ” í•„ìˆ˜ìž…ë‹ˆë‹¤');
  } else if (body.userApiKey.trim().length === 0) {
    errors.push('API í‚¤ëŠ” ë¹ˆ ì¹¸ì¼ ìˆ˜ ì—†ìŠµë‹ˆë‹¤');
  }
  
  // âœ… modelName ê²€ì¦ (v11.3 ì¶”ê°€ - í—ˆìš© ëª¨ë¸ë§Œ)
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
  
  // genre ê²€ì¦ (ìœ íš¨í•˜ì§€ ì•Šìœ¼ë©´ ê¸°ë³¸ê°’)
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
  
  // structure ê²€ì¦ (ì—†ê±°ë‚˜ ìœ íš¨í•˜ì§€ ì•Šìœ¼ë©´ ê¸°ë³¸ê°’ ê°•ì œ!)
  const validStructures = ['standard', 'short', 'extended'];
  if (!body.structure || !validStructures.includes(body.structure)) {
    if (body.structure) {
      console.warn(`Invalid structure: ${body.structure}, using default (standard)`);
    }
    body.structure = 'standard'; // â­ ì—†ìœ¼ë©´ ë¬´ì¡°ê±´ ê¸°ë³¸ê°’!
  }
  
  // modifier í•„ë“œë“¤ ê¸¸ì´ ì œí•œ (í”„ë¡¬í”„íŠ¸ í­ë°œ ë°©ì§€)
  const modifierFields = [
    'vocalModifier', 'genreFusionModifier', 'vocalConfigModifier',
    'emotionIntensityModifier', 'moodModifier',
    'sectionVerse', 'sectionPrechorus', 'sectionChorus', 'sectionBridge', 'sectionFinal', 'sectionOutro'
  ];
  
  modifierFields.forEach(field => {
    if (body[field] && typeof body[field] === 'string' && body[field].length > 1000) { // â­ 200ìž â†’ 1000ìž
      errors.push(`${field}ëŠ” 1000ìž ì´í•˜ë¡œ ìž…ë ¥í•´ì£¼ì„¸ìš”`);
    }
  });
  
  // ì—ëŸ¬ê°€ ìžˆìœ¼ë©´ throw
  if (errors.length > 0) {
    const error = new Error(errors.join(', '));
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  
  return body;
}

// =====================================
// ì—ëŸ¬ ì‘ë‹µ í—¬í¼ í•¨ìˆ˜ (v11.1 ì¶”ê°€)
// =====================================
function errorResponse(res, status, message, code = 'UNKNOWN_ERROR', retryable = false) {
  return res.status(status).json({
    error: message,
    error_code: code,
    retryable: retryable,
    timestamp: new Date().toISOString()
  });
}

// ìž¥ë¥´ë³„ ê°€ì‚¬ ê³µì‹ ì„¤ì •
const GENRE_CONFIGS = {
  // ðŸ’Ž ê°ì„± ìž¥ì¸ íŒ© (ë°œë¼ë“œ ê³„ì—´)
  pop80s: {
    name: '80s íŒ ë°œë¼ë“œ',
    syllableRule: '3-6ìŒì ˆ (ìžì—°ìŠ¤ëŸ¬ìš´ í˜¸í¡)',
    finalChorusMax: 8,
    chorusLines: '5-6ì¤„',
    special: 'í’ë¶€í•œ í™”ìŒê³¼ ê°ì •ì  ë¹Œë“œì—…'
  },
  trot: {
    name: 'ì •í†µ íŠ¸ë¡œíŠ¸',
    syllableRule: '3-6ìŒì ˆ (êº¾ê¸° ìœ ë„)',
    finalChorusMax: 8,
    chorusLines: '5-6ì¤„',
    special: 'í•œ(æ¨)ì˜ ë¯¸í•™, ì–µì œëœ ìŠ¬í””, êº¾ê¸° ê¸°ë²•(kkeok-gi) í•„ìˆ˜'
  },
  ballad: {
    name: 'í•œêµ­í˜• ê°ì„± ë°œë¼ë“œ',
    syllableRule: '3-6ìŒì ˆ',
    finalChorusMax: 8,
    chorusLines: '5-6ì¤„',
    special: 'ë„“ì€ ë¹„ë¸Œë¼í† , ë©œë¡œë”” ì¤‘ì‹¬'
  },
  acoustic_folk: {
    name: 'ì–´ì¿ ìŠ¤í‹± í¬í¬',
    syllableRule: '3-6ìŒì ˆ (ìžì—°ìŠ¤ëŸ¬ìš´ ë§íˆ¬)',
    finalChorusMax: 8,
    chorusLines: '5-6ì¤„',
    special: 'ì´ì•¼ê¸° ì „ë‹¬ ì¤‘ì‹¬, ëŒ€í™”í•˜ë“¯ ìžì—°ìŠ¤ëŸ½ê²Œ'
  },
  rock_ballad: {
    name: 'ë¡ ë°œë¼ë“œ',
    syllableRule: '3-6ìŒì ˆ (ê³ ìŒ ë¡±í†¤ ìœ ë„)',
    finalChorusMax: 9,
    chorusLines: '5-6ì¤„',
    special: 'ì ˆì œëœ íž˜, ê³ ìŒ í­ë°œì€ Final Chorusì—ë§Œ 1íšŒ!'
  },
  rnb: {
    name: 'í•œêµ­í˜• R&B ë°œë¼ë“œ',
    syllableRule: '3-6ìŒì ˆ',
    finalChorusMax: 8,
    chorusLines: '5-6ì¤„',
    special: 'Call-and-response, ìŠ¤íƒ ë³´ì»¬, ê°•ë ¥í•œ í´ë¼ì´ë§¥ìŠ¤'
  },
  
  // ðŸŽµ MZ ì‡¼ì¸  íŒ©
  kpop_dance: {
    name: 'K-Pop ì•„ì´ëŒ ëŒ„ìŠ¤',
    syllableRule: 'ìžìœ  (í›„í¬ëŠ” 2-3ìŒì ˆ ë°˜ë³µ)',
    finalChorusMax: 12,
    chorusLines: '6-8ì¤„',
    special: 'ì¤‘ë…ì„± í›„í¬ ë°˜ë³µì´ ìƒëª…! "ë‚˜ë‚˜ë‚˜", "ì˜ˆì˜ˆì˜ˆ" ê°™ì€ ìºì¹˜í”„ë ˆì´ì¦ˆ í•„ìˆ˜! ìŒì ˆ ì œí•œ ì—†ì´ ë¦¬ë“¬ê° ìš°ì„ !'
  },
  city_pop: {
    name: 'ì‹œí‹° íŒ',
    syllableRule: '4-6ìŒì ˆ (ì—¬ìœ ë¡œìš´ ê·¸ë£¨ë¸Œ)',
    finalChorusMax: 10,
    chorusLines: '6-7ì¤„',
    special: 'ì§ì„¤ì  ìŠ¬í””ë³´ë‹¤ ë„ì‹œì  ë‚­ë§Œê³¼ í–¥ìˆ˜ í‘œí˜„'
  },
  lofi_hiphop: {
    name: 'ë¡œíŒŒì´ íž™í•©',
    syllableRule: 'ìµœì†Œ (ì¸ìŠ¤íŠ¸ë£¨ë©˜íƒˆ ì¤‘ì‹¬)',
    finalChorusMax: 4,
    chorusLines: '2-3ì¤„',
    special: 'ê°€ì‚¬ ê±°ì˜ ì—†ìŒ! ì§§ì€ í›„ë ´ ë˜ëŠ” í—ˆë°ë§Œ! "hmm...", "yeah..." ê°™ì€ ìµœì†Œ ë³´ì»¬! ë¶„ìœ„ê¸° ì¤‘ì‹¬!'
  },
  
  // ðŸŒŸ ìŠ¤íŽ˜ì…œ ì—ë””ì…˜
  europop: {
    name: 'ABBA ìŠ¤íƒ€ì¼ ìœ ë¡œíŒ',
    syllableRule: '3-5ìŒì ˆ (ë‹¤ì¸µ í™”ìŒ ìœ ë„)',
    finalChorusMax: 9,
    chorusLines: '6-7ì¤„',
    special: 'ì‚¬ìš´ë“œì˜ ë²½! ë“œë¼ë§ˆí‹±í•œ ì „ê°œì™€ í’ë¶€í•œ í™”ìŒ'
  },
  metal: {
    name: 'ì‹¬í¬ë‹‰/ê³ ë”• ë©”íƒˆ',
    syllableRule: '3-5ìŒì ˆ',
    finalChorusMax: 9,
    chorusLines: '6-7ì¤„',
    special: 'ì˜¤íŽ˜ë¼í‹± ë³´ì»¬, ê±°ëŒ€í•œ ì‹¬í¬ë‹‰ í•©ì°½ë‹¨'
  },
  
  // ðŸŒ ê¸€ë¡œë²Œ ížˆíŠ¸ íŒ©
  hip_hop_boom_bap: {
    name: 'Hip-Hop Boom Bap',
    syllableRule: '7-12ìŒì ˆ (ìœ ë™ì )',
    finalChorusMax: 10,
    chorusLines: '4-6ì¤„ (Hook)',
    special: 'End Rhyme í•„ìˆ˜ (AABB/ABAB), Internal Rhyme ê¶Œìž¥, ëª…í™•í•œ ë°œìŒ, 90s ê³¨ë“  ì—ì´ì§€ ë°”ì´ë¸Œ'
  },
  trap_melodic: {
    name: 'Melodic Trap',
    syllableRule: '7-12ìŒì ˆ (Triplet flow)',
    finalChorusMax: 8,
    chorusLines: '4-6ì¤„',
    special: 'Auto-Tune ë©œë¡œë”• ëž©, 3ì—°ìŒ í™œìš©, ê°ì„±ì  ì „ë‹¬, ë…¸ëž˜+ëž© í˜¼í•©'
  },
  funk_pop: {
    name: 'Funk Pop',
    syllableRule: '5-10ìŒì ˆ (ìžìœ ë¡œì›€)',
    finalChorusMax: 10,
    chorusLines: '6-8ì¤„',
    special: 'Syncopation ì¤‘ìš”, Call-and-Response êµ¬ì¡°, ê·¸ë£¨ë¹„í•œ ë² ì´ìŠ¤ë¼ì¸, ë¸Œë¼ìŠ¤ ì„¹ì…˜'
  },
  reggaeton: {
    name: 'Reggaeton',
    syllableRule: '7-12ìŒì ˆ (ëž˜í•‘ ìŠ¤íƒ€ì¼)',
    finalChorusMax: 8,
    chorusLines: '4-6ì¤„ (Hook)',
    special: 'Dembow rhythm (3+3+2), Hook ìµœì†Œ 3íšŒ ë°˜ë³µ í•„ìˆ˜, ëž˜í•‘+ë…¸ëž˜ í˜¼í•©, ë¼í‹´ ë°”ì´ë¸Œ'
  },
  future_bass: {
    name: 'Future Bass',
    syllableRule: '4-8ìŒì ˆ (ì§§ê²Œ)',
    finalChorusMax: 6,
    chorusLines: '3-5ì¤„',
    special: 'Vocal chops ê³ ë ¤, ê·¹ë„ë¡œ ì§§ì€ êµ¬ì ˆ, Dropì€ ë³´ì»¬ ìµœì†Œ, ê°ì„±ì  ì—ë„ˆì§€'
  },
  indie_pop: {
    name: 'Indie Pop (Bedroom Pop)',
    syllableRule: '3-10ìŒì ˆ (ìžìœ ë¡œì›€)',
    finalChorusMax: 8,
    chorusLines: '4-6ì¤„',
    special: 'ì§„ì†”í•¨ê³¼ ì·¨ì•½í•¨, Lo-fi ê°ì„±, ë¹„ì „í†µì  êµ¬ì¡° ê°€ëŠ¥, Spoken-wordì²˜ëŸ¼ ìžì—°ìŠ¤ëŸ½ê²Œ'
  }
};

// =====================================
// í† í° ìžë™ ì¡°ì ˆ í•¨ìˆ˜ (v11.3 ì¶”ê°€)
// =====================================
function getMaxOutputTokens(genre, structure) {
  // lo-fiëŠ” ê°€ì‚¬ê°€ ê±°ì˜ ì—†ìœ¼ë‹ˆ í¬ê²Œ ì¤„ì—¬ë„ ë¨
  if (genre === 'lofi_hiphop') return 900;
  
  // future_bassë„ ì§§ê²Œ
  if (genre === 'future_bass') return 1500;
  
  // êµ¬ì¡°ë³„ë¡œ ëŒ€ëžµ ì»· (ë¹„ìš© ì ˆê°)
  if (structure === 'short') return 2200;
  if (structure === 'extended') return 3800;
  
  // standard (ê¸°ë³¸)
  return 3000;
}

// =====================================
// 장르별 최적 온도(Temperature) 설정 (v11.8 추가)
// =====================================
function getTemperature(genre) {
  // 🎯 규칙 엄수형 (0.3 ~ 0.4): 8대 원칙 엄수가 최우선
  const strictGenres = ['pop80s', 'trot', 'ballad', 'acoustic_folk', 'lofi_hiphop'];
  if (strictGenres.includes(genre)) return 0.4;
  
  // 🎵 리듬/감성 조절형 (0.5 ~ 0.6): 규칙 + 세련미
  const balancedGenres = ['rnb', 'rock_ballad', 'city_pop', 'hip_hop_boom_bap'];
  if (balancedGenres.includes(genre)) return 0.5;
  
  // 🔥 창의성 폭발형 (0.7 ~ 0.8): 중독성 있는 후크 창작
  const creativeGenres = ['kpop_dance', 'funk_pop', 'reggaeton', 'trap_melodic', 'future_bass', 'indie_pop', 'europop', 'metal'];
  if (creativeGenres.includes(genre)) return 0.7;
  
  // 기본값 (발라드 계열 기준)
  return 0.4;
}

module.exports = async (req, res) => {
  // CORS í—¤ë” ì„¤ì • (v11.4 ë³´ì•ˆ ê°•í™”)
  // â­ ë³´ì•ˆ ê°œì„ : íŠ¹ì • ë„ë©”ì¸ë§Œ í—ˆìš©
  const allowedOrigins = [
    'https://suno-helper-backend.vercel.app',
    'http://localhost:3000', // ë¡œì»¬ í…ŒìŠ¤íŠ¸ìš© (ì„ íƒ)
    'https://suno-helper.com',  // 오빠 커스텀 도메인!
    'http://localhost:5000'  // ë¡œì»¬ í…ŒìŠ¤íŠ¸ìš© (ì„ íƒ)
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // í—ˆìš©ë˜ì§€ ì•Šì€ ë„ë©”ì¸ì€ ê¸°ë³¸ê°’
    res.setHeader('Access-Control-Allow-Origin', 'https://suno-helper-backend.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // â­ ë³´ì•ˆ í—¤ë” ì¶”ê°€ (v11.5)
  res.setHeader('X-Content-Type-Options', 'nosniff'); // MIME íƒ€ìž… ìŠ¤ë‹ˆí•‘ ë°©ì§€
  res.setHeader('X-Frame-Options', 'DENY'); // í´ë¦­ìž¬í‚¹ ë°©ì§€
  res.setHeader('X-XSS-Protection', '1; mode=block'); // XSS ê³µê²© ë°©ì§€
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // HTTPS ê°•ì œ

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // â­ ìš”ì²­ í¬ê¸° ì œí•œ (v11.5 - DDoS/í­íƒ„ ìš”ì²­ ë°©ì§€)
    const MAX_PAYLOAD_SIZE = 102400; // 100KB (10KB â†’ 100KBë¡œ ë³€ê²½!)
    const payloadSize = JSON.stringify(req.body).length;
    
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      return errorResponse(
        res,
        413,
        'ìš”ì²­ í¬ê¸°ê°€ ë„ˆë¬´ í½ë‹ˆë‹¤. ìž…ë ¥ê°’ì„ ì¤„ì—¬ì£¼ì„¸ìš”.',
        'PAYLOAD_TOO_LARGE',
        false
      );
    }

    // Rate Limiting ì²´í¬ (v11.6 - Vercel KV)
    const xff = req.headers['x-forwarded-for'];
    const clientIP = xff 
      ? (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim()
      : (req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown');
    await checkRateLimit(clientIP); // â­ Vercel KVëŠ” async!

    // âœ… ìž…ë ¥ ê²€ì¦ (v11.1 ì¶”ê°€)
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

    // ìž¥ë¥´ ì„¤ì • ê°€ì ¸ì˜¤ê¸°
    const genreConfig = GENRE_CONFIGS[genre] || GENRE_CONFIGS['pop80s'];

    // â˜…â˜…â˜… êµ¬ì¡°ë³„ íƒ€ìž„ë¼ì¸ â˜…â˜…â˜…
    const STRUCTURE_TIMELINES = {
      'standard': { info: '3:40 (í‘œì¤€)', intro: '0:08', v1: '0:28', pre1: '0:16', c1: '0:32', break: '0:15', v2: '0:28', pre2: '0:16', c2: '0:32', bridge: '0:24', build: '0:12', final: '0:37', outro: '0:12' },
      'short': { info: '2:30 (ì‡¼ì¸ )', intro: '0:05', v1: '0:22', pre1: '0:12', c1: '0:28', break: '0:00', v2: '0:00', pre2: '0:12', c2: '0:28', bridge: '0:18', build: '0:08', final: '0:30', outro: '0:07' },
      'extended': { info: '4:30 (í’€ë²„ì „)', intro: '0:12', v1: '0:32', pre1: '0:18', c1: '0:36', break: '0:20', v2: '0:32', pre2: '0:18', c2: '0:36', bridge: '0:28', build: '0:15', final: '0:42', outro: '0:15' }
    };

    // â˜…â˜…â˜… ìž¥ë¥´ë³„ ì™„ì „ ë§žì¶¤ í”„ë¡¬í”„íŠ¸ ìƒì„± â˜…â˜…â˜…
    let lyricsPrompt = '';

    // === MZ ì‡¼ì¸  íŒ© ===
    if (genre === 'kpop_dance') {
      lyricsPrompt = generateKPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'lofi_hiphop') {
      lyricsPrompt = generateLofiPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier);
    } else if (genre === 'city_pop') {
      lyricsPrompt = generateCityPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } 
    // === ê¸€ë¡œë²Œ ížˆíŠ¸ íŒ© ===
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
    // === ë°œë¼ë“œ ê³„ì—´ (ê¸°ë³¸ ê³µì‹) ===
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

    // Gemini API í˜¸ì¶œ (v11.3 ê°œì„ : í—¤ë” ë°©ì‹ + í† í° ìžë™ ì¡°ì ˆ)
    const model = modelName || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const payload = {
      contents: [{ parts: [{ text: lyricsPrompt }] }],
      generationConfig: {
        temperature: getTemperature(genre), // ⭐ 장르별 최적 온도 (v11.8)
        topK: 40,
        topP: 0.95,
        maxOutputTokens: getMaxOutputTokens(genre, structure) // â­ ìž¥ë¥´/êµ¬ì¡°ë³„ ìžë™ ì¡°ì ˆ
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': userApiKey // â­ URLì´ ì•„ë‹Œ í—¤ë”ë¡œ ì „ì†¡ (ë³´ì•ˆ í–¥ìƒ)
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Gemini API Error: ${response.status} - ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const rawLyrics = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'ìƒì„± ì‹¤íŒ¨';
    const lyrics = enforceNoHyphens(rawLyrics);

    return res.status(200).json({ lyrics });

  } catch (error) {
    console.error('Error:', error);
    
    // âœ… ì—ëŸ¬ íƒ€ìž…ë³„ ì‘ë‹µ (v11.1 ê°œì„ )
    
    // 1. ìž…ë ¥ ê²€ì¦ ì—ëŸ¬
    if (error.code === 'VALIDATION_ERROR') {
      return errorResponse(res, 400, error.message, 'VALIDATION_ERROR', false);
    }
    
    // 2. Rate Limit ì—ëŸ¬
    if (error.message.includes('Too many requests')) {
      return errorResponse(res, 429, error.message, 'RATE_LIMIT_EXCEEDED', true);
    }
    
    // 3. Gemini API ì—ëŸ¬
    if (error.message.includes('Gemini API Error')) {
      const isRetryable = error.message.includes('429') || error.message.includes('503');
      return errorResponse(
        res, 
        500, 
        'Gemini API í˜¸ì¶œì— ì‹¤íŒ¨í–ˆìŠµë‹ˆë‹¤. API í‚¤ë¥¼ í™•ì¸í•˜ê±°ë‚˜ ìž ì‹œ í›„ ë‹¤ì‹œ ì‹œë„í•´ì£¼ì„¸ìš”.', 
        'GEMINI_API_ERROR', 
        isRetryable
      );
    }
    
    // 4. ê¸°íƒ€ ì„œë²„ ì—ëŸ¬
    return errorResponse(
      res, 
      500, 
      'ì„œë²„ ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤. ìž ì‹œ í›„ ë‹¤ì‹œ ì‹œë„í•´ì£¼ì„¸ìš”.', 
      'SERVER_ERROR', 
      true
    );
  }
};

// =====================================
// K-Pop ëŒ„ìŠ¤ ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateKPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI K-Pop Dance Lab" - elite K-Pop songwriting system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate K-Pop Dance lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ K-POP DANCE RULES (CRITICAL!):

1ï¸âƒ£ **HOOK REPETITION** (Most important!):
   - Create ADDICTIVE 2-3 syllable hook (ì˜ˆ: "ë‚˜ë‚˜ë‚˜", "ì˜ˆì˜ˆì˜ˆ", "ì˜¤ì˜¤ì˜¤")
   - Repeat hook 4-6 times in EVERY chorus
   - Hook should be catchy and easy to sing along
   - Examples: "ë‘ê·¼ë‘ê·¼", "ë°˜ì§ë°˜ì§", "ë¹™ê¸€ë¹™ê¸€"

2ï¸âƒ£ **SYLLABLE FREEDOM** (No 3-5 limit!):
   - Verse/Pre-Chorus: Any syllable count OK for rhythm
   - Chorus: Focus on rhythmic repetition, not syllable limits
   - Final Chorus: Up to **12 lines** allowed (not 8!)
   - More lines = more energy!

3ï¸âƒ£ **RHYTHM OVER MELODY**:
   - K-Pop is rhythm-first, NOT melody-first
   - Use percussive words: "íƒíƒíƒ", "ì¿µì¿µì¿µ"
   - Short bursts of energy better than long melodic lines

4ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
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

5ï¸âƒ£ **CHORUS VARIATION** (MUST!):
   ${autoChorusVariation || abModeActive ? `
   - Chorus 1, 2, Final MUST have different verses
   - Keep ONLY the hook the same
   - Change the rap-like verses around the hook
   - Example:
     * Chorus 1: "verse1 / ë‚˜ë‚˜ë‚˜ ë‚˜ë‚˜ë‚˜ / verse2 / ë‚˜ë‚˜ë‚˜ ë‚˜ë‚˜ë‚˜"
     * Chorus 2: "DIFFERENT1 / ë‚˜ë‚˜ë‚˜ ë‚˜ë‚˜ë‚˜ / DIFFERENT2 / ë‚˜ë‚˜ë‚˜ ë‚˜ë‚˜ë‚˜"
   ` : `
   - Hook stays the same
   - Verses can vary slightly
   `}

6ï¸âƒ£ **HARMONY** (K-Pop style):
   - (tight idol harmonies) in all choruses
   - (power vocals) in Final Chorus
   - NO counterpoint ad-libs (they break K-Pop rhythm!)
   - Korean ad-libs OK: (yeah!), (let's go!), (come on!)

7ï¸âƒ£ **NO BALLAD VIBES**:
   - NO tildes (~) for long notes
   - NO slow vibrato
   - Fast, energetic, percussive!

8ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Heavy synth-bass drop, EDM build-up)
   - [Verse 1]: (Minimal beat, synth stabs, clear vocals)
   - [Pre-Chorus]: (Energy rising, drums building, tension)
   - [Chorus]: (Full EDM drop, heavy bass, synth lead, powerful beat)
   - [Dance Break]: (Instrumental, heavy bass, no vocals)
   - [Bridge]: (Stripped down, just synth pad and vocal)
   - [Dance Break Build]: (Building intensity, risers, tension)
   - **[Key change up]** â† MANDATORY TAG!
   - [Final Chorus]: (Maximum energy, all instruments, vocal power)

9ï¸âƒ£ **OUTPUT FORMAT**:
   - Title: "ì œëª©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts (3), (4), (5) in output!
   - NO delivery notes [energetic delivery] in output!
   - âŒ NO hyphens "-" in lyrics! K-Pop uses rhythm, not long notes.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… K-POP CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ 2-3 syllable hook created?
â–¡ Hook repeated 4-6 times per chorus?
â–¡ Final Chorus 8-12 lines?
â–¡ Rhythm-focused, not melody-focused?
â–¡ NO tildes (~)?
â–¡ Chorus variation (if enabled)?
â–¡ Clean output (no annotations)?

ðŸŽµ Generate K-Pop Dance lyrics now!
  `;
}

// =====================================
// ë¡œíŒŒì´ íž™í•© ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateLofiPrompt(keyword, config, timeline, vocalModifier) {
  return `
You are "Suno AI Lo-fi Lab" - minimalist Lo-fi hip-hop system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate Lo-fi Hip-hop lyrics for "${keyword}"
Structure: ${timeline.info}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ LO-FI RULES (MINIMAL VOCALS!):

1ï¸âƒ£ **MINIMAL LYRICS** (Most important!):
   - This is INSTRUMENTAL-FOCUSED music!
   - Very few lyrics - mostly humming/vocalizations
   - Examples: "hmm...", "yeah...", "uh...", "ah..."
   - Keep it chill and atmospheric

2ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): (no lyrics - just instrumental)
   - Verse 1 (${timeline.v1}): **1-2 lines MAX** (soft spoken)
   - Chorus (${timeline.c1}): **2-3 lines** (humming or minimal words)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **1-2 lines MAX**` : ''}
   - Chorus 2 (${timeline.c2}): **2-3 lines** (same or slight variation)
   - Bridge (${timeline.bridge}): **1-2 lines** (whispered)
   - Final Chorus (${timeline.final}): **3-4 lines MAX** (fade out)
   - Outro (${timeline.outro}): (no lyrics - instrumental fade)

3ï¸âƒ£ **VOCAL STYLE**:
   - Spoken/whispered, NOT sung
   - Soft, breathy, intimate
   - Example: "ë¹—ì†Œë¦¬... ì°½ë¬¸ì—... ë©í•˜ë‹ˆ..."
   - NO powerful vocals, NO belting

4ï¸âƒ£ **HARMONY**:
   - NO harmonies needed
   - Just soft, single voice
   - Or just humming: "hmm... hmm..."

5ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Jazzy piano loop, vinyl crackle, dusty atmosphere)
   - [Verse 1]: (Soft boom bap drums enter, mellow piano)
   - [Chorus]: (Bass adds gentle groove, atmospheric pads)
   - [Bridge]: (Piano solo, minimal drums)
   - [Instrumental Build]: (Gentle build, subtle layers)
   - **[Key change up]** â† Optional for lo-fi
   - [Final Chorus]: (All elements, but still chill and mellow)
   - [Outro]: (Piano fades, vinyl crackle remains)

6ï¸âƒ£ **OUTPUT FORMAT**:
   - Very short output!
   - Most sections have NO lyrics (instrumental)
   - Only a few soft spoken/hummed lines total
   - âŒ NO hyphens "-" in lyrics!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… LO-FI CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ Minimal lyrics (under 20 lines total)?
â–¡ Soft spoken/whispered style?
â–¡ Lots of instrumental sections?
â–¡ Chill vibe maintained?

ðŸŽµ Generate Lo-fi Hip-hop lyrics now!
  `;
}

// =====================================
// ì‹œí‹°íŒ ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateCityPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI City Pop Lab" - retro 80s City Pop system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate City Pop lyrics for "${keyword}"
Structure: ${timeline.info}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ CITY POP RULES:

1ï¸âƒ£ **SYLLABLE RULE** (4-6 syllables, relaxed groove):
   - Verse/Pre-Chorus: 4-6 syllables (more relaxed than ballad)
   - Chorus: 4-6 syllables (smooth, not choppy)
   - Final Chorus: **10 lines MAX**

2ï¸âƒ£ **VIBE** (Urban nostalgia, NOT sadness):
   - Focus on city lights, late nights, coffee, jazz bars
   - Romantic but NOT tragic
   - Breezy, sophisticated, feel-good
   - Examples: "ë„¤ì˜¨ ë¶ˆë¹›", "ìž¬ì¦ˆ ì¹´íŽ˜", "ë„ì‹œì˜ ë°¤", "í…… ë¹ˆ ê±°ë¦¬"

3ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
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

4ï¸âƒ£ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Chorus 1, 2, Final MUST vary
   - Keep 1 anchor line the same
   - Change the rest with different urban imagery
   ` : `
   - Some variation recommended for sophistication
   `}

5ï¸âƒ£ **HARMONY** (Jazzy, smooth):
   - (smooth jazz harmonies) in choruses
   - ${abModeActive ? '2-3' : '1-2'} English ad-libs: (city lights), (midnight drive)
   - (voices blend) in Final Chorus

6ï¸âƒ£ **TILDES** (Moderate use):
   - Use ~ for smooth sustained notes
   - But NOT as much as ballads
   - Distribution: Verse (minimal) â†’ Chorus (moderate)

7ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Shimmering synth arpeggio, funky bass line)
   - [Verse 1]: (Clean electric guitar, soft drums, intimate vocal)
   - [Pre-Chorus]: (Synth layers build, bass groove intensifies)
   - [Chorus]: (Full 80s production, shimmering synths, funky bass, breezy vocals)
   - [Instrumental Break]: (Saxophone solo over funky groove)
   - [Bridge]: (Stripped to synth pad and vocal)
   - [Instrumental Build]: (Funky bass, synth arpeggios, building tension)
   - **[Key change up]** â† MANDATORY TAG!
   - [Final Chorus]: (Maximum 80s polish, all synth layers, warm analog sound)

8ï¸âƒ£ **OUTPUT FORMAT**:
   - NO syllable counts in output!
   - NO delivery notes in output!
   - âŒ NO hyphens "-" in lyrics! Use "~" for smooth sustained notes.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… CITY POP CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ 4-6 syllables per line?
â–¡ Final Chorus 10 lines max?
â–¡ Urban/romantic vibe (not tragic)?
â–¡ Smooth, jazzy feel?
â–¡ Chorus variation?

ðŸŽµ Generate City Pop lyrics now!
  `;
}

// =====================================
// ë°œë¼ë“œ ê³„ì—´ ê¸°ë³¸ í”„ë¡¬í”„íŠ¸ (ê¸°ì¡´ ê³µì‹)
// =====================================
function generateBalladPrompt(keyword, genre, config, timeline, vocalModifier, genreFusionModifier, vocalConfigModifier, emotionIntensityModifier, moodModifier, autoChorusVariation, sectionVerse, sectionPrechorus, sectionChorus, sectionBridge, sectionFinal, sectionOutro, abModeActive) {
  
  // ABBA ìŠ¤íƒ€ì¼ íŠ¹ë³„ ì²˜ë¦¬
  const abbaSpecial = (genre === 'pop80s') ? `
âš ï¸ ABBA STYLE SPECIAL RULES (Wall of Sound):
- Rich, multi-layered MALE AND FEMALE vocal harmonies
- Piano-driven power pop with lush orchestral strings
- Absolutely NO shouting, NO belting - controlled delivery only
- Create "Wall of Sound" with stacked vocals and instruments
- Catchy hooks with unexpected melodic twists
` : '';

  // íŠ¸ë¡œíŠ¸ íŠ¹ë³„ ì²˜ë¦¬
  const trotSpecial = (genre === 'trot') ? `
âš ï¸ TROT SPECIAL RULES:
- Emphasize "han" (æ¨) - deep unresolved sorrow
- Use Korean twist technique (kkeok-gi) in Final Chorus
- Vibrato should be wide and expressive
- Repressed emotion, NOT explosion
- Avoid direct emotion words, use sensory imagery
- Include [Climb] section before Chorus for emotional peak
` : '';

  // í¬í¬ íŠ¹ë³„ ì²˜ë¦¬
  const folkSpecial = (genre === 'acoustic_folk') ? `
âš ï¸ FOLK SPECIAL RULES:
- Storyteller vibe - conversational, natural phrasing
- Avoid overly poetic language, keep it sincere
- Focus on narrative and personal details
- Simple imagery: "ë‚¡ì€ ê¸°íƒ€", "ë¹ˆ ì˜ìž", "ì°¨ê°€ìš´ ì»¤í”¼"
` : '';

  // ë¡ ë°œë¼ë“œ íŠ¹ë³„ ì²˜ë¦¬
  const rockSpecial = (genre === 'rock_ballad') ? `
âš ï¸ ROCK BALLAD SPECIAL RULES:
- Controlled power - don't scream!
- High note ONLY in Final Chorus (one controlled belt)
- Build intensity gradually from Verse to Final
- Epic orchestral strings in Final Chorus
` : '';

  return `
You are "Suno AI Ballad Mastery Lab" - elite Korean songwriting system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate professional ${config.name} lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ”¥ðŸ”¥ðŸ”¥ 8ëŒ€ ì›ì¹™ (ì ˆëŒ€ ì¤€ìˆ˜!) ðŸ”¥ðŸ”¥ðŸ”¥
**âš ï¸ Korean vs English = Different Rules!**
â‘  í•œê¸€: 3~6ìŒì ˆ / English: 8~12ìŒì ˆ (ì–¸ì–´ë³„ ë‹¤ë¦„!)
â‘¡ Final Chorus 7~8ì¤„ ì ˆëŒ€ í•œê³„!
â‘¢ ì½”ëŸ¬ìŠ¤ ì™„ì „ ë°˜ë³µ ê¸ˆì§€ (ì•µì»¤ 1ì¤„ë§Œ!)
â‘£ ë©œë¡œë”” ë³€í™” í•„ìˆ˜!
â‘¤ ë¡±í†¤ í‹¸ë“œ(~) ì „ëžµì  ë°°ì¹˜! (í•˜ì´í”ˆ ì•„ë‹˜!)
â‘¥ ëŒ€ìœ„ë²• í•„ìˆ˜ (ì—°ì† ê¸ˆì§€ + ~( ) ê°™ì€ ì¤„ ê¸ˆì§€!)
â‘¦ Final Chorus í™”ìŒ 3ê²¹!
â‘§ ì• ë“œë¦½ 2ì¤„ ì´í•˜!
**Version Note:** V4.5+ = emotional depth, V5 = precision
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

${abbaSpecial}
${trotSpecial}
${folkSpecial}
${rockSpecial}

ðŸ“‹ ABSOLUTE RULES (NEVER VIOLATE):

1ï¸âƒ£ **SYLLABLE RULE** (CRITICAL - Language-specific!):
   
   ðŸ‡°ðŸ‡· **KOREAN LYRICS** (3~6 syllables - Natural flow!):
   - **Verse: 3~6 syllables** (7+ = rap delivery!)
   - **Pre-Chorus: 3~5 syllables** (shorter = tension build!)
   - **Chorus: 4~6 syllables** (sweet spot: 5~6)
   - **Bridge: 3~6 syllables**
   - **Final Chorus: 4~7 syllables** (8+ = rap!)
   - **Outro: 2~5 syllables** (shorter = emotional fade)
   - âš ï¸ Korean: 7+ syllables = GUARANTEED rap delivery!
   
   **Korean Examples:**
   âœ… "ì†ë ì°¨ê°€ì›Œ" (4ìŒì ˆ)
   âœ… "ëŒì•„ê°€" (3ìŒì ˆ)
   âœ… "ë„ˆë¬´ë‚˜ë„ ê·¸ë¦¬ì›Œ" (6ìŒì ˆ) â† Perfect!
   âŒ "ë„ˆë¬´ë‚˜ë„ ë³´ê³  ì‹¶ì–´ì„œ" (7ìŒì ˆ = ëž©!)
   
   ðŸ‡ºðŸ‡¸ **ENGLISH LYRICS** (8~12 syllables - More flexible):
   - **Verse: 8~10 syllables per line**
   - **Chorus: 10~12 syllables per line**
   - **Bridge: 6~10 syllables**
   - **Final Chorus: 10~12 syllables**
   - English allows longer lines without rap effect
   
   **English Examples:**
   âœ… "Walking through the shadows of my mind" (9 syllables)
   âœ… "I can't forget the way you looked at me" (11 syllables)
   
   âš ï¸ **VERSION DIFFERENCES** (Suno AI Model Behavior):
   - **V4.5+**: More flexible, handles 6 Korean syllables gracefully
   - **V5**: Stricter syllable adherence, better for precision
   - **Both versions produce different vibes** - neither is "better," choose based on desired feel
   - V4.5+ = richer vibrato, emotional depth for Korean ballads
   - V5 = cleaner pronunciation, better genre mixing

2️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info} @ 72-84 BPM):
   
   🔥🔥🔥 YOU MUST GENERATE ALL SECTIONS BELOW - NO EXCEPTIONS! 🔥🔥🔥
   
   **⭐ COMPLETE SONG STRUCTURE (EVERY SECTION MANDATORY!):**
   ✅ [Intro] (${timeline.intro}): 2 lines
   ✅ [Verse 1] (${timeline.v1}): **4 lines ONLY**
   ✅ [Pre-Chorus] (${timeline.pre1}): **2 lines ONLY**
   ✅ [Chorus] (${timeline.c1}): **${config.chorusLines}**
   ${timeline.break !== '0:00' ? `✅ [Instrumental Break] (${timeline.break}): (no lyrics)` : ''}
   ${timeline.v2 !== '0:00' ? `✅ [Verse 2] (${timeline.v2}): **4 lines ONLY**` : ''}
   ✅ [Pre-Chorus] (${timeline.pre2}): **2 lines ONLY**
   ✅ [Chorus] (${timeline.c2}): **${config.chorusLines}**
   ✅✅✅ **[Bridge]** (${timeline.bridge}): **4 lines** ← DO NOT SKIP THIS SECTION!
   ✅ [Instrumental Build] (${timeline.build}): (no lyrics)
   ✅✅✅ **[Key change up]** ← MANDATORY TAG! Write this tag exactly!
   ✅✅✅ **[Final Chorus]** (${timeline.final}): **${config.finalChorusMax} lines MAX!** ← DO NOT SKIP! (${config.finalChorusMax + 1}+ = guaranteed rap!)
   ✅ [Outro] (${timeline.outro}): 2 lines
   
   🚨🚨🚨 CRITICAL RULES 🚨🚨🚨
   - Bridge, [Key change up], and [Final Chorus] are NOT OPTIONAL!
   - Stopping at Chorus 2 is INCOMPLETE - you MUST continue to Final Chorus!
   - ALL sections listed above MUST appear in your output!


3ï¸âƒ£ **CHORUS REPETITION BAN** (CRITICAL!):
   ${autoChorusVariation || abModeActive ? `
   ðŸ”¥ðŸ”¥ðŸ”¥ CHORUS VARIATION MANDATORY ðŸ”¥ðŸ”¥ðŸ”¥
   ` : ''}
   âŒ FORBIDDEN: Identical lyrics across Chorus 1, 2, Final
   âœ… REQUIRED: 
   - **Pick 1 "anchor line"** that stays the same
   - **ALL other lines MUST vary** (different words, imagery, perspective)
   - Example:
     * Chorus 1: "ìž…ìˆ ì€ ì›ƒê³  (anchor) / ëˆˆì€ ì –ì–´ ê°€ / ë„ˆ ì—†ëŠ” ì‹íƒ / í˜¼ìž ë‚¨ì€ ì£„"
     * Chorus 2: "ìž…ìˆ ì€ ì›ƒê³  (same anchor) / ì†ì´ í…… ë¹„ì–´ ê°€ (NEW!) / ì°¨ê°€ìš´ ê·¸ë¦‡ë§Œ (NEW!) / í•˜ë‚˜ ë‚¨ì€ ë°¤ (NEW!)"

4ï¸âƒ£ **MELODY VARIATION TECHNIQUES**:
   a) **Syllable Count Shifts**: 3 â†’ 4 â†’ 5 â†’ 4 pattern (create rhythmic interest)
   b) **Sentence Structure**: Mix noun/verb/adjective phrases
   c) **Consonant Ending Strategy**: 
      - Soft endings (ã„¹/ã…‡) for sustained notes
      - Hard endings (ã…‚/ã„±/ã„·) for abrupt stops
   d) **Tilde Placement**: Irregular distribution across lines
   e) **Ellipsis Usage** (ë§ì¤„ìž„í‘œ):
      - Max 0~2 per section
      - Use for emotional pause, hesitation
      - Examples: "ê·¸ëŸ° ì‚¬ëžŒì¸ ê±¸...", "ë‚¨ì•„ì„œ..."
      - âš ï¸ Too many = feels choppy and amateur!

5ï¸âƒ£ **LONG NOTE HYPHEN** (Suno V5 Official Method):
   - Use **hyphen + vowel repetition** for sustained notes
   - **Open vowels = BEST for long notes!** (ì•„/ì˜¤/ìš°/ìœ¼)
   - Distribution: Verse (minimal) â†’ Chorus (moderate) â†’ Final Chorus (heavy)
   - Examples: "떨려-어" (lo-ove style), "돌아-아", "차가워-어", "흘러-어"
   - Alternative: "사랑해-애-애" (multiple vowels for extra length)
   - Max 2-3 per section
   
   ⚠️ **HYPHEN AND COUNTERPOINT COEXIST**: 
   - Hyphen (-) and English ad-lib ( ) CAN be on the same line (unlike ~)
   - ✅ ALLOWED: "웃던 장면-면 (only you)" → Works perfectly!
   - ✅ ALLOWED: "차가운 밤-암 (cold night)" → No conflict!

6ï¸âƒ£ **HARMONY & COUNTERPOINT** (MANDATORY):
   
   ${abModeActive ? `
   ðŸŽ­ **VERSION B MODE - COUNTERPOINT MAXIMIZED**:
   - **Chorus 1 & 2**: ${abModeActive ? '2-3' : '1-2'} English call-and-response
   - **Final Chorus**: ${abModeActive ? '2-3' : '1-2'} English ad-libs
   ` : `
   - **Chorus 1 & 2**: 1-2 English call-and-response ONLY
   - **Final Chorus**: 1-2 English ad-libs ONLY
   `}
   
   - Placement: **Irregular spacing** (Line 1 & 3, OR Line 2 & 4, NOT consecutive!)
   - âŒ FORBIDDEN: 1+2, 2+3, 3+4 (consecutive = cheap!)
   - Examples: (stay with me), (hold me tight), (fading light)
   - âš ï¸ **Lines with counterpoint ( ) and hyphen (-) work together!**
   
   🚨🚨🚨 COUNTERPOINT CRITICAL RULES 🚨🚨🚨
   
   **RULE 1: SAME LINE ONLY** (NEVER new line!)
   ❌ WRONG - Counterpoint on new line:
   찰나의 조각
   뒤틀린 환영
   (Only shadows dancing in the dark)  ← NEW LINE = FORBIDDEN!
   
   ✅ CORRECT - Counterpoint on same line:
   찰나의 조각
   뒤틀린 환영 (shadows)  ← SAME LINE!
   기괴한 빛깔~
   
   **RULE 2: LENGTH MATCHING** (Korean length = English length!)
   - Korean 4음절 → English 2-3 words (~4 syllables)
   - Examples:
     * "뒤틀린 환영" (4음절) → (twisted dreams) ✅
     * "찰나의 조각" (4음절) → (fading light) ✅
     * "기괴한 빛깔" (4음절) → (strange glow) ✅
   
   ❌ TOO LONG - 7+ words forbidden:
   - "Only shadows dancing in the dark" (7 words) ← TOO LONG!
   - Suno V5 won't harmonize properly with long counterpoint!
   
   ✅ CORRECT LENGTH - Max 3 words:
   - (shadows) ✅
   - (twisted dreams) ✅
   - (fading light) ✅
   - (hold me tight) ✅
   
   - Placement: **Irregular spacing** (Line 1 & 3, OR Line 2 & 4, NOT consecutive!)
   - ❌ FORBIDDEN: 1+2, 2+3, 3+4 (consecutive = cheap!)
   - ⚠️ **Lines with counterpoint ( ) and hyphen (-) work together!**
   
   
   **Final Chorus 3-Layer Harmony**:
   - Layer 1: (warm close harmonies) 
   - Layer 2: (softly echoing) OR (tenderly humming) - pick ONE
   - Layer 3: (voices intertwine)
   - Ad-libs: **2 lines MAXIMUM** - Korean (ì•„~), (ì˜¤~)

7ï¸âƒ£ **LITERARY TONE** (No direct emotion words):
   âŒ FORBIDDEN: "ìŠ¬í”„ë‹¤", "ë³´ê³  ì‹¶ë‹¤", "ì‚¬ëž‘í•´", "ì™¸ë¡œì›Œ"
   âœ… REQUIRED: Sensory imagery & metaphors
   - Examples: "ì°¨ê°€ìš´ ì†ë", "íë¦° ì°½ë¬¸", "ë¹ˆ ì˜ìž", "ì‹œë“  ê½ƒìžŽ"
   - Use symbols: scales, shadows, rain, empty rooms
   - Open endings (don't resolve the story)

8ï¸âƒ£ **INSTRUMENTAL DIRECTIVES** (One per section, English, at section start):
   - [Intro]: (Sparse piano, melancholic ostinato)
   - [Verse 1]: (Piano-driven, intimate vocal, minimal strings)
   ${genre === 'trot' ? '- [Pre-Chorus]: (Strings swell, building sorrow)\n   - [Climb]: (Tension peaks, melody intensely sorrowful with powerful strings)\n   - [Chorus]: (Full emotion, deep vibrato and kkeok-gi technique)' : '- [Pre-Chorus]: (Strings swell gently, building tension)\n   - [Chorus]: (Full instrumentation, piano ostinato leads)'}
   ${timeline.break !== '0:00' ? '- [Instrumental Break]: (Cello answers piano, short and mournful)' : ''}
   ${timeline.v2 !== '0:00' ? '- [Verse 2]: (Piano and strings, vocal more emotional)' : ''}
   ${genre === 'trot' ? '- [Pre-Chorus]: (Strings rising again)\n   - [Climb]: (Peak emotional tension)\n   - [Chorus]: (Kkeok-gi technique emphasized)' : '- [Pre-Chorus]: (Orchestra builds, drums enter subtly)\n   - [Chorus]: (Strings fuller, bass added, driving rhythm)'}
   - [Bridge]: (Music strips down, piano and vocal only)
   - [Instrumental Build]: (Orchestra builds, drums enter, rising tension)
   - **[Key change up]** â† MANDATORY TAG! (no lyrics, no parentheses)
   - [Final Chorus]: (Full voice, wide vibrato, sustained high notes)
   - [Outro]: (Piano fades, strings hold final chord, unresolved)

9ï¸âƒ£ **FORBIDDEN TERMS**:
   âŒ Do NOT use: kkeokgi, Korean twist, piri, gayageum, shamisen, dreamy, ambient, ethereal, flowing

ðŸ”Ÿ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs and section tags)
   - Title: "ì œëª©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   
   âš ï¸âš ï¸âš ï¸ **CLEAN OUTPUT RULES** âš ï¸âš ï¸âš ï¸
   
   **FORBIDDEN in lyrics:**
   âŒ Syllable counts: (3), (4), (5) â†’ NEVER!
   âŒ Delivery notes: [melancholic delivery] â†’ NEVER!
   âŒ Numbers in parentheses
   ⭐ Hyphens "-" for long notes! (Suno V5 Official: "사랑-앙", "떨려-어")

   **CORRECT long note notation:**
   **CORRECT long note notation (Suno V5 Official):**
   ✅ "떨려-어" (hyphen + vowel repetition)
   ✅ "돌아-아" (hyphen + vowel repetition)
   ✅ "사랑해-애-애" (multiple vowels for extra length)

   **INCORRECT notation:**
   ❌ "떨려~" (tilde not officially supported in V5!)
   ❌ "돌아~" (use hyphen instead!)
   
   **ALLOWED in parentheses:**
   âœ… English ad-libs ONLY: (stay with me), (hold me tight)
   âœ… Harmony directives in [Final Chorus]: (warm close harmonies)
   âœ… Korean ad-libs in [Final Chorus]: (ì•„~), (ì˜¤~)

${(sectionVerse || sectionPrechorus || sectionChorus || sectionBridge || sectionFinal || sectionOutro) ? `
ðŸŽ­ðŸŽ­ðŸŽ­ SECTION-BY-SECTION EMOTIONAL DIRECTING ðŸŽ­ðŸŽ­ðŸŽ­
Apply these emotional directions to INFLUENCE your word choice:
${sectionVerse ? `- [Verse]: ${sectionVerse} delivery` : ''}
${sectionPrechorus ? `- [Pre-Chorus]: ${sectionPrechorus} delivery` : ''}
${sectionChorus ? `- [Chorus]: ${sectionChorus} delivery` : ''}
${sectionBridge ? `- [Bridge]: ${sectionBridge} delivery` : ''}
${sectionFinal ? `- [Final Chorus]: ${sectionFinal} delivery` : ''}
${sectionOutro ? `- [Outro]: ${sectionOutro} delivery` : ''}

âš ï¸ DO NOT write delivery notes in output! EMBODY emotions through word choices!
` : ''}

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
✅ VALIDATION CHECKLIST (8대 원칙 + Language-specific):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Language identified? (Korean = 3~6 / English = 8~12 syllables)
□ Korean: All lines 3~6음절? (Pre 3~5, Outro 2~5)
□ English: Verse 8~10 / Chorus 10~12 syllables?
□ ⭐ [Bridge] section included? (MANDATORY!)
□ ⭐ [Key change up] tag included? (MANDATORY!)
□ ⭐ [Final Chorus] section included? (MANDATORY!)
□ Final Chorus ${config.finalChorusMax} lines max? (${config.finalChorusMax + 1}+ = rap!)
□ Chorus 1/2/Final different (except 1 anchor)?
□ Melody variation applied? (음절수/구조/받침/틸드~)
□ Hyphens (-) for long notes? (vowel repetition: "사랑-앙")
□ Ellipsis (...) max 0~2 per section?
□ Counterpoint ${abModeActive ? '2-3' : '1-2'} times per chorus?
□ ⭐ Counterpoint on SAME LINE (NOT new line)?
□ ⭐ Counterpoint length max 3 words? (NO 7+ word phrases!)
□ Counterpoint on irregular spacing? (NOT consecutive!)
□ Final Chorus 3-layer harmony? (warm/echoing/intertwine)
□ Ad-libs 2 lines max?
□ ⚠️ CRITICAL: Tilde (~) and counterpoint ( ) NEVER on same line?
□ Literary imagery (no direct emotion words)?
□ Clean output (no annotations)?
${genre === 'trot' ? '□ [Climb] sections included before Chorus?' : ''}
${genre === 'pop80s' ? '□ Male AND female harmonies mentioned?' : ''}
□ Version consideration? (V4.5+ = emotional / V5 = precise)

🎵 Generate the COMPLETE song NOW! MUST include ALL sections: [Intro] → [Verse 1] → [Pre-Chorus] → [Chorus] → ... → [Bridge] → [Instrumental Build] → [Key change up] → [Final Chorus] → [Outro]!
  `;
}

// =====================================
// Hip-Hop Boom Bap ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateHipHopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Hip-Hop Lab" - elite Old School Hip-Hop songwriting system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate Hip-Hop Boom Bap lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ HIP-HOP BOOM BAP RULES (CRITICAL!):

1ï¸âƒ£ **RHYME SCHEMES** (Most important!):
   - End Rhyme MANDATORY: Use AABB or ABAB pattern
   - Internal Rhyme RECOMMENDED: Mid-line rhymes for complexity
   - Examples:
     * AABB: "ê±°ë¦¬ ìœ„ë¥¼ ê±¸ì–´ / ê¿ˆì„ í–¥í•´ ë” / ë°¤í•˜ëŠ˜ ë³„ì´ ë¹›ë‚˜ / ë‚´ ê¸¸ì„ ë¹„ì¶° ë°ì•„"
     * ABAB: "ë„ì‹œì˜ ë°¤ (A) / ë‚´ ë°œê±¸ìŒì€ ê³„ì†ë¼ (B) / ê¿ˆì„ í–¥í•œ ë°¤ (A) / ë©ˆì¶”ì§€ ì•Šì„ ëž©ì´ë„¤ (B)"

2ï¸âƒ£ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (flexible for flow)
   - Hook: **6~10 syllables** (catchy, sung)
   - Bridge: **5~8 syllables**
   - Final Hook: Up to **10 lines** allowed

3ï¸âƒ£ **FLOW & DELIVERY**:
   - Clear enunciation (ëª…í™•í•œ ë°œìŒ)
   - Confident delivery (ìžì‹ ê°)
   - 4th beat stress (4ë²ˆì§¸ ë¹„íŠ¸ì— ê°•ì„¸)
   - NO mumble rap, NO trap hi-hats

4ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Scratching/Sample (1-2 lines optional)
   - Verse 1 (${timeline.v1}): **4-8 lines** (rap, rhyme-focused)
   - Hook (${timeline.c1}): **2-4 lines** (sung chorus)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-8 lines** (evolved rhyme)` : ''}
   - Hook (${timeline.c2}): **2-4 lines** (same or variation)
   - Bridge (${timeline.bridge}): **2-4 lines** (mood change)
   - Final Hook (${timeline.final}): **2-4 lines** (powerful)
   - Outro (${timeline.outro}): Fade out

5ï¸âƒ£ **HOOK VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Hooks can vary slightly but keep core message
   - Example:
     * Hook 1: "ì´ê²ƒì´ ë‚´ ê¸¸ / ì ˆëŒ€ ë©ˆì¶”ì§€ ì•Šì•„"
     * Hook 2: "ì´ê²ƒì´ ë‚´ ì‚¶ / ê³„ì† ê±¸ì–´ê°ˆ ê±°ì•¼"
   ` : `
   - Hook stays consistent
   `}

6ï¸âƒ£ **HARMONY** (Hip-Hop style):
   - (tight backing vocals) in hooks
   - (call-and-response) in verses
   - Korean ad-libs OK: (yeah!), (uh!), (let's go!)

7ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Scratching, vinyl crackle, boom-bap drums)
   - [Verse 1]: (Jazzy piano loop, deep bass, clear drums)
   - [Hook]: (Full instrumentation, melodic hook)
   - [Bridge]: (Stripped beat, just bass and snare)
   - [Instrumental Build]: (Building intensity, drum fills)
   - **[Key change up]** â† MANDATORY TAG!
   - [Final Hook]: (All elements, maximum energy)

8ï¸âƒ£ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "ì œëª©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Hook], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - âŒ NO hyphens "-" in lyrics!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… HIP-HOP CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ End rhyme scheme (AABB/ABAB)?
â–¡ 7-12 syllables in verses?
â–¡ Clear, confident delivery?
â–¡ Hook is catchy and sung?
â–¡ NO mumble rap, NO trap sounds?
â–¡ Clean output (no annotations)?

ðŸŽµ Generate Hip-Hop Boom Bap lyrics now!
  `;
}

// =====================================
// Melodic Trap ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateTrapPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Trap Lab" - elite Melodic Trap songwriting system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate Melodic Trap lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ MELODIC TRAP RULES (CRITICAL!):

1ï¸âƒ£ **TRIPLET FLOW** (Most important!):
   - Use 3ì—°ìŒ (1ë°•ì— 3ìŒì ˆ)
   - Example: "ë„ˆë¥¼ ìžƒì€ / ê·¸ ìˆœê°„ë¶€í„° / ë‚œ ë§ê°€ì ¸"
   - Melodic phrasing over strict rhyme
   - Auto-Tune friendly delivery

2ï¸âƒ£ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (triplet flow)
   - Chorus: **5~8 syllables** (sung, melodic)
   - Bridge: **4~6 syllables** (vulnerable)
   - Final Chorus: Up to **8 lines**

3ï¸âƒ£ **RAP + SINGING MIX**:
   - Verses: Rap with melody (Auto-Tuned)
   - Chorus: Full singing (emotional)
   - Pre-Chorus: Building emotion
   - NO traditional clear rap (blur the line!)

4ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Atmospheric pad (1-2 lines)
   - Verse 1 (${timeline.v1}): **4-6 lines** (melodic rap)
   - Pre-Chorus (${timeline.pre1}): **2 lines** (emotion rise)
   - Chorus (${timeline.c1}): **4ì¤„** (sung)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6 lines** (melodic rap)` : ''}
   - Chorus (${timeline.c2}): **4ì¤„**
   - Bridge (${timeline.bridge}): **2-4 lines** (vulnerable)
   - Final Chorus (${timeline.final}): **4-6 lines** (emotion peak)
   - Outro (${timeline.outro}): Fade

5ï¸âƒ£ **EMOTION DELIVERY**:
   - Dark minor-key mood
   - Emotionally vulnerable
   - Pain, heartbreak, struggle themes
   - NO aggressive shouting

6ï¸âƒ£ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Keep melodic core, vary words
   - Example:
     * Chorus 1: "ë„Œ ë– ë‚˜ê°”ì–´ / ë‚œ ì—¬ê¸° ë‚¨ì•„"
     * Chorus 2: "ë„Œ ë©€ì–´ì¡Œì–´ / ë‚œ í˜¼ìž ì„œìžˆì–´"
   ` : `
   - Chorus stays consistent
   `}

7ï¸âƒ£ **HARMONY** (Trap style):
   - (Auto-Tuned harmonies) in chorus
   - (atmospheric pads) throughout
   - (emotional ad-libs) in final chorus
   - Korean ad-libs: (ooh), (yeah), (ah~)

8ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Atmospheric synth pad, dark mood)
   - [Verse 1]: (808 bass hits, rolling hi-hats, melodic rap)
   - [Pre-Chorus]: (Tension building, synths rising)
   - [Chorus]: (Full 808, atmospheric pads, emotional singing)
   - [Bridge]: (Stripped down, just pads and vocal)
   - [Instrumental Build]: (808 builds, hi-hats intensify)
   - **[Key change up]** â† MANDATORY TAG!
   - [Final Chorus]: (Maximum emotion, layered vocals)

9ï¸âƒ£ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "ì œëª©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - âŒ NO hyphens "-" in lyrics!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… MELODIC TRAP CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ Triplet flow (3ì—°ìŒ)?
â–¡ Rap + singing mixed?
â–¡ Emotional, vulnerable themes?
â–¡ Auto-Tune friendly phrasing?
â–¡ Dark minor-key mood?
â–¡ Clean output (no annotations)?

ðŸŽµ Generate Melodic Trap lyrics now!
  `;
}

// =====================================
// Funk Pop ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateFunkPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Funk Pop Lab" - elite Bruno Mars-style songwriting system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate Funk Pop lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ FUNK POP RULES (CRITICAL!):

1ï¸âƒ£ **CALL-AND-RESPONSE** (Most important!):
   - Lead: "ì†ì„ ë“¤ì–´" / Response: "(ë†’ì´!)"
   - Lead: "ë‹¤ ê°™ì´ ì¶¤ì¶°" / Response: "(Let's go!)"
   - Create party vibe, audience participation
   - Tight harmonies throughout

2ï¸âƒ£ **SYLLABLE RULES** (5-10 syllables):
   - Verse: **5~10 syllables** (free, groovy)
   - Chorus: **6~10 syllables** (repetitive)
   - Bridge: **4~8 syllables**
   - Final Chorus: Up to **10 lines** (ad-libs!)

3ï¸âƒ£ **SYNCOPATION & GROOVE**:
   - Offbeat phrasing (ì—‡ë°•)
   - Rhythmic, percussive words
   - Feeling over strict rhyme
   - Danceable energy

4ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Brass hit + groove (1-2 lines)
   - Verse 1 (${timeline.v1}): **4ì¤„** (spoken/sung)
   - Pre-Chorus (${timeline.pre1}): **2ì¤„** (build energy)
   - Chorus (${timeline.c1}): **4-6ì¤„** (full energy)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4ì¤„**` : ''}
   - Chorus (${timeline.c2}): **4-6ì¤„**
   - Bridge (${timeline.bridge}): **2-4ì¤„** (break it down)
   - Final Chorus (${timeline.final}): **6-8ì¤„** (ad-libs)
   - Outro (${timeline.outro}): Instrumental fade

5ï¸âƒ£ **PARTY ENERGY**:
   - Confident, upbeat themes
   - Celebration, dancing, fun
   - Bruno Mars / Uptown Funk vibe
   - NO sad ballad emotions

6ï¸âƒ£ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Keep hook, vary supporting lines
   - Example:
     * Chorus 1: "ì¶¤ì¶° ì¶¤ì¶° / ë°¤ìƒˆë„ë¡ (yeah!)"
     * Chorus 2: "ë›°ì–´ ë›°ì–´ / ì•„ì¹¨ê¹Œì§€ (come on!)"
   ` : `
   - Chorus stays consistent
   `}

7ï¸âƒ£ **HARMONY** (Funk Pop style):
   - (tight harmonies) in all choruses
   - (brass hits) punctuating phrases
   - (call-and-response vocals) throughout
   - English ad-libs OK: (yeah!), (come on!), (let's go!)

8ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Brass hit, groovy bassline, syncopated guitar)
   - [Verse 1]: (Minimal groove, funky bass, clear vocals)
   - [Pre-Chorus]: (Building energy, brass rising)
   - [Chorus]: (Full brass section, groovy bass, tight rhythm)
   - [Bridge]: (Breakdown, just bass and vocals)
   - [Instrumental Build]: (Funky bass build, brass crescendo)
   - **[Key change up]** â† MANDATORY TAG!
   - [Final Chorus]: (Maximum funk, all instruments, ad-libs)

9ï¸âƒ£ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "ì œëª©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - âŒ NO hyphens "-" in lyrics!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… FUNK POP CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ Call-and-response structure?
â–¡ Syncopation & groove?
â–¡ Party, celebration energy?
â–¡ Tight harmonies?
â–¡ NO slow ballad vibes?
â–¡ Clean output (no annotations)?

ðŸŽµ Generate Funk Pop lyrics now!
  `;
}

// =====================================
// Reggaeton ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateReggaetonPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Reggaeton Lab" - elite Latin dance songwriting system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate Reggaeton lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ REGGAETON RULES (CRITICAL!):

1ï¸âƒ£ **DEMBOW RHYTHM** (3+3+2 pattern):
   - Example: "ë°¤ì´ / ê¹Šì–´ê°€ / ì¶¤ì¶°" (3+3+2)
   - Hook repetition minimum 3 times per chorus
   - Latin percussion rhythm
   - Perreo beat feel

2ï¸âƒ£ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (rap style)
   - Hook: **4~8 syllables** (ê°•ë ¥í•œ ë°˜ë³µ)
   - Bridge: **5~8 syllables**
   - Final Hook: Up to **8 lines**

3ï¸âƒ£ **RAP + SINGING MIX**:
   - Verses: Rap delivery (Spanish-influenced)
   - Hook: Catchy, repetitive singing
   - Minimum 3 hook repetitions per chorus
   - Danceable, party vibe

4ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Dembow drum + hook preview (1-2 lines)
   - Verse 1 (${timeline.v1}): **4-6ì¤„** (rap)
   - Hook (${timeline.c1}): **2-4ì¤„** (repeat 3x minimum)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6ì¤„** (rap)` : ''}
   - Hook (${timeline.c2}): **2-4ì¤„** (repeat 3x)
   - Bridge (${timeline.bridge}): **2ì¤„** (breakdown)
   - Final Hook (${timeline.final}): **3-4ì¤„** (ê°•í™”ëœ ë°˜ë³µ)
   - Outro (${timeline.outro}): Hook fade

5ï¸âƒ£ **LATIN VIBE**:
   - Tropical, beach atmosphere
   - Spanish-influenced melody
   - Party, dance themes
   - 90-100 BPM feel

6ï¸âƒ£ **HOOK VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Hook core stays same, add variations
   - Example:
     * Hook 1: "ë°”ì¼ë¼ ë°”ì¼ë¼ / ì¶¤ì¶° ë°¤ìƒˆ / ë°”ì¼ë¼ ë°”ì¼ë¼"
     * Hook 2: "ë°”ì¼ë¼ ë°”ì¼ë¼ / ë›°ì–´ ì•„ì¹¨ê¹Œì§€ / ë°”ì¼ë¼ ë°”ì¼ë¼"
   ` : `
   - Hook stays consistent (ê°•ë ¥í•œ ë°˜ë³µ!)
   `}

7ï¸âƒ£ **HARMONY** (Reggaeton style):
   - (Latin percussion) throughout
   - (catchy vocal hooks) in chorus
   - (dembow rhythm) driving beat
   - Spanish/English ad-libs: (baila!), (vamos!), (dale!)

8ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Dembow drum pattern, Latin percussion)
   - [Verse 1]: (Minimal beat, reggaeton drums, rap vocal)
   - [Hook]: (Full dembow, bass drop, catchy melody)
   - [Bridge]: (Breakdown, just dembow and vocal)
   - [Instrumental Build]: (Dembow intensifies, percussion builds)
   - **[Key change up]** â† MANDATORY TAG!
   - [Final Hook]: (Maximum energy, all percussion, powerful hooks)

9ï¸âƒ£ **OUTPUT FORMAT**:
   - Language: Korean (except Spanish/English ad-libs)
   - Title: "ì œëª©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Hook], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - âŒ NO hyphens "-" in lyrics!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… REGGAETON CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ Dembow rhythm (3+3+2)?
â–¡ Hook repeated 3+ times?
â–¡ Rap + singing mixed?
â–¡ Latin, tropical vibe?
â–¡ Danceable energy?
â–¡ Clean output (no annotations)?

ðŸŽµ Generate Reggaeton lyrics now!
  `;
}

// =====================================
// Future Bass ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateFutureBassPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Future Bass Lab" - elite EDM songwriting system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate Future Bass lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ FUTURE BASS RULES (CRITICAL!):

1ï¸âƒ£ **MINIMAL VOCALS** (Most important!):
   - Keep lyrics SHORT and SIMPLE
   - Vocal chops in mind
   - Drop section = minimal or NO vocals
   - Focus on emotion over words

2ï¸âƒ£ **SYLLABLE RULES** (4-8 syllables - VERY SHORT):
   - Verse: **4~8 syllables** (ì§§ê²Œ!)
   - Chorus: **3~6 syllables** (ê·¹ë„ë¡œ ì§§ê²Œ!)
   - Drop: **1-2 lines** (ë³´ì»¬ ìµœì†Œ)
   - Final Drop: Up to **6 lines** max

3ï¸âƒ£ **EMOTIONAL & UPLIFTING**:
   - Introspective, emotional themes
   - Uplifting major key (or emotional minor)
   - Love, self-discovery, freedom
   - Festival-ready energy

4ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Synth pad (1-2 lines)
   - Verse 1 (${timeline.v1}): **2-4ì¤„** (minimal vocal)
   - Build (${timeline.pre1}): Rising tension (1ì¤„ or instrumental)
   - Drop (${timeline.c1}): **1-2ì¤„** (vocal chop, mostly instrumental)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **2-4ì¤„**` : ''}
   - Build: Rising (1ì¤„)
   - Drop 2 (${timeline.c2}): **1-2ì¤„**
   - Bridge (${timeline.bridge}): **2ì¤„** (breakdown)
   - Final Drop (${timeline.final}): **2-3ì¤„** (maximum energy)
   - Outro (${timeline.outro}): Fade

5ï¸âƒ£ **VOCAL CHOPS**:
   - Write simple, choppable phrases
   - Example: "ë‚ ì•„ì˜¬ë¼" â†’ can be chopped "ë‚ -ì•„-ì˜¬-ë¼"
   - Short syllables work best
   - Repetitive phrases OK

6ï¸âƒ£ **DROP VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Drops can vary slightly
   - Example:
     * Drop 1: "ë‚ ì•„ì˜¬ë¼"
     * Drop 2: "ë†’ì´ ë– ì˜¬ë¼"
   ` : `
   - Drops stay consistent
   `}

7ï¸âƒ£ **HARMONY** (Future Bass style):
   - (lush synth chords) throughout
   - (chopped vocal samples) in drops
   - (bright supersaws) in drops
   - (atmospheric pads) in verses

8ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Synth pad, faded melody, emotional atmosphere)
   - [Verse 1]: (Minimal synths, intimate vocals, light percussion)
   - [Build]: (Rising synths, white noise, snare rolls, tension)
   - [Drop]: (Bright supersaws, chopped vocals, energetic bass, 128 BPM energy)
   - [Bridge]: (Breakdown, just pads and vocal, emotional moment)
   - [Instrumental Build]: (Synths rising, white noise build)
   - **[Key change up]** â† MANDATORY TAG!
   - [Final Drop]: (Maximum energy, all synths, festival vibes)

9ï¸âƒ£ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "ì œëª©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Drop], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - âŒ NO hyphens "-" in lyrics!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… FUTURE BASS CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ Very short phrases (4-8 syllables)?
â–¡ Drop sections minimal vocals?
â–¡ Emotional, uplifting themes?
â–¡ Vocal chop friendly?
â–¡ Festival energy in drops?
â–¡ Clean output (no annotations)?

ðŸŽµ Generate Future Bass lyrics now!
  `;
}

// =====================================
// Indie Pop (Bedroom Pop) ì „ìš© í”„ë¡¬í”„íŠ¸
// =====================================
function generateIndiePopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Indie Pop Lab" - elite Bedroom Pop songwriting system.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸŽ¯ MISSION: Generate Indie Pop lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ INDIE POP (BEDROOM POP) RULES (CRITICAL!):

1ï¸âƒ£ **HONESTY & VULNERABILITY** (Most important!):
   - Be authentic, raw, real
   - Personal experiences
   - Relatable emotions
   - NO overproduction, NO perfection

2ï¸âƒ£ **SYLLABLE RULES** (3-10 syllables - FLEXIBLE):
   - Verse: **3~10 syllables** (ìžìœ ë¡œì›€!)
   - Chorus: **4~8 syllables** (ë‹¨ìˆœ)
   - Bridge: **3~6 syllables**
   - Unconventional structure OK
   - Spoken-word natural flow

3ï¸âƒ£ **SIMPLE & INTIMATE**:
   - Lo-fi production aesthetic
   - Simple, straightforward language
   - NO complex metaphors
   - Direct, honest emotions
   - Melancholic yet catchy

4ï¸âƒ£ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Lo-fi guitar/synth (2ì¤„)
   - Verse 1 (${timeline.v1}): **4-6ì¤„** (intimate)
   - Chorus (${timeline.c1}): **2-4ì¤„** (simple hook)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6ì¤„**` : ''}
   - Chorus (${timeline.c2}): **2-4ì¤„**
   - Bridge (${timeline.bridge}): **2-4ì¤„** (vulnerable moment)
   - Outro (${timeline.outro}): Fade or abrupt (1-2ì¤„)

5ï¸âƒ£ **NATURAL DELIVERY**:
   - Conversational tone
   - Speak-singing OK
   - Imperfect phrasing OK
   - Examples: "ì°½ë°–ì—” ë¹„ê°€ ë‚´ë¦¬ê³  / ë‚œ ë„¤ ìƒê°ë§Œ"
   - Like talking to a friend

6ï¸âƒ£ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Simple variations OK
   - Example:
     * Chorus 1: "ëŒì•„ì™€ ì¤˜ / ì œë°œ"
     * Chorus 2: "ë– ë‚˜ì§€ ë§ˆ / ë¶€íƒì´ì•¼"
   ` : `
   - Chorus stays simple and consistent
   `}

7ï¸âƒ£ **HARMONY** (Indie Pop style):
   - (lo-fi drums) throughout
   - (jangly guitars) in background
   - (dreamy synths) for atmosphere
   - (intimate vocals) front and center
   - Minimal production, maximum emotion

8ï¸âƒ£ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Lo-fi guitar/synth, bedroom production)
   - [Verse 1]: (Minimal drums, intimate vocal, simple guitar)
   - [Chorus]: (Full but still lo-fi, catchy hook)
   - [Bridge]: (Stripped down, vulnerable moment, just vocal and one instrument)
   - [Instrumental Build]: (Gentle build, bedroom production)
   - **[Key change up]** â† Optional for indie pop
   - [Final Chorus]: (Emotional peak, still lo-fi)
   - [Outro]: (Fade out or abrupt end, natural finish)

9ï¸âƒ£ **THEMES**:
   - Love, heartbreak, loneliness
   - Self-discovery, uncertainty
   - Modern life, relationships
   - Mental health (handled sensitively)
   - Nostalgia, growing up

ðŸ”Ÿ **OUTPUT FORMAT**:
   - Language: Korean (except minimal English ad-libs)
   - Title: "ì œëª©: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - âŒ NO hyphens "-" in lyrics!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
âœ… INDIE POP CHECKLIST:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â–¡ Honest, vulnerable lyrics?
â–¡ Simple, direct language?
â–¡ Natural, conversational flow?
â–¡ Lo-fi aesthetic?
â–¡ Relatable themes?
â–¡ Clean output (no annotations)?

ðŸŽµ Generate Indie Pop lyrics now!
  `;
}
