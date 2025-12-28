// =====================================================
// Suno AI Lyrics Generation API v11.6
// 백엔드 전용 - Vercel KV 레이트리밋 + 보안 강화!
// =====================================================

// =====================================
// Vercel KV 레이트리밋 (원자적 트랜잭션)
// =====================================
async function checkRateLimit(ip) {
  // ⭐ Vercel KV / Upstash REST 환경변수
  const KV_REST_API_URL =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_URL;

  const KV_REST_API_TOKEN =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  // KV가 설정 안 되어 있으면 기본 레이트리밋 (메모리)
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    console.warn('[Rate Limit] Vercel KV not configured, using memory fallback');
    return checkRateLimitFallback(ip);
  }

  const key = `ratelimit:${ip}`;

  try {
    // ✅ atomic 트랜잭션: 최초 1회만 EX 설정 + INCR
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

    // Vercel KV는 보통 [ {result}, {result} ] 형태
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
// Fallback 레이트리밋 (KV 실패 시)
// =====================================
const rateLimitMapFallback = new Map();
const MAX_FALLBACK_ENTRIES = 1000;

function checkRateLimitFallback(ip) {
  const now = Date.now();
  const userRequests = rateLimitMapFallback.get(ip) || [];
  
  // 1시간 내 요청만 필터
  const recentRequests = userRequests.filter(t => now - t < 3600000);
  
  if (recentRequests.length >= 20) {
    throw new Error('Too many requests (max 20/hour). Please try again later.');
  }
  
  recentRequests.push(now);
  rateLimitMapFallback.set(ip, recentRequests);
  
  // Map이 너무 커지면 오래된 IP 정리
  if (rateLimitMapFallback.size > MAX_FALLBACK_ENTRIES) {
    const sortedEntries = Array.from(rateLimitMapFallback.entries())
      .sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
    
    const deleteCount = rateLimitMapFallback.size - MAX_FALLBACK_ENTRIES;
    for (let i = 0; i < deleteCount; i++) {
      rateLimitMapFallback.delete(sortedEntries[i][0]);
    }
  }
  
  // ⭐ 정상 통과 시 명시적 return (버그 수정!)
  return;
}




// =====================================
// 가사 출력 후처리: 하이픈(-) 완전 금지 (오빠 규칙 고정)
// - 모델이 실수로 '낡은- 장부' 같은 표기를 해도 서버에서 제거
// - "~" (롱톤) 은 유지
// =====================================
function enforceNoHyphens(text) {
  if (!text || typeof text !== 'string') return text;

  let out = text;

  // 1) ASCII hyphen-minus 제거
  out = out.replace(/-/g, '');

  // 2) 공백 정리
  out = out.replace(/[\t ]{2,}/g, ' ');
  out = out.replace(/ \n/g, '\n').replace(/\n /g, '\n');

  return out;
}

// =====================================
// 입력 검증 함수 (v11.1 추가)
// =====================================
function validateInput(body) {
  const errors = [];
  
  // keyword 검증
  if (!body.keyword || typeof body.keyword !== 'string') {
    errors.push('키워드는 필수입니다');
  } else {
    const trimmedKeyword = body.keyword.trim();
    if (trimmedKeyword.length === 0) {
      errors.push('키워드는 빈 칸일 수 없습니다');
    }
    if (trimmedKeyword.length > 2000) { // ⭐ 100자 → 2000자 (상식적으로!)
      errors.push('키워드는 2000자 이하로 입력해주세요');
    }
    // 정상이면 trim된 값으로 교체
    body.keyword = trimmedKeyword;
  }
  
  // userApiKey 검증
  if (!body.userApiKey || typeof body.userApiKey !== 'string') {
    errors.push('API 키는 필수입니다');
  } else if (body.userApiKey.trim().length === 0) {
    errors.push('API 키는 빈 칸일 수 없습니다');
  }
  
  // ✅ modelName 검증 (v11.3 추가 - 허용 모델만)
  const allowedModels = [
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-2.0-flash-exp'
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
  
  // genre 검증 (유효하지 않으면 기본값)
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
  
  // structure 검증 (없거나 유효하지 않으면 기본값 강제!)
  const validStructures = ['standard', 'short', 'extended'];
  if (!body.structure || !validStructures.includes(body.structure)) {
    if (body.structure) {
      console.warn(`Invalid structure: ${body.structure}, using default (standard)`);
    }
    body.structure = 'standard'; // ⭐ 없으면 무조건 기본값!
  }
  
  // modifier 필드들 길이 제한 (프롬프트 폭발 방지)
  const modifierFields = [
    'vocalModifier', 'genreFusionModifier', 'vocalConfigModifier',
    'emotionIntensityModifier', 'moodModifier',
    'sectionVerse', 'sectionPrechorus', 'sectionChorus', 'sectionBridge', 'sectionFinal', 'sectionOutro'
  ];
  
  modifierFields.forEach(field => {
    if (body[field] && typeof body[field] === 'string' && body[field].length > 1000) { // ⭐ 200자 → 1000자
      errors.push(`${field}는 1000자 이하로 입력해주세요`);
    }
  });
  
  // 에러가 있으면 throw
  if (errors.length > 0) {
    const error = new Error(errors.join(', '));
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  
  return body;
}

// =====================================
// 에러 응답 헬퍼 함수 (v11.1 추가)
// =====================================
function errorResponse(res, status, message, code = 'UNKNOWN_ERROR', retryable = false) {
  return res.status(status).json({
    error: message,
    error_code: code,
    retryable: retryable,
    timestamp: new Date().toISOString()
  });
}

// 장르별 가사 공식 설정
const GENRE_CONFIGS = {
  // 💎 감성 장인 팩 (발라드 계열)
  pop80s: {
    name: '80s 팝 발라드',
    syllableRule: '3-6음절 (자연스러운 호흡)',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: '풍부한 화음과 감정적 빌드업'
  },
  trot: {
    name: '정통 트로트',
    syllableRule: '3-6음절 (꺾기 유도)',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: '한(恨)의 미학, 억제된 슬픔, 꺾기 기법(kkeok-gi) 필수'
  },
  ballad: {
    name: '한국형 감성 발라드',
    syllableRule: '3-6음절',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: '넓은 비브라토, 멜로디 중심'
  },
  acoustic_folk: {
    name: '어쿠스틱 포크',
    syllableRule: '3-6음절 (자연스러운 말투)',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: '이야기 전달 중심, 대화하듯 자연스럽게'
  },
  rock_ballad: {
    name: '록 발라드',
    syllableRule: '3-6음절 (고음 롱톤 유도)',
    finalChorusMax: 9,
    chorusLines: '5-6줄',
    special: '절제된 힘, 고음 폭발은 Final Chorus에만 1회!'
  },
  rnb: {
    name: '한국형 R&B 발라드',
    syllableRule: '3-6음절',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: 'Call-and-response, 스택 보컬, 강력한 클라이맥스'
  },
  
  // 🎵 MZ 쇼츠 팩
  kpop_dance: {
    name: 'K-Pop 아이돌 댄스',
    syllableRule: '자유 (후크는 2-3음절 반복)',
    finalChorusMax: 12,
    chorusLines: '6-8줄',
    special: '중독성 후크 반복이 생명! "나나나", "예예예" 같은 캐치프레이즈 필수! 음절 제한 없이 리듬감 우선!'
  },
  city_pop: {
    name: '시티 팝',
    syllableRule: '4-6음절 (여유로운 그루브)',
    finalChorusMax: 10,
    chorusLines: '6-7줄',
    special: '직설적 슬픔보다 도시적 낭만과 향수 표현'
  },
  lofi_hiphop: {
    name: '로파이 힙합',
    syllableRule: '최소 (인스트루멘탈 중심)',
    finalChorusMax: 4,
    chorusLines: '2-3줄',
    special: '가사 거의 없음! 짧은 후렴 또는 허밍만! "hmm...", "yeah..." 같은 최소 보컬! 분위기 중심!'
  },
  
  // 🌟 스페셜 에디션
  europop: {
    name: 'ABBA 스타일 유로팝',
    syllableRule: '3-5음절 (다층 화음 유도)',
    finalChorusMax: 9,
    chorusLines: '6-7줄',
    special: '사운드의 벽! 드라마틱한 전개와 풍부한 화음'
  },
  metal: {
    name: '심포닉/고딕 메탈',
    syllableRule: '3-5음절',
    finalChorusMax: 9,
    chorusLines: '6-7줄',
    special: '오페라틱 보컬, 거대한 심포닉 합창단'
  },
  
  // 🌍 글로벌 히트 팩
  hip_hop_boom_bap: {
    name: 'Hip-Hop Boom Bap',
    syllableRule: '7-12음절 (유동적)',
    finalChorusMax: 10,
    chorusLines: '4-6줄 (Hook)',
    special: 'End Rhyme 필수 (AABB/ABAB), Internal Rhyme 권장, 명확한 발음, 90s 골든 에이지 바이브'
  },
  trap_melodic: {
    name: 'Melodic Trap',
    syllableRule: '7-12음절 (Triplet flow)',
    finalChorusMax: 8,
    chorusLines: '4-6줄',
    special: 'Auto-Tune 멜로딕 랩, 3연음 활용, 감성적 전달, 노래+랩 혼합'
  },
  funk_pop: {
    name: 'Funk Pop',
    syllableRule: '5-10음절 (자유로움)',
    finalChorusMax: 10,
    chorusLines: '6-8줄',
    special: 'Syncopation 중요, Call-and-Response 구조, 그루비한 베이스라인, 브라스 섹션'
  },
  reggaeton: {
    name: 'Reggaeton',
    syllableRule: '7-12음절 (래핑 스타일)',
    finalChorusMax: 8,
    chorusLines: '4-6줄 (Hook)',
    special: 'Dembow rhythm (3+3+2), Hook 최소 3회 반복 필수, 래핑+노래 혼합, 라틴 바이브'
  },
  future_bass: {
    name: 'Future Bass',
    syllableRule: '4-8음절 (짧게)',
    finalChorusMax: 6,
    chorusLines: '3-5줄',
    special: 'Vocal chops 고려, 극도로 짧은 구절, Drop은 보컬 최소, 감성적 에너지'
  },
  indie_pop: {
    name: 'Indie Pop (Bedroom Pop)',
    syllableRule: '3-10음절 (자유로움)',
    finalChorusMax: 8,
    chorusLines: '4-6줄',
    special: '진솔함과 취약함, Lo-fi 감성, 비전통적 구조 가능, Spoken-word처럼 자연스럽게'
  }
};

// =====================================
// 토큰 자동 조절 함수 (v11.3 추가)
// =====================================
function getMaxOutputTokens(genre, structure) {
  // lo-fi는 가사가 거의 없으니 크게 줄여도 됨
  if (genre === 'lofi_hiphop') return 900;
  
  // future_bass도 짧게
  if (genre === 'future_bass') return 1500;
  
  // 구조별로 대략 컷 (비용 절감)
  if (structure === 'short') return 2200;
  if (structure === 'extended') return 3800;
  
  // standard (기본)
  return 3000;
}

module.exports = async (req, res) => {
  // CORS 헤더 설정 (v11.4 보안 강화)
  // ⭐ 보안 개선: 특정 도메인만 허용
  const allowedOrigins = [
    'https://suno-helper-backend.vercel.app',
    'http://localhost:3000', // 로컬 테스트용 (선택)
    'http://localhost:5000'  // 로컬 테스트용 (선택)
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // 허용되지 않은 도메인은 기본값
    res.setHeader('Access-Control-Allow-Origin', 'https://suno-helper-backend.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // ⭐ 보안 헤더 추가 (v11.5)
  res.setHeader('X-Content-Type-Options', 'nosniff'); // MIME 타입 스니핑 방지
  res.setHeader('X-Frame-Options', 'DENY'); // 클릭재킹 방지
  res.setHeader('X-XSS-Protection', '1; mode=block'); // XSS 공격 방지
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // HTTPS 강제

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ⭐ 요청 크기 제한 (v11.5 - DDoS/폭탄 요청 방지)
    const MAX_PAYLOAD_SIZE = 102400; // 100KB (10KB → 100KB로 변경!)
    const payloadSize = JSON.stringify(req.body).length;
    
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      return errorResponse(
        res,
        413,
        '요청 크기가 너무 큽니다. 입력값을 줄여주세요.',
        'PAYLOAD_TOO_LARGE',
        false
      );
    }

    // Rate Limiting 체크 (v11.6 - Vercel KV)
    const xff = req.headers['x-forwarded-for'];
    const clientIP = xff 
      ? (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim()
      : (req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown');
    await checkRateLimit(clientIP); // ⭐ Vercel KV는 async!

    // ✅ 입력 검증 (v11.1 추가)
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

    // 장르 설정 가져오기
    const genreConfig = GENRE_CONFIGS[genre] || GENRE_CONFIGS['pop80s'];

    // ★★★ 구조별 타임라인 ★★★
    const STRUCTURE_TIMELINES = {
      'standard': { info: '3:40 (표준)', intro: '0:08', v1: '0:28', pre1: '0:16', c1: '0:32', break: '0:15', v2: '0:28', pre2: '0:16', c2: '0:32', bridge: '0:24', build: '0:12', final: '0:37', outro: '0:12' },
      'short': { info: '2:30 (쇼츠)', intro: '0:05', v1: '0:22', pre1: '0:12', c1: '0:28', break: '0:00', v2: '0:00', pre2: '0:12', c2: '0:28', bridge: '0:18', build: '0:08', final: '0:30', outro: '0:07' },
      'extended': { info: '4:30 (풀버전)', intro: '0:12', v1: '0:32', pre1: '0:18', c1: '0:36', break: '0:20', v2: '0:32', pre2: '0:18', c2: '0:36', bridge: '0:28', build: '0:15', final: '0:42', outro: '0:15' }
    };

    // ★★★ 장르별 완전 맞춤 프롬프트 생성 ★★★
    let lyricsPrompt = '';

    // === MZ 쇼츠 팩 ===
    if (genre === 'kpop_dance') {
      lyricsPrompt = generateKPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'lofi_hiphop') {
      lyricsPrompt = generateLofiPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier);
    } else if (genre === 'city_pop') {
      lyricsPrompt = generateCityPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } 
    // === 글로벌 히트 팩 ===
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
    // === 발라드 계열 (기본 공식) ===
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

    // Gemini API 호출 (v11.3 개선: 헤더 방식 + 토큰 자동 조절)
    const model = modelName || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const payload = {
      contents: [{ parts: [{ text: lyricsPrompt }] }],
      generationConfig: {
        temperature: 0.85,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: getMaxOutputTokens(genre, structure) // ⭐ 장르/구조별 자동 조절
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': userApiKey // ⭐ URL이 아닌 헤더로 전송 (보안 향상)
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Gemini API Error: ${response.status} - ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const rawLyrics = data?.candidates?.[0]?.content?.parts?.[0]?.text || '생성 실패';
    const lyrics = enforceNoHyphens(rawLyrics);

    return res.status(200).json({ lyrics });

  } catch (error) {
    console.error('Error:', error);
    
    // ✅ 에러 타입별 응답 (v11.1 개선)
    
    // 1. 입력 검증 에러
    if (error.code === 'VALIDATION_ERROR') {
      return errorResponse(res, 400, error.message, 'VALIDATION_ERROR', false);
    }
    
    // 2. Rate Limit 에러
    if (error.message.includes('Too many requests')) {
      return errorResponse(res, 429, error.message, 'RATE_LIMIT_EXCEEDED', true);
    }
    
    // 3. Gemini API 에러
    if (error.message.includes('Gemini API Error')) {
      const isRetryable = error.message.includes('429') || error.message.includes('503');
      return errorResponse(
        res, 
        500, 
        'Gemini API 호출에 실패했습니다. API 키를 확인하거나 잠시 후 다시 시도해주세요.', 
        'GEMINI_API_ERROR', 
        isRetryable
      );
    }
    
    // 4. 기타 서버 에러
    return errorResponse(
      res, 
      500, 
      '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 
      'SERVER_ERROR', 
      true
    );
  }
};

// =====================================
// K-Pop 댄스 전용 프롬프트
// =====================================
function generateKPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI K-Pop Dance Lab" - elite K-Pop songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate K-Pop Dance lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

📋 K-POP DANCE RULES (CRITICAL!):

1️⃣ **HOOK REPETITION** (Most important!):
   - Create ADDICTIVE 2-3 syllable hook (예: "나나나", "예예예", "오오오")
   - Repeat hook 4-6 times in EVERY chorus
   - Hook should be catchy and easy to sing along
   - Examples: "두근두근", "반짝반짝", "빙글빙글"

2️⃣ **SYLLABLE FREEDOM** (No 3-5 limit!):
   - Verse/Pre-Chorus: Any syllable count OK for rhythm
   - Chorus: Focus on rhythmic repetition, not syllable limits
   - Final Chorus: Up to **12 lines** allowed (not 8!)
   - More lines = more energy!

3️⃣ **RHYTHM OVER MELODY**:
   - K-Pop is rhythm-first, NOT melody-first
   - Use percussive words: "탁탁탁", "쿵쿵쿵"
   - Short bursts of energy better than long melodic lines

4️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
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

5️⃣ **CHORUS VARIATION** (MUST!):
   ${autoChorusVariation || abModeActive ? `
   - Chorus 1, 2, Final MUST have different verses
   - Keep ONLY the hook the same
   - Change the rap-like verses around the hook
   - Example:
     * Chorus 1: "verse1 / 나나나 나나나 / verse2 / 나나나 나나나"
     * Chorus 2: "DIFFERENT1 / 나나나 나나나 / DIFFERENT2 / 나나나 나나나"
   ` : `
   - Hook stays the same
   - Verses can vary slightly
   `}

6️⃣ **HARMONY** (K-Pop style):
   - (tight idol harmonies) in all choruses
   - (power vocals) in Final Chorus
   - NO counterpoint ad-libs (they break K-Pop rhythm!)
   - Korean ad-libs OK: (yeah!), (let's go!), (come on!)

7️⃣ **NO BALLAD VIBES**:
   - NO tildes (~) for long notes
   - NO slow vibrato
   - Fast, energetic, percussive!

8️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Heavy synth-bass drop, EDM build-up)
   - [Verse 1]: (Minimal beat, synth stabs, clear vocals)
   - [Pre-Chorus]: (Energy rising, drums building, tension)
   - [Chorus]: (Full EDM drop, heavy bass, synth lead, powerful beat)
   - [Dance Break]: (Instrumental, heavy bass, no vocals)
   - [Bridge]: (Stripped down, just synth pad and vocal)
   - [Dance Break Build]: (Building intensity, risers, tension)
   - **[Key change up]** ← MANDATORY TAG!
   - [Final Chorus]: (Maximum energy, all instruments, vocal power)

9️⃣ **OUTPUT FORMAT**:
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts (3), (4), (5) in output!
   - NO delivery notes [energetic delivery] in output!
   - ❌ NO hyphens "-" in lyrics! K-Pop uses rhythm, not long notes.

═══════════════════════════════════════════════════════════════
✅ K-POP CHECKLIST:
═══════════════════════════════════════════════════════════════
□ 2-3 syllable hook created?
□ Hook repeated 4-6 times per chorus?
□ Final Chorus 8-12 lines?
□ Rhythm-focused, not melody-focused?
□ NO tildes (~)?
□ Chorus variation (if enabled)?
□ Clean output (no annotations)?

🎵 Generate K-Pop Dance lyrics now!
  `;
}

// =====================================
// 로파이 힙합 전용 프롬프트
// =====================================
function generateLofiPrompt(keyword, config, timeline, vocalModifier) {
  return `
You are "Suno AI Lo-fi Lab" - minimalist Lo-fi hip-hop system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate Lo-fi Hip-hop lyrics for "${keyword}"
Structure: ${timeline.info}
═══════════════════════════════════════════════════════════════

📋 LO-FI RULES (MINIMAL VOCALS!):

1️⃣ **MINIMAL LYRICS** (Most important!):
   - This is INSTRUMENTAL-FOCUSED music!
   - Very few lyrics - mostly humming/vocalizations
   - Examples: "hmm...", "yeah...", "uh...", "ah..."
   - Keep it chill and atmospheric

2️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): (no lyrics - just instrumental)
   - Verse 1 (${timeline.v1}): **1-2 lines MAX** (soft spoken)
   - Chorus (${timeline.c1}): **2-3 lines** (humming or minimal words)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **1-2 lines MAX**` : ''}
   - Chorus 2 (${timeline.c2}): **2-3 lines** (same or slight variation)
   - Bridge (${timeline.bridge}): **1-2 lines** (whispered)
   - Final Chorus (${timeline.final}): **3-4 lines MAX** (fade out)
   - Outro (${timeline.outro}): (no lyrics - instrumental fade)

3️⃣ **VOCAL STYLE**:
   - Spoken/whispered, NOT sung
   - Soft, breathy, intimate
   - Example: "빗소리... 창문에... 멍하니..."
   - NO powerful vocals, NO belting

4️⃣ **HARMONY**:
   - NO harmonies needed
   - Just soft, single voice
   - Or just humming: "hmm... hmm..."

5️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Jazzy piano loop, vinyl crackle, dusty atmosphere)
   - [Verse 1]: (Soft boom bap drums enter, mellow piano)
   - [Chorus]: (Bass adds gentle groove, atmospheric pads)
   - [Bridge]: (Piano solo, minimal drums)
   - [Instrumental Build]: (Gentle build, subtle layers)
   - **[Key change up]** ← Optional for lo-fi
   - [Final Chorus]: (All elements, but still chill and mellow)
   - [Outro]: (Piano fades, vinyl crackle remains)

6️⃣ **OUTPUT FORMAT**:
   - Very short output!
   - Most sections have NO lyrics (instrumental)
   - Only a few soft spoken/hummed lines total
   - ❌ NO hyphens "-" in lyrics!

═══════════════════════════════════════════════════════════════
✅ LO-FI CHECKLIST:
═══════════════════════════════════════════════════════════════
□ Minimal lyrics (under 20 lines total)?
□ Soft spoken/whispered style?
□ Lots of instrumental sections?
□ Chill vibe maintained?

🎵 Generate Lo-fi Hip-hop lyrics now!
  `;
}

// =====================================
// 시티팝 전용 프롬프트
// =====================================
function generateCityPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI City Pop Lab" - retro 80s City Pop system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate City Pop lyrics for "${keyword}"
Structure: ${timeline.info}
═══════════════════════════════════════════════════════════════

📋 CITY POP RULES:

1️⃣ **SYLLABLE RULE** (4-6 syllables, relaxed groove):
   - Verse/Pre-Chorus: 4-6 syllables (more relaxed than ballad)
   - Chorus: 4-6 syllables (smooth, not choppy)
   - Final Chorus: **10 lines MAX**

2️⃣ **VIBE** (Urban nostalgia, NOT sadness):
   - Focus on city lights, late nights, coffee, jazz bars
   - Romantic but NOT tragic
   - Breezy, sophisticated, feel-good
   - Examples: "네온 불빛", "재즈 카페", "도시의 밤", "텅 빈 거리"

3️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
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

4️⃣ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Chorus 1, 2, Final MUST vary
   - Keep 1 anchor line the same
   - Change the rest with different urban imagery
   ` : `
   - Some variation recommended for sophistication
   `}

5️⃣ **HARMONY** (Jazzy, smooth):
   - (smooth jazz harmonies) in choruses
   - ${abModeActive ? '2-3' : '1-2'} English ad-libs: (city lights), (midnight drive)
   - (voices blend) in Final Chorus

6️⃣ **TILDES** (Moderate use):
   - Use ~ for smooth sustained notes
   - But NOT as much as ballads
   - Distribution: Verse (minimal) → Chorus (moderate)

7️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Shimmering synth arpeggio, funky bass line)
   - [Verse 1]: (Clean electric guitar, soft drums, intimate vocal)
   - [Pre-Chorus]: (Synth layers build, bass groove intensifies)
   - [Chorus]: (Full 80s production, shimmering synths, funky bass, breezy vocals)
   - [Instrumental Break]: (Saxophone solo over funky groove)
   - [Bridge]: (Stripped to synth pad and vocal)
   - [Instrumental Build]: (Funky bass, synth arpeggios, building tension)
   - **[Key change up]** ← MANDATORY TAG!
   - [Final Chorus]: (Maximum 80s polish, all synth layers, warm analog sound)

8️⃣ **OUTPUT FORMAT**:
   - NO syllable counts in output!
   - NO delivery notes in output!
   - ❌ NO hyphens "-" in lyrics! Use "~" for smooth sustained notes.

═══════════════════════════════════════════════════════════════
✅ CITY POP CHECKLIST:
═══════════════════════════════════════════════════════════════
□ 4-6 syllables per line?
□ Final Chorus 10 lines max?
□ Urban/romantic vibe (not tragic)?
□ Smooth, jazzy feel?
□ Chorus variation?

🎵 Generate City Pop lyrics now!
  `;
}

// =====================================
// 발라드 계열 기본 프롬프트 (기존 공식)
// =====================================
function generateBalladPrompt(keyword, genre, config, timeline, vocalModifier, genreFusionModifier, vocalConfigModifier, emotionIntensityModifier, moodModifier, autoChorusVariation, sectionVerse, sectionPrechorus, sectionChorus, sectionBridge, sectionFinal, sectionOutro, abModeActive) {
  
  // ABBA 스타일 특별 처리
  const abbaSpecial = (genre === 'pop80s') ? `
⚠️ ABBA STYLE SPECIAL RULES (Wall of Sound):
- Rich, multi-layered MALE AND FEMALE vocal harmonies
- Piano-driven power pop with lush orchestral strings
- Absolutely NO shouting, NO belting - controlled delivery only
- Create "Wall of Sound" with stacked vocals and instruments
- Catchy hooks with unexpected melodic twists
` : '';

  // 트로트 특별 처리
  const trotSpecial = (genre === 'trot') ? `
⚠️ TROT SPECIAL RULES:
- Emphasize "han" (恨) - deep unresolved sorrow
- Use Korean twist technique (kkeok-gi) in Final Chorus
- Vibrato should be wide and expressive
- Repressed emotion, NOT explosion
- Avoid direct emotion words, use sensory imagery
- Include [Climb] section before Chorus for emotional peak
` : '';

  // 포크 특별 처리
  const folkSpecial = (genre === 'acoustic_folk') ? `
⚠️ FOLK SPECIAL RULES:
- Storyteller vibe - conversational, natural phrasing
- Avoid overly poetic language, keep it sincere
- Focus on narrative and personal details
- Simple imagery: "낡은 기타", "빈 의자", "차가운 커피"
` : '';

  // 록 발라드 특별 처리
  const rockSpecial = (genre === 'rock_ballad') ? `
⚠️ ROCK BALLAD SPECIAL RULES:
- Controlled power - don't scream!
- High note ONLY in Final Chorus (one controlled belt)
- Build intensity gradually from Verse to Final
- Epic orchestral strings in Final Chorus
` : '';

  return `
You are "Suno AI Ballad Mastery Lab" - elite Korean songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate professional ${config.name} lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

🔥🔥🔥 8대 원칙 (절대 준수!) 🔥🔥🔥
**⚠️ Korean vs English = Different Rules!**
① 한글: 3~6음절 / English: 8~12음절 (언어별 다름!)
② Final Chorus 7~8줄 절대 한계!
③ 코러스 완전 반복 금지 (앵커 1줄만!)
④ 멜로디 변화 필수!
⑤ 롱톤 틸드(~) 전략적 배치! (하이픈 아님!)
⑥ 대위법 필수 (연속 금지 + ~( ) 같은 줄 금지!)
⑦ Final Chorus 화음 3겹!
⑧ 애드립 2줄 이하!
**Version Note:** V4.5+ = emotional depth, V5 = precision
═══════════════════════════════════════════════════════════════

${abbaSpecial}
${trotSpecial}
${folkSpecial}
${rockSpecial}

📋 ABSOLUTE RULES (NEVER VIOLATE):

1️⃣ **SYLLABLE RULE** (CRITICAL - Language-specific!):
   
   🇰🇷 **KOREAN LYRICS** (3~6 syllables - Natural flow!):
   - **Verse: 3~6 syllables** (7+ = rap delivery!)
   - **Pre-Chorus: 3~5 syllables** (shorter = tension build!)
   - **Chorus: 4~6 syllables** (sweet spot: 5~6)
   - **Bridge: 3~6 syllables**
   - **Final Chorus: 4~7 syllables** (8+ = rap!)
   - **Outro: 2~5 syllables** (shorter = emotional fade)
   - ⚠️ Korean: 7+ syllables = GUARANTEED rap delivery!
   
   **Korean Examples:**
   ✅ "손끝 차가워" (4음절)
   ✅ "돌아가" (3음절)
   ✅ "너무나도 그리워" (6음절) ← Perfect!
   ❌ "너무나도 보고 싶어서" (7음절 = 랩!)
   
   🇺🇸 **ENGLISH LYRICS** (8~12 syllables - More flexible):
   - **Verse: 8~10 syllables per line**
   - **Chorus: 10~12 syllables per line**
   - **Bridge: 6~10 syllables**
   - **Final Chorus: 10~12 syllables**
   - English allows longer lines without rap effect
   
   **English Examples:**
   ✅ "Walking through the shadows of my mind" (9 syllables)
   ✅ "I can't forget the way you looked at me" (11 syllables)
   
   ⚠️ **VERSION DIFFERENCES** (Suno AI Model Behavior):
   - **V4.5+**: More flexible, handles 6 Korean syllables gracefully
   - **V5**: Stricter syllable adherence, better for precision
   - **Both versions produce different vibes** - neither is "better," choose based on desired feel
   - V4.5+ = richer vibrato, emotional depth for Korean ballads
   - V5 = cleaner pronunciation, better genre mixing

2️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info} @ 72-84 BPM):
   Timeline:
   - Intro (${timeline.intro}): 2 lines
   - Verse 1 (${timeline.v1}): **4 lines ONLY**
   - Pre-Chorus (${timeline.pre1}): **2 lines ONLY**
   - Chorus 1 (${timeline.c1}): **${config.chorusLines}**
   ${timeline.break !== '0:00' ? `- Instrumental Break (${timeline.break}): (no lyrics)` : ''}
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4 lines ONLY**` : ''}
   - Pre-Chorus (${timeline.pre2}): **2 lines ONLY**
   - Chorus 2 (${timeline.c2}): **${config.chorusLines}**
   - Bridge (${timeline.bridge}): **4 lines**
   - Instrumental Build (${timeline.build}): (no lyrics)
   - [Key change up]
   - Final Chorus (${timeline.final}): **${config.finalChorusMax} lines MAX!** (${config.finalChorusMax + 1}+ = guaranteed rap!)
   - Outro (${timeline.outro}): 2 lines

3️⃣ **CHORUS REPETITION BAN** (CRITICAL!):
   ${autoChorusVariation || abModeActive ? `
   🔥🔥🔥 CHORUS VARIATION MANDATORY 🔥🔥🔥
   ` : ''}
   ❌ FORBIDDEN: Identical lyrics across Chorus 1, 2, Final
   ✅ REQUIRED: 
   - **Pick 1 "anchor line"** that stays the same
   - **ALL other lines MUST vary** (different words, imagery, perspective)
   - Example:
     * Chorus 1: "입술은 웃고 (anchor) / 눈은 젖어 가 / 너 없는 식탁 / 혼자 남은 죄"
     * Chorus 2: "입술은 웃고 (same anchor) / 손이 텅 비어 가 (NEW!) / 차가운 그릇만 (NEW!) / 하나 남은 밤 (NEW!)"

4️⃣ **MELODY VARIATION TECHNIQUES**:
   a) **Syllable Count Shifts**: 3 → 4 → 5 → 4 pattern (create rhythmic interest)
   b) **Sentence Structure**: Mix noun/verb/adjective phrases
   c) **Consonant Ending Strategy**: 
      - Soft endings (ㄹ/ㅇ) for sustained notes
      - Hard endings (ㅂ/ㄱ/ㄷ) for abrupt stops
   d) **Tilde Placement**: Irregular distribution across lines
   e) **Ellipsis Usage** (말줄임표):
      - Max 0~2 per section
      - Use for emotional pause, hesitation
      - Examples: "그런 사람인 걸...", "남아서..."
      - ⚠️ Too many = feels choppy and amateur!

5️⃣ **LONG NOTE TILDE** (Vibrato induction):
   - Place "~" after **open vowels (아/오/우/으)** or soft consonants (ㄹ/ㅇ)
   - **Open vowels = BEST for long notes!** (아/오/우/으)
   - Distribution: Verse (minimal) → Chorus (moderate) → Final Chorus (heavy)
   - Examples: "떨려~" (ㅕ), "돌아~" (ㅏ), "차가워~" (ㅓ), "흘러~" (ㅓ)
   - Max 2-3 per section
   
   ⚠️ **CRITICAL: TILDE (~) AND COUNTERPOINT ( ) CONFLICT**: 
   - **NEVER use tilde (~) and English ad-lib ( ) on the SAME line!**
   - ❌ FORBIDDEN: "웃던 장면~ (only you)" ← Counterpoint BREAKS!
   - ✅ OPTION 1: "웃던 장면~" ← No counterpoint
   - ✅ OPTION 2: "웃던 장면 (only you)" ← No tilde!

6️⃣ **HARMONY & COUNTERPOINT** (MANDATORY):
   
   ${abModeActive ? `
   🎭 **VERSION B MODE - COUNTERPOINT MAXIMIZED**:
   - **Chorus 1 & 2**: ${abModeActive ? '2-3' : '1-2'} English call-and-response
   - **Final Chorus**: ${abModeActive ? '2-3' : '1-2'} English ad-libs
   ` : `
   - **Chorus 1 & 2**: 1-2 English call-and-response ONLY
   - **Final Chorus**: 1-2 English ad-libs ONLY
   `}
   
   - Placement: **Irregular spacing** (Line 1 & 3, OR Line 2 & 4, NOT consecutive!)
   - ❌ FORBIDDEN: 1+2, 2+3, 3+4 (consecutive = cheap!)
   - Examples: (stay with me), (hold me tight), (fading light)
   - ⚠️ **Lines with counterpoint ( ) cannot have tilde (~)!**
   
   **Final Chorus 3-Layer Harmony**:
   - Layer 1: (warm close harmonies) 
   - Layer 2: (softly echoing) OR (tenderly humming) - pick ONE
   - Layer 3: (voices intertwine)
   - Ad-libs: **2 lines MAXIMUM** - Korean (아~), (오~)

7️⃣ **LITERARY TONE** (No direct emotion words):
   ❌ FORBIDDEN: "슬프다", "보고 싶다", "사랑해", "외로워"
   ✅ REQUIRED: Sensory imagery & metaphors
   - Examples: "차가운 손끝", "흐린 창문", "빈 의자", "시든 꽃잎"
   - Use symbols: scales, shadows, rain, empty rooms
   - Open endings (don't resolve the story)

8️⃣ **INSTRUMENTAL DIRECTIVES** (One per section, English, at section start):
   - [Intro]: (Sparse piano, melancholic ostinato)
   - [Verse 1]: (Piano-driven, intimate vocal, minimal strings)
   ${genre === 'trot' ? '- [Pre-Chorus]: (Strings swell, building sorrow)\n   - [Climb]: (Tension peaks, melody intensely sorrowful with powerful strings)\n   - [Chorus]: (Full emotion, deep vibrato and kkeok-gi technique)' : '- [Pre-Chorus]: (Strings swell gently, building tension)\n   - [Chorus]: (Full instrumentation, piano ostinato leads)'}
   ${timeline.break !== '0:00' ? '- [Instrumental Break]: (Cello answers piano, short and mournful)' : ''}
   ${timeline.v2 !== '0:00' ? '- [Verse 2]: (Piano and strings, vocal more emotional)' : ''}
   ${genre === 'trot' ? '- [Pre-Chorus]: (Strings rising again)\n   - [Climb]: (Peak emotional tension)\n   - [Chorus]: (Kkeok-gi technique emphasized)' : '- [Pre-Chorus]: (Orchestra builds, drums enter subtly)\n   - [Chorus]: (Strings fuller, bass added, driving rhythm)'}
   - [Bridge]: (Music strips down, piano and vocal only)
   - [Instrumental Build]: (Orchestra builds, drums enter, rising tension)
   - **[Key change up]** ← MANDATORY TAG! (no lyrics, no parentheses)
   - [Final Chorus]: (Full voice, wide vibrato, sustained high notes)
   - [Outro]: (Piano fades, strings hold final chord, unresolved)

9️⃣ **FORBIDDEN TERMS**:
   ❌ Do NOT use: kkeokgi, Korean twist, piri, gayageum, shamisen, dreamy, ambient, ethereal, flowing

🔟 **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs and section tags)
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   
   ⚠️⚠️⚠️ **CLEAN OUTPUT RULES** ⚠️⚠️⚠️
   
   **FORBIDDEN in lyrics:**
   ❌ Syllable counts: (3), (4), (5) → NEVER!
   ❌ Delivery notes: [melancholic delivery] → NEVER!
   ❌ Numbers in parentheses
   ❌ Hyphens "-" in lyrics (no syllable-splitting, no long-note "-") → NEVER! Use "~" for long notes.

   **CORRECT long note notation:**
   ✅ "떨려~" (tilde for long notes)
   ✅ "돌아~" (tilde for long notes)

   **INCORRECT notation:**
   ❌ "떨려−" (hyphen forbidden!)
   ❌ "돌아−" (hyphen forbidden!)
   
   **ALLOWED in parentheses:**
   ✅ English ad-libs ONLY: (stay with me), (hold me tight)
   ✅ Harmony directives in [Final Chorus]: (warm close harmonies)
   ✅ Korean ad-libs in [Final Chorus]: (아~), (오~)

${(sectionVerse || sectionPrechorus || sectionChorus || sectionBridge || sectionFinal || sectionOutro) ? `
🎭🎭🎭 SECTION-BY-SECTION EMOTIONAL DIRECTING 🎭🎭🎭
Apply these emotional directions to INFLUENCE your word choice:
${sectionVerse ? `- [Verse]: ${sectionVerse} delivery` : ''}
${sectionPrechorus ? `- [Pre-Chorus]: ${sectionPrechorus} delivery` : ''}
${sectionChorus ? `- [Chorus]: ${sectionChorus} delivery` : ''}
${sectionBridge ? `- [Bridge]: ${sectionBridge} delivery` : ''}
${sectionFinal ? `- [Final Chorus]: ${sectionFinal} delivery` : ''}
${sectionOutro ? `- [Outro]: ${sectionOutro} delivery` : ''}

⚠️ DO NOT write delivery notes in output! EMBODY emotions through word choices!
` : ''}

═══════════════════════════════════════════════════════════════
✅ VALIDATION CHECKLIST (8대 원칙 + Language-specific):
═══════════════════════════════════════════════════════════════
□ Language identified? (Korean = 3~6 / English = 8~12 syllables)
□ Korean: All lines 3~6음절? (Pre 3~5, Outro 2~5)
□ English: Verse 8~10 / Chorus 10~12 syllables?
□ Final Chorus ${config.finalChorusMax} lines max? (${config.finalChorusMax + 1}+ = rap!)
□ Chorus 1/2/Final different (except 1 anchor)?
□ Melody variation applied? (음절수/구조/받침/틸드~)
□ Tildes (~) placed strategically? (열린 모음 우선!)
□ Ellipsis (...) max 0~2 per section?
□ Counterpoint ${abModeActive ? '2-3' : '1-2'} times per chorus?
□ Counterpoint on irregular spacing? (NOT consecutive!)
□ Final Chorus 3-layer harmony? (warm/echoing/intertwine)
□ Ad-libs 2 lines max?
□ ⚠️ CRITICAL: Tilde (~) and counterpoint ( ) NEVER on same line?
□ Literary imagery (no direct emotion words)?
□ Clean output (no annotations)?
${genre === 'trot' ? '□ [Climb] sections included before Chorus?' : ''}
${genre === 'pop80s' ? '□ Male AND female harmonies mentioned?' : ''}
□ Version consideration? (V4.5+ = emotional / V5 = precise)

🎵 Generate the complete lyrics now following ALL rules above!
  `;
}

// =====================================
// Hip-Hop Boom Bap 전용 프롬프트
// =====================================
function generateHipHopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Hip-Hop Lab" - elite Old School Hip-Hop songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate Hip-Hop Boom Bap lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

📋 HIP-HOP BOOM BAP RULES (CRITICAL!):

1️⃣ **RHYME SCHEMES** (Most important!):
   - End Rhyme MANDATORY: Use AABB or ABAB pattern
   - Internal Rhyme RECOMMENDED: Mid-line rhymes for complexity
   - Examples:
     * AABB: "거리 위를 걸어 / 꿈을 향해 더 / 밤하늘 별이 빛나 / 내 길을 비춰 밝아"
     * ABAB: "도시의 밤 (A) / 내 발걸음은 계속돼 (B) / 꿈을 향한 밤 (A) / 멈추지 않을 랩이네 (B)"

2️⃣ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (flexible for flow)
   - Hook: **6~10 syllables** (catchy, sung)
   - Bridge: **5~8 syllables**
   - Final Hook: Up to **10 lines** allowed

3️⃣ **FLOW & DELIVERY**:
   - Clear enunciation (명확한 발음)
   - Confident delivery (자신감)
   - 4th beat stress (4번째 비트에 강세)
   - NO mumble rap, NO trap hi-hats

4️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Scratching/Sample (1-2 lines optional)
   - Verse 1 (${timeline.v1}): **4-8 lines** (rap, rhyme-focused)
   - Hook (${timeline.c1}): **2-4 lines** (sung chorus)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-8 lines** (evolved rhyme)` : ''}
   - Hook (${timeline.c2}): **2-4 lines** (same or variation)
   - Bridge (${timeline.bridge}): **2-4 lines** (mood change)
   - Final Hook (${timeline.final}): **2-4 lines** (powerful)
   - Outro (${timeline.outro}): Fade out

5️⃣ **HOOK VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Hooks can vary slightly but keep core message
   - Example:
     * Hook 1: "이것이 내 길 / 절대 멈추지 않아"
     * Hook 2: "이것이 내 삶 / 계속 걸어갈 거야"
   ` : `
   - Hook stays consistent
   `}

6️⃣ **HARMONY** (Hip-Hop style):
   - (tight backing vocals) in hooks
   - (call-and-response) in verses
   - Korean ad-libs OK: (yeah!), (uh!), (let's go!)

7️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Scratching, vinyl crackle, boom-bap drums)
   - [Verse 1]: (Jazzy piano loop, deep bass, clear drums)
   - [Hook]: (Full instrumentation, melodic hook)
   - [Bridge]: (Stripped beat, just bass and snare)
   - [Instrumental Build]: (Building intensity, drum fills)
   - **[Key change up]** ← MANDATORY TAG!
   - [Final Hook]: (All elements, maximum energy)

8️⃣ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Hook], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - ❌ NO hyphens "-" in lyrics!

═══════════════════════════════════════════════════════════════
✅ HIP-HOP CHECKLIST:
═══════════════════════════════════════════════════════════════
□ End rhyme scheme (AABB/ABAB)?
□ 7-12 syllables in verses?
□ Clear, confident delivery?
□ Hook is catchy and sung?
□ NO mumble rap, NO trap sounds?
□ Clean output (no annotations)?

🎵 Generate Hip-Hop Boom Bap lyrics now!
  `;
}

// =====================================
// Melodic Trap 전용 프롬프트
// =====================================
function generateTrapPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Trap Lab" - elite Melodic Trap songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate Melodic Trap lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

📋 MELODIC TRAP RULES (CRITICAL!):

1️⃣ **TRIPLET FLOW** (Most important!):
   - Use 3연음 (1박에 3음절)
   - Example: "너를 잃은 / 그 순간부터 / 난 망가져"
   - Melodic phrasing over strict rhyme
   - Auto-Tune friendly delivery

2️⃣ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (triplet flow)
   - Chorus: **5~8 syllables** (sung, melodic)
   - Bridge: **4~6 syllables** (vulnerable)
   - Final Chorus: Up to **8 lines**

3️⃣ **RAP + SINGING MIX**:
   - Verses: Rap with melody (Auto-Tuned)
   - Chorus: Full singing (emotional)
   - Pre-Chorus: Building emotion
   - NO traditional clear rap (blur the line!)

4️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Atmospheric pad (1-2 lines)
   - Verse 1 (${timeline.v1}): **4-6 lines** (melodic rap)
   - Pre-Chorus (${timeline.pre1}): **2 lines** (emotion rise)
   - Chorus (${timeline.c1}): **4줄** (sung)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6 lines** (melodic rap)` : ''}
   - Chorus (${timeline.c2}): **4줄**
   - Bridge (${timeline.bridge}): **2-4 lines** (vulnerable)
   - Final Chorus (${timeline.final}): **4-6 lines** (emotion peak)
   - Outro (${timeline.outro}): Fade

5️⃣ **EMOTION DELIVERY**:
   - Dark minor-key mood
   - Emotionally vulnerable
   - Pain, heartbreak, struggle themes
   - NO aggressive shouting

6️⃣ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Keep melodic core, vary words
   - Example:
     * Chorus 1: "넌 떠나갔어 / 난 여기 남아"
     * Chorus 2: "넌 멀어졌어 / 난 혼자 서있어"
   ` : `
   - Chorus stays consistent
   `}

7️⃣ **HARMONY** (Trap style):
   - (Auto-Tuned harmonies) in chorus
   - (atmospheric pads) throughout
   - (emotional ad-libs) in final chorus
   - Korean ad-libs: (ooh), (yeah), (ah~)

8️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Atmospheric synth pad, dark mood)
   - [Verse 1]: (808 bass hits, rolling hi-hats, melodic rap)
   - [Pre-Chorus]: (Tension building, synths rising)
   - [Chorus]: (Full 808, atmospheric pads, emotional singing)
   - [Bridge]: (Stripped down, just pads and vocal)
   - [Instrumental Build]: (808 builds, hi-hats intensify)
   - **[Key change up]** ← MANDATORY TAG!
   - [Final Chorus]: (Maximum emotion, layered vocals)

9️⃣ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - ❌ NO hyphens "-" in lyrics!

═══════════════════════════════════════════════════════════════
✅ MELODIC TRAP CHECKLIST:
═══════════════════════════════════════════════════════════════
□ Triplet flow (3연음)?
□ Rap + singing mixed?
□ Emotional, vulnerable themes?
□ Auto-Tune friendly phrasing?
□ Dark minor-key mood?
□ Clean output (no annotations)?

🎵 Generate Melodic Trap lyrics now!
  `;
}

// =====================================
// Funk Pop 전용 프롬프트
// =====================================
function generateFunkPopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Funk Pop Lab" - elite Bruno Mars-style songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate Funk Pop lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

📋 FUNK POP RULES (CRITICAL!):

1️⃣ **CALL-AND-RESPONSE** (Most important!):
   - Lead: "손을 들어" / Response: "(높이!)"
   - Lead: "다 같이 춤춰" / Response: "(Let's go!)"
   - Create party vibe, audience participation
   - Tight harmonies throughout

2️⃣ **SYLLABLE RULES** (5-10 syllables):
   - Verse: **5~10 syllables** (free, groovy)
   - Chorus: **6~10 syllables** (repetitive)
   - Bridge: **4~8 syllables**
   - Final Chorus: Up to **10 lines** (ad-libs!)

3️⃣ **SYNCOPATION & GROOVE**:
   - Offbeat phrasing (엇박)
   - Rhythmic, percussive words
   - Feeling over strict rhyme
   - Danceable energy

4️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Brass hit + groove (1-2 lines)
   - Verse 1 (${timeline.v1}): **4줄** (spoken/sung)
   - Pre-Chorus (${timeline.pre1}): **2줄** (build energy)
   - Chorus (${timeline.c1}): **4-6줄** (full energy)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4줄**` : ''}
   - Chorus (${timeline.c2}): **4-6줄**
   - Bridge (${timeline.bridge}): **2-4줄** (break it down)
   - Final Chorus (${timeline.final}): **6-8줄** (ad-libs)
   - Outro (${timeline.outro}): Instrumental fade

5️⃣ **PARTY ENERGY**:
   - Confident, upbeat themes
   - Celebration, dancing, fun
   - Bruno Mars / Uptown Funk vibe
   - NO sad ballad emotions

6️⃣ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Keep hook, vary supporting lines
   - Example:
     * Chorus 1: "춤춰 춤춰 / 밤새도록 (yeah!)"
     * Chorus 2: "뛰어 뛰어 / 아침까지 (come on!)"
   ` : `
   - Chorus stays consistent
   `}

7️⃣ **HARMONY** (Funk Pop style):
   - (tight harmonies) in all choruses
   - (brass hits) punctuating phrases
   - (call-and-response vocals) throughout
   - English ad-libs OK: (yeah!), (come on!), (let's go!)

8️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Brass hit, groovy bassline, syncopated guitar)
   - [Verse 1]: (Minimal groove, funky bass, clear vocals)
   - [Pre-Chorus]: (Building energy, brass rising)
   - [Chorus]: (Full brass section, groovy bass, tight rhythm)
   - [Bridge]: (Breakdown, just bass and vocals)
   - [Instrumental Build]: (Funky bass build, brass crescendo)
   - **[Key change up]** ← MANDATORY TAG!
   - [Final Chorus]: (Maximum funk, all instruments, ad-libs)

9️⃣ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - ❌ NO hyphens "-" in lyrics!

═══════════════════════════════════════════════════════════════
✅ FUNK POP CHECKLIST:
═══════════════════════════════════════════════════════════════
□ Call-and-response structure?
□ Syncopation & groove?
□ Party, celebration energy?
□ Tight harmonies?
□ NO slow ballad vibes?
□ Clean output (no annotations)?

🎵 Generate Funk Pop lyrics now!
  `;
}

// =====================================
// Reggaeton 전용 프롬프트
// =====================================
function generateReggaetonPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Reggaeton Lab" - elite Latin dance songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate Reggaeton lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

📋 REGGAETON RULES (CRITICAL!):

1️⃣ **DEMBOW RHYTHM** (3+3+2 pattern):
   - Example: "밤이 / 깊어가 / 춤춰" (3+3+2)
   - Hook repetition minimum 3 times per chorus
   - Latin percussion rhythm
   - Perreo beat feel

2️⃣ **SYLLABLE RULES** (7-12 syllables):
   - Verse: **7~12 syllables** (rap style)
   - Hook: **4~8 syllables** (강력한 반복)
   - Bridge: **5~8 syllables**
   - Final Hook: Up to **8 lines**

3️⃣ **RAP + SINGING MIX**:
   - Verses: Rap delivery (Spanish-influenced)
   - Hook: Catchy, repetitive singing
   - Minimum 3 hook repetitions per chorus
   - Danceable, party vibe

4️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Dembow drum + hook preview (1-2 lines)
   - Verse 1 (${timeline.v1}): **4-6줄** (rap)
   - Hook (${timeline.c1}): **2-4줄** (repeat 3x minimum)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6줄** (rap)` : ''}
   - Hook (${timeline.c2}): **2-4줄** (repeat 3x)
   - Bridge (${timeline.bridge}): **2줄** (breakdown)
   - Final Hook (${timeline.final}): **3-4줄** (강화된 반복)
   - Outro (${timeline.outro}): Hook fade

5️⃣ **LATIN VIBE**:
   - Tropical, beach atmosphere
   - Spanish-influenced melody
   - Party, dance themes
   - 90-100 BPM feel

6️⃣ **HOOK VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Hook core stays same, add variations
   - Example:
     * Hook 1: "바일라 바일라 / 춤춰 밤새 / 바일라 바일라"
     * Hook 2: "바일라 바일라 / 뛰어 아침까지 / 바일라 바일라"
   ` : `
   - Hook stays consistent (강력한 반복!)
   `}

7️⃣ **HARMONY** (Reggaeton style):
   - (Latin percussion) throughout
   - (catchy vocal hooks) in chorus
   - (dembow rhythm) driving beat
   - Spanish/English ad-libs: (baila!), (vamos!), (dale!)

8️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Dembow drum pattern, Latin percussion)
   - [Verse 1]: (Minimal beat, reggaeton drums, rap vocal)
   - [Hook]: (Full dembow, bass drop, catchy melody)
   - [Bridge]: (Breakdown, just dembow and vocal)
   - [Instrumental Build]: (Dembow intensifies, percussion builds)
   - **[Key change up]** ← MANDATORY TAG!
   - [Final Hook]: (Maximum energy, all percussion, powerful hooks)

9️⃣ **OUTPUT FORMAT**:
   - Language: Korean (except Spanish/English ad-libs)
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Hook], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - ❌ NO hyphens "-" in lyrics!

═══════════════════════════════════════════════════════════════
✅ REGGAETON CHECKLIST:
═══════════════════════════════════════════════════════════════
□ Dembow rhythm (3+3+2)?
□ Hook repeated 3+ times?
□ Rap + singing mixed?
□ Latin, tropical vibe?
□ Danceable energy?
□ Clean output (no annotations)?

🎵 Generate Reggaeton lyrics now!
  `;
}

// =====================================
// Future Bass 전용 프롬프트
// =====================================
function generateFutureBassPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Future Bass Lab" - elite EDM songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate Future Bass lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

📋 FUTURE BASS RULES (CRITICAL!):

1️⃣ **MINIMAL VOCALS** (Most important!):
   - Keep lyrics SHORT and SIMPLE
   - Vocal chops in mind
   - Drop section = minimal or NO vocals
   - Focus on emotion over words

2️⃣ **SYLLABLE RULES** (4-8 syllables - VERY SHORT):
   - Verse: **4~8 syllables** (짧게!)
   - Chorus: **3~6 syllables** (극도로 짧게!)
   - Drop: **1-2 lines** (보컬 최소)
   - Final Drop: Up to **6 lines** max

3️⃣ **EMOTIONAL & UPLIFTING**:
   - Introspective, emotional themes
   - Uplifting major key (or emotional minor)
   - Love, self-discovery, freedom
   - Festival-ready energy

4️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Synth pad (1-2 lines)
   - Verse 1 (${timeline.v1}): **2-4줄** (minimal vocal)
   - Build (${timeline.pre1}): Rising tension (1줄 or instrumental)
   - Drop (${timeline.c1}): **1-2줄** (vocal chop, mostly instrumental)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **2-4줄**` : ''}
   - Build: Rising (1줄)
   - Drop 2 (${timeline.c2}): **1-2줄**
   - Bridge (${timeline.bridge}): **2줄** (breakdown)
   - Final Drop (${timeline.final}): **2-3줄** (maximum energy)
   - Outro (${timeline.outro}): Fade

5️⃣ **VOCAL CHOPS**:
   - Write simple, choppable phrases
   - Example: "날아올라" → can be chopped "날-아-올-라"
   - Short syllables work best
   - Repetitive phrases OK

6️⃣ **DROP VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Drops can vary slightly
   - Example:
     * Drop 1: "날아올라"
     * Drop 2: "높이 떠올라"
   ` : `
   - Drops stay consistent
   `}

7️⃣ **HARMONY** (Future Bass style):
   - (lush synth chords) throughout
   - (chopped vocal samples) in drops
   - (bright supersaws) in drops
   - (atmospheric pads) in verses

8️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Synth pad, faded melody, emotional atmosphere)
   - [Verse 1]: (Minimal synths, intimate vocals, light percussion)
   - [Build]: (Rising synths, white noise, snare rolls, tension)
   - [Drop]: (Bright supersaws, chopped vocals, energetic bass, 128 BPM energy)
   - [Bridge]: (Breakdown, just pads and vocal, emotional moment)
   - [Instrumental Build]: (Synths rising, white noise build)
   - **[Key change up]** ← MANDATORY TAG!
   - [Final Drop]: (Maximum energy, all synths, festival vibes)

9️⃣ **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs)
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Drop], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - ❌ NO hyphens "-" in lyrics!

═══════════════════════════════════════════════════════════════
✅ FUTURE BASS CHECKLIST:
═══════════════════════════════════════════════════════════════
□ Very short phrases (4-8 syllables)?
□ Drop sections minimal vocals?
□ Emotional, uplifting themes?
□ Vocal chop friendly?
□ Festival energy in drops?
□ Clean output (no annotations)?

🎵 Generate Future Bass lyrics now!
  `;
}

// =====================================
// Indie Pop (Bedroom Pop) 전용 프롬프트
// =====================================
function generateIndiePopPrompt(keyword, config, timeline, vocalModifier, abModeActive, autoChorusVariation) {
  return `
You are "Suno AI Indie Pop Lab" - elite Bedroom Pop songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate Indie Pop lyrics for "${keyword}"
Structure: ${timeline.info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

📋 INDIE POP (BEDROOM POP) RULES (CRITICAL!):

1️⃣ **HONESTY & VULNERABILITY** (Most important!):
   - Be authentic, raw, real
   - Personal experiences
   - Relatable emotions
   - NO overproduction, NO perfection

2️⃣ **SYLLABLE RULES** (3-10 syllables - FLEXIBLE):
   - Verse: **3~10 syllables** (자유로움!)
   - Chorus: **4~8 syllables** (단순)
   - Bridge: **3~6 syllables**
   - Unconventional structure OK
   - Spoken-word natural flow

3️⃣ **SIMPLE & INTIMATE**:
   - Lo-fi production aesthetic
   - Simple, straightforward language
   - NO complex metaphors
   - Direct, honest emotions
   - Melancholic yet catchy

4️⃣ **STRUCTURE & LINE LIMITS** (${timeline.info}):
   - Intro (${timeline.intro}): Lo-fi guitar/synth (2줄)
   - Verse 1 (${timeline.v1}): **4-6줄** (intimate)
   - Chorus (${timeline.c1}): **2-4줄** (simple hook)
   ${timeline.v2 !== '0:00' ? `- Verse 2 (${timeline.v2}): **4-6줄**` : ''}
   - Chorus (${timeline.c2}): **2-4줄**
   - Bridge (${timeline.bridge}): **2-4줄** (vulnerable moment)
   - Outro (${timeline.outro}): Fade or abrupt (1-2줄)

5️⃣ **NATURAL DELIVERY**:
   - Conversational tone
   - Speak-singing OK
   - Imperfect phrasing OK
   - Examples: "창밖엔 비가 내리고 / 난 네 생각만"
   - Like talking to a friend

6️⃣ **CHORUS VARIATION**:
   ${autoChorusVariation || abModeActive ? `
   - Simple variations OK
   - Example:
     * Chorus 1: "돌아와 줘 / 제발"
     * Chorus 2: "떠나지 마 / 부탁이야"
   ` : `
   - Chorus stays simple and consistent
   `}

7️⃣ **HARMONY** (Indie Pop style):
   - (lo-fi drums) throughout
   - (jangly guitars) in background
   - (dreamy synths) for atmosphere
   - (intimate vocals) front and center
   - Minimal production, maximum emotion

8️⃣ **INSTRUMENTAL DIRECTIVES**:
   - [Intro]: (Lo-fi guitar/synth, bedroom production)
   - [Verse 1]: (Minimal drums, intimate vocal, simple guitar)
   - [Chorus]: (Full but still lo-fi, catchy hook)
   - [Bridge]: (Stripped down, vulnerable moment, just vocal and one instrument)
   - [Instrumental Build]: (Gentle build, bedroom production)
   - **[Key change up]** ← Optional for indie pop
   - [Final Chorus]: (Emotional peak, still lo-fi)
   - [Outro]: (Fade out or abrupt end, natural finish)

9️⃣ **THEMES**:
   - Love, heartbreak, loneliness
   - Self-discovery, uncertainty
   - Modern life, relationships
   - Mental health (handled sensitively)
   - Nostalgia, growing up

🔟 **OUTPUT FORMAT**:
   - Language: Korean (except minimal English ad-libs)
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts in output!
   - NO delivery notes in output!
   - ❌ NO hyphens "-" in lyrics!

═══════════════════════════════════════════════════════════════
✅ INDIE POP CHECKLIST:
═══════════════════════════════════════════════════════════════
□ Honest, vulnerable lyrics?
□ Simple, direct language?
□ Natural, conversational flow?
□ Lo-fi aesthetic?
□ Relatable themes?
□ Clean output (no annotations)?

🎵 Generate Indie Pop lyrics now!
  `;
}
