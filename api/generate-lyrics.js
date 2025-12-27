// =====================================================
// Suno AI Lyrics Generation API
// 백엔드 전용 - 140줄 프롬프트 보호됨!
// =====================================================

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
      return res.status(400).json({ error: 'API 키가 필요해요!' });
    }

    if (!keyword) {
      return res.status(400).json({ error: '키워드가 필요해요!' });
    }

    // ★★★ 오빠의 140줄 비밀 프롬프트 (서버에만 존재!) ★★★
    const STRUCTURE_TIMELINES = {
      'standard': { info: '3:40 (표준)', intro: '0:08', v1: '0:28', pre1: '0:16', c1: '0:32', break: '0:15', v2: '0:28', pre2: '0:16', c2: '0:32', bridge: '0:24', build: '0:12', final: '0:37', outro: '0:12' },
      'short': { info: '2:30 (쇼츠)', intro: '0:05', v1: '0:22', pre1: '0:12', c1: '0:28', break: '0:00', v2: '0:00', pre2: '0:12', c2: '0:28', bridge: '0:18', build: '0:08', final: '0:30', outro: '0:07' },
      'extended': { info: '4:30 (풀버전)', intro: '0:12', v1: '0:32', pre1: '0:18', c1: '0:36', break: '0:20', v2: '0:32', pre2: '0:18', c2: '0:36', bridge: '0:28', build: '0:15', final: '0:42', outro: '0:15' }
    };

    const lyricsPrompt = `
You are "Suno AI Ballad Mastery Lab" - an elite Korean songwriting system.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate professional Korean ballad lyrics for "${keyword}" / Genre: ${genre}
Structure: ${STRUCTURE_TIMELINES[structure].info}
${vocalModifier ? `Vocal: ${vocalModifier}` : ''}
═══════════════════════════════════════════════════════════════

📋 ABSOLUTE RULES (NEVER VIOLATE):

1️⃣ **SYLLABLE RULE** (3-5 syllables per line, MAX 6):
   - Verse/Pre-Chorus/Bridge: 3-5 syllables
   - Chorus: 3-5 syllables (occasionally 6 if necessary)
   - Exceeding 6 syllables = IMMEDIATE FAILURE (causes rap delivery!)

2️⃣ **STRUCTURE & LINE LIMITS** (Total: ${STRUCTURE_TIMELINES[structure].info} @ 72-84 BPM):
   Timeline:
   - Intro (${STRUCTURE_TIMELINES[structure].intro}): 2 lines
   - Verse 1 (${STRUCTURE_TIMELINES[structure].v1}): **4 lines ONLY**
   - Pre-Chorus (${STRUCTURE_TIMELINES[structure].pre1}): **2 lines ONLY**
   - Chorus 1 (${STRUCTURE_TIMELINES[structure].c1}): **5-6 lines**
   ${structure === 'short' ? '' : `- Instrumental Break (${STRUCTURE_TIMELINES[structure].break}): (no lyrics)`}
   ${structure === 'short' ? '' : `- Verse 2 (${STRUCTURE_TIMELINES[structure].v2}): **4 lines ONLY**`}
   - Pre-Chorus (${STRUCTURE_TIMELINES[structure].pre2}): **2 lines ONLY**
   - Chorus 2 (${STRUCTURE_TIMELINES[structure].c2}): **5-6 lines**
   - Bridge (${STRUCTURE_TIMELINES[structure].bridge}): **4 lines**
   - Instrumental Build (${STRUCTURE_TIMELINES[structure].build}): (no lyrics)
   - [Key change up]
   - Final Chorus (${STRUCTURE_TIMELINES[structure].final}): **7-8 lines MAX!** (9+ = guaranteed rap!)
   - Outro (${STRUCTURE_TIMELINES[structure].outro}): 2 lines

3️⃣ **CHORUS REPETITION BAN** (CRITICAL!):
   ❌ FORBIDDEN: Identical lyrics across Chorus 1, 2, Final
   ✅ REQUIRED: 
   - **Pick 1 "anchor line"** that stays the same
   - **ALL other lines MUST vary** (different words, imagery, perspective)
   - Example:
     * Chorus 1: "입술은 웃고 (anchor) / 눈은 젖어 가 / 너 없는 식탁 / 혼자 남은 죄"
     * Chorus 2: "입술은 웃고 (same anchor) / 손이 텅 비어 가 (NEW!) / 차가운 그릇만 (NEW!) / 하나 남은 밤 (NEW!)"
   - This applies to ALL choruses (1, 2, Final)

4️⃣ **MELODY VARIATION TECHNIQUES** (Prevent monotony):
   a) Syllable Count Shifts: 3 → 4 → 5 → 4 pattern within sections
   b) Sentence Structure: Mix noun phrases → verb phrases → adjective phrases
   c) Consonant Ending Strategy: 
      - Soft endings (ㄹ/ㅇ) for sustained notes
      - Hard endings (ㅂ/ㄱ/ㄷ) for abrupt stops
   d) Tilde Placement: Irregular distribution (see Rule 5)

5️⃣ **LONG NOTE TILDE** (Vibrato induction):
   - Place "~" after open vowels (아/오/우/으) or soft consonants (ㄹ/ㅇ)
   - Distribution: Verse (minimal) → Chorus (moderate) → Final Chorus (heavy)
   - Examples: "떨려~", "돌아~", "차가워~", "얼굴~"
   - Do NOT overuse (max 2-3 per section)
   
   ⚠️ **CRITICAL: TILDE (~) AND COUNTERPOINT ( ) CONFLICT**: 
   - **NEVER use tilde (~) and English ad-lib ( ) on the SAME line!**
   - ❌ FORBIDDEN: "웃던 장면~ (only you)" ← Suno IGNORES counterpoint!
   - ❌ FORBIDDEN: "차가운 소리~ (fading light)" ← Counterpoint BREAKS!
   - ✅ OPTION 1 (Long note only): "웃던 장면~" ← No counterpoint
   - ✅ OPTION 2 (Counterpoint only): "웃던 장면 (only you)" ← No tilde!
   - **YOU MUST CHOOSE**: Either long note OR counterpoint, NOT BOTH!

6️⃣ **HARMONY & COUNTERPOINT** (MANDATORY):
   
   ${abModeActive ? `
   🎭 **VERSION B MODE - COUNTERPOINT MAXIMIZED**:
   This is VERSION B - Create a more experimental version with aggressive layered harmonies!
   
   A) **Chorus 1 & 2**: Add English call-and-response in parentheses
      - **Frequency: 2-3 times per chorus** (More than Version A!)
      - Placement: **Alternating lines** (e.g., Line 1 & 3 & 5, OR Line 2 & 4 & 6)
      - Allowed patterns: 1+3+5, 2+4, 1+4+6, 2+5 (irregular spacing)
      - ❌ FORBIDDEN: 1+2, 2+3, 3+4 (consecutive lines = sounds cheap!)
      - Keep on SAME line as Korean lyric (no line break!)
      - Example: "그 이름 석 자를 (stay with me)" ... "빈 의자 위로 (fading light)" ... "돌아올 수 없어 (never again)"
      - ⚠️ **If you want counterpoint, DO NOT use tilde (~) on that line!**
   ` : `
   A) **Chorus 1 & 2**: Add English call-and-response in parentheses
      - **Frequency: 1-2 times per chorus ONLY** (Not every line!)
      - Placement: **Alternating lines ONLY** (e.g., Line 1 & 3 OR Line 2 & 4 OR Line 1 & 4)
      - Allowed patterns: 1+3, 2+4, 1+4, 2+5 (irregular spacing)
      - ❌ FORBIDDEN: 1+2, 2+3, 3+4 (consecutive lines = sounds cheap!)
      - ❌ FORBIDDEN: Every line has counterpoint (max 2 times only!)
      - Keep on SAME line as Korean lyric (no line break!)
      - Example: "그 이름 석 자를 (stay with me)" then skip 1-2 lines, then "빈 의자 위로 (fading light)"
      - ⚠️ **If you want counterpoint, DO NOT use tilde (~) on that line!**
   `}
      
   B) **Final Chorus**: 3-Layer Harmony Structure
      - Layer 1 (foundation): (warm close harmonies) 
      - Layer 2 (texture): (softly echoing) OR (tenderly humming) - pick ONE
      - Layer 3 (climax): (voices intertwine)
      - **English call-and-response: ${abModeActive ? '2-3 times' : '1-2 times ONLY'}** (${abModeActive ? 'More aggressive!' : 'same rules as Chorus 1/2'})
      - Placement: Irregular spacing (Line 1 & 4, OR Line 2 & 5, etc.)
      - ❌ Do NOT put counterpoint on consecutive lines!
      - Ad-libs: **2 lines MAXIMUM** (Korean parenthetical reactions like "(아~)", "(오~)")
      - ⚠️ **Lines with counterpoint ( ) cannot have tilde (~)!**
   
   ⚠️ **CRITICAL RULE SUMMARY - TILDE vs COUNTERPOINT**: 
   - Tilde (~) = Long note/vibrato emphasis
   - Parentheses ( ) = Counterpoint harmony
   - **THESE TWO ARE MUTUALLY EXCLUSIVE ON SAME LINE!**
   - ❌ NEVER: "낡은 사진~ (hold me tight)" ← COUNTERPOINT FAILS!
   - ✅ RIGHT: "낡은 사진 (hold me tight)" ← Works perfectly!
   - Reason: Suno parser cannot handle both on same line

7️⃣ **LITERARY TONE** (No direct emotion words):
   ❌ FORBIDDEN: "슬프다", "보고 싶다", "사랑해", "외로워"
   ✅ REQUIRED: Sensory imagery & metaphors
   - Examples: "차가운 손끝", "흐린 창문", "빈 의자", "시든 꽃잎", "낡은 사진"
   - Use symbols: scales, shadows, rain, empty rooms, fading light
   - Open endings (don't resolve the story)

8️⃣ **INSTRUMENTAL DIRECTIVES** (One per section, English, at section start):
   Format: (brief description of texture/emotion)
   - [Intro]: (Sparse piano, melancholic ostinato)
   - [Verse 1]: (Piano-driven, intimate vocal, minimal strings)
   - [Pre-Chorus]: (Strings swell gently, building tension)
   - [Chorus]: (Full instrumentation, piano ostinato leads)
   - [Instrumental Break]: (Cello answers piano, short and mournful)
   - [Verse 2]: (Piano and strings, vocal more emotional)
   - [Pre-Chorus]: (Orchestra builds, drums enter subtly)
   - [Chorus]: (Strings fuller, bass added, driving rhythm)
   - [Bridge]: (Music strips down, piano and vocal only)
   - [Instrumental Build]: (Orchestra builds, drums enter, rising tension)
   - [Key change up]: (no directive - structural tag only)
   - [Final Chorus]: (Full voice, wide vibrato, sustained high notes)
   - [Outro]: (Piano fades, strings hold final chord, unresolved)
   
   ⚠️ **IMPORTANT**: These directives appear ONLY at section start, NOT within lyrics!

9️⃣ **FORBIDDEN TERMS** (AI misinterprets):
   ❌ Do NOT use: kkeokgi, Korean twist, piri, gayageum, shamisen, dreamy, ambient, ethereal, flowing

🔟 **OUTPUT FORMAT**:
   - Language: Korean (except English ad-libs and section tags)
   - Title: "제목: [Generated Title]"
   - Section tags: [Intro], [Verse 1], [Chorus], etc.
   
   ⚠️⚠️⚠️ **ABSOLUTELY CRITICAL - CLEAN OUTPUT RULES** ⚠️⚠️⚠️
   
   **FORBIDDEN in Korean lyrics:**
   ❌ Syllable counts: (3), (4), (5) → NEVER EVER include these!
   ❌ Delivery notes: [melancholic delivery], [emotional delivery] → These are for YOUR reference only!
   ❌ Any numbers in parentheses after Korean text
   ❌ Any bracketed annotations within lyric lines
   
   **ALLOWED in parentheses:**
   ✅ English ad-libs ONLY: (stay with me), (hold me tight)
   ✅ Harmony directives in [Final Chorus] ONLY: (warm close harmonies), (voices intertwine)
   ✅ Korean ad-libs in [Final Chorus] ONLY: (아~), (오~)
   
   **CORRECT vs WRONG examples:**
   ✅ CORRECT: "식어버린 별~" (long note, no counterpoint)
   ✅ CORRECT: "식어버린 별 (stay with me)" (counterpoint, no tilde)
   ❌ WRONG: "식어버린 별 (3)"
   ❌ WRONG: "[melancholic delivery] 식어버린 별"
   
   ✅ CORRECT: "지체된 계절 (stay with me)" ← No tilde!
   ❌ WRONG: "지체된 계절~ (stay with me)" ← Tilde + counterpoint = BROKEN!
   ❌ WRONG: "지체된 계절 (5) (stay with me)"
   ❌ WRONG: "지체된 계절~(stay with me)" ← Same problem (tilde + counterpoint)

═══════════════════════════════════════════════════════════════
✅ VALIDATION CHECKLIST (before submission):
═══════════════════════════════════════════════════════════════
□ All lines 3-5 syllables (6 max)?
□ Final Chorus 7-8 lines (NOT 9+)?
□ Chorus 1/2/Final have different lyrics (except 1 anchor)?
□ Melody variation techniques applied (syllables/structure/rhythm)?
□ Tildes (~) placed strategically for long notes?
□ Counterpoint **1-2 times per chorus** (not every line!)?
□ Counterpoint on **irregular spacing** (not consecutive)?
□ Final Chorus has 3-layer harmony structure?
□ Ad-libs limited to 2 lines?
□ ⚠️ CRITICAL: Lines with tilde (~) have NO counterpoint ( )?
□ ⚠️ CRITICAL: Lines with counterpoint ( ) have NO tilde (~)?
□ Literary imagery (no direct emotion words)?
${autoChorusVariation ? `
🔥🔥🔥 CHORUS VARIATION ENABLED - CRITICAL 🔥🔥🔥
- Chorus 1, 2, Final MUST have DIFFERENT lyrics
- Keep ONLY 1 anchor line the same
- Vary the other 4-7 lines completely
- This is MANDATORY!
` : ''}
${(sectionVerse || sectionPrechorus || sectionChorus || sectionBridge || sectionFinal || sectionOutro) ? `
🎭🎭🎭 SECTION-BY-SECTION EMOTIONAL DIRECTING 🎭🎭🎭
Apply these emotional directions to INFLUENCE your word choice and phrasing:
${sectionVerse ? `- [Verse]: ${sectionVerse} delivery` : ''}
${sectionPrechorus ? `- [Pre-Chorus]: ${sectionPrechorus} delivery` : ''}
${sectionChorus ? `- [Chorus]: ${sectionChorus} delivery` : ''}
${sectionBridge ? `- [Bridge]: ${sectionBridge} delivery` : ''}
${sectionFinal ? `- [Final Chorus]: ${sectionFinal} delivery` : ''}
${sectionOutro ? `- [Outro]: ${sectionOutro} delivery` : ''}

⚠️ CRITICAL: These are INTERNAL directions for YOUR composition process ONLY!
❌ DO NOT write "[melancholic delivery]" or any delivery notes in the actual output!
✅ Instead, EMBODY these emotions through your word choices and imagery!
` : ''}

═══════════════════════════════════════════════════════════════
🚨🚨🚨 FINAL REMINDER - ABSOLUTELY NO ANNOTATIONS! 🚨🚨🚨
═══════════════════════════════════════════════════════════════

**CRITICALLY IMPORTANT - READ CAREFULLY:**

You are writing FINAL OUTPUT for Suno AI, NOT a draft with notes!
The user will copy-paste your output DIRECTLY into Suno.

**WHAT TO EXCLUDE FROM OUTPUT:**

1. ❌ **NO syllable counts**: (3), (4), (5), (6) anywhere in lyrics
   Example WRONG: "식어버린 별 (3)" ← DELETE THE (3)!
   Example RIGHT: "식어버린 별~"

2. ❌ **NO delivery notes**: [melancholic delivery], [emotional delivery], etc.
   Example WRONG: "[melancholic delivery] 식어버린 별" ← DELETE THE [...]!
   Example RIGHT: Just write the section tag and lyrics

3. ❌ **NO bracketed annotations** within lyric lines
   Example WRONG: "투명한 공기 [breath]" ← DELETE [breath]!

4. ❌ **NO numbers in parentheses** after Korean text
   Only exception: English ad-libs like (stay with me) are allowed

5. 🚨 **CRITICAL: NEVER use tilde (~) and counterpoint ( ) on SAME line!**
   Example WRONG: "빛을 던진다~ (silent echo)" ← COUNTERPOINT BREAKS!
   Example WRONG: "먼지 쌓인 방~ (hold me now)" ← COUNTERPOINT BREAKS!
   Example RIGHT: "빛을 던진다 (silent echo)" ← No tilde!
   Example RIGHT: "먼지 쌓인 방~" ← No counterpoint!
   **REMEMBER: You must CHOOSE - either long note OR counterpoint, NOT BOTH!**

**WHAT TO INCLUDE:**

✅ Section tags: [Intro], [Verse 1], [Chorus], etc.
✅ Instrumental notes at section START: (Piano-driven, intimate vocal)
✅ English ad-libs: (stay with me), (hold me tight)
✅ Harmony directives in Final Chorus: (warm close harmonies)
✅ Korean ad-libs in Final Chorus only: (아-), (오-)

**VISUAL TEMPLATE OF CORRECT OUTPUT:**

[Verse 1]
(Piano-driven, intimate vocal, minimal strings)
식어버린 별~
낡은 조각
투명한 공기~
커튼을 적셔

[Chorus]
(Full instrumentation, piano ostinato leads)
(warm close harmonies)
지체된 계절
먼지 쌓인 방 (hold me now)
얼어붙은
빈 의자 위로 (fading light)
그림자 진다

**BEFORE YOU GENERATE:**
- Double-check: NO (3), (4), (5) anywhere!
- Double-check: NO [delivery] notes in lyrics!
- Only parentheses allowed: English ad-libs & harmony directives!
- Use tilde (~) for long notes: "유리 거울~"
- 🚨 CRITICAL: NEVER use tilde (~) and counterpoint ( ) on same line!
- Example WRONG: "빛을 던진다~ (silent echo)" ← BREAKS COUNTERPOINT!
- Example RIGHT: "빛을 던진다 (silent echo)" ← Works perfectly!

═══════════════════════════════════════════════════════════════

🎵 Generate the complete lyrics now following ALL rules above.
                `;

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
    return res.status(500).json({ error: error.message || '서버 오류 발생!' });
  }
}
