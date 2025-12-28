// =====================================================
// Suno AI Lyrics Generation API v10.5
// 백엔드 전용 - 장르별 맞춤 프롬프트 + Rate Limiting!
// =====================================================

// Rate Limiting Map
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];
  
  // 1시간 내 요청만 필터
  const recentRequests = userRequests.filter(t => now - t < 3600000);
  
  if (recentRequests.length >= 20) {
    throw new Error('Too many requests (max 20/hour). Please try again later.');
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
}

// 장르별 가사 공식 설정
const GENRE_CONFIGS = {
  // 💎 감성 장인 팩 (발라드 계열)
  pop80s: {
    name: '80s 팝 발라드',
    syllableRule: '3-5음절 (최대 6음절)',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: '풍부한 화음과 감정적 빌드업'
  },
  trot: {
    name: '정통 트로트',
    syllableRule: '3-5음절 (꺾기 유도)',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: '한(恨)의 미학, 억제된 슬픔, 꺾기 기법(kkeok-gi) 필수'
  },
  ballad: {
    name: '한국형 감성 발라드',
    syllableRule: '3-5음절',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: '넓은 비브라토, 멜로디 중심'
  },
  acoustic_folk: {
    name: '어쿠스틱 포크',
    syllableRule: '3-5음절 (자연스러운 말투)',
    finalChorusMax: 8,
    chorusLines: '5-6줄',
    special: '이야기 전달 중심, 대화하듯 자연스럽게'
  },
  rock_ballad: {
    name: '록 발라드',
    syllableRule: '3-5음절 (고음 롱톤 유도)',
    finalChorusMax: 9,
    chorusLines: '5-6줄',
    special: '절제된 힘, 고음 폭발은 Final Chorus에만 1회!'
  },
  rnb: {
    name: '한국형 R&B 발라드',
    syllableRule: '3-5음절',
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
  }
};

module.exports = async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Rate Limiting 체크
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    checkRateLimit(clientIP);

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

    if (!userApiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword required' });
    }

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

    // === 특수 장르 처리 ===
    if (genre === 'kpop_dance') {
      lyricsPrompt = generateKPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else if (genre === 'lofi_hiphop') {
      lyricsPrompt = generateLofiPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier);
    } else if (genre === 'city_pop') {
      lyricsPrompt = generateCityPopPrompt(keyword, genreConfig, STRUCTURE_TIMELINES[structure], vocalModifier, abModeActive, autoChorusVariation);
    } else {
      // === 발라드 계열 (기본 공식) ===
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

    // Gemini API 호출
    const model = modelName || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userApiKey}`;

    const payload = {
      contents: [{ parts: [{ text: lyricsPrompt }] }],
      generationConfig: { temperature: 0.85, topK: 40, topP: 0.95, maxOutputTokens: 4096 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Gemini API Error: ${response.status} - ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const lyrics = data?.candidates?.[0]?.content?.parts?.[0]?.text || '생성 실패';

    return res.status(200).json({ lyrics });

  } catch (error) {
    console.error('Error:', error);
    
    if (error.message.includes('Too many requests')) {
      return res.status(429).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message || 'Server error' });
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
   - [Final Chorus]: (Maximum energy, all instruments, vocal power)

9️⃣ **OUTPUT FORMAT**:
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   - NO syllable counts (3), (4), (5) in output!
   - NO delivery notes [energetic delivery] in output!

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
   - [Final Chorus]: (All elements, but still chill and mellow)
   - [Outro]: (Piano fades, vinyl crackle remains)

6️⃣ **OUTPUT FORMAT**:
   - Very short output!
   - Most sections have NO lyrics (instrumental)
   - Only a few soft spoken/hummed lines total

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
   - [Final Chorus]: (Maximum 80s polish, all synth layers, warm analog sound)

8️⃣ **OUTPUT FORMAT**:
   - NO syllable counts in output!
   - NO delivery notes in output!

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
  
  // 트로트 특별 처리
  const trotSpecial = (genre === 'trot') ? `
⚠️ TROT SPECIAL RULES:
- Emphasize "han" (恨) - deep unresolved sorrow
- Use Korean twist technique (kkeok-gi) in Final Chorus
- Vibrato should be wide and expressive
- Repressed emotion, NOT explosion
- Avoid direct emotion words, use sensory imagery
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

${trotSpecial}
${folkSpecial}
${rockSpecial}

📋 ABSOLUTE RULES (NEVER VIOLATE):

1️⃣ **SYLLABLE RULE** (${config.syllableRule}):
   - Verse/Pre-Chorus/Bridge: ${config.syllableRule}
   - Chorus: ${config.syllableRule}
   - Exceeding 6 syllables = FAILURE (causes rap delivery!)

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
   a) Syllable Count Shifts: 3 → 4 → 5 → 4 pattern
   b) Sentence Structure: Mix noun/verb/adjective phrases
   c) Consonant Ending Strategy: 
      - Soft endings (ㄹ/ㅇ) for sustained notes
      - Hard endings (ㅂ/ㄱ/ㄷ) for abrupt stops
   d) Tilde Placement: Irregular distribution

5️⃣ **LONG NOTE TILDE** (Vibrato induction):
   - Place "~" after open vowels (아/오/우/으) or soft consonants (ㄹ/ㅇ)
   - Distribution: Verse (minimal) → Chorus (moderate) → Final Chorus (heavy)
   - Examples: "떨려~", "돌아~", "차가워~"
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
   - [Pre-Chorus]: (Strings swell gently, building tension)
   - [Chorus]: (Full instrumentation, piano ostinato leads)
   ${timeline.break !== '0:00' ? '- [Instrumental Break]: (Cello answers piano, short and mournful)' : ''}
   ${timeline.v2 !== '0:00' ? '- [Verse 2]: (Piano and strings, vocal more emotional)' : ''}
   - [Pre-Chorus]: (Orchestra builds, drums enter subtly)
   - [Chorus]: (Strings fuller, bass added, driving rhythm)
   - [Bridge]: (Music strips down, piano and vocal only)
   - [Instrumental Build]: (Orchestra builds, drums enter, rising tension)
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
✅ VALIDATION CHECKLIST:
═══════════════════════════════════════════════════════════════
□ All lines ${config.syllableRule}?
□ Final Chorus ${config.finalChorusMax} lines max?
□ Chorus 1/2/Final different (except 1 anchor)?
□ Melody variation applied?
□ Tildes (~) placed strategically?
□ Counterpoint ${abModeActive ? '2-3' : '1-2'} times per chorus?
□ Counterpoint on irregular spacing?
□ Final Chorus 3-layer harmony?
□ Ad-libs 2 lines max?
□ ⚠️ CRITICAL: Tilde (~) and counterpoint ( ) NEVER on same line?
□ Literary imagery (no direct emotion words)?
□ Clean output (no annotations)?

🎵 Generate the complete lyrics now following ALL rules above!
  `;
}
