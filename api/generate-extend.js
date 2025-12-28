// =====================================================
// Suno AI Extend Mode API v10.5
// 1절 기반으로 2절/Bridge 자동 생성!
// =====================================================

const rateLimitMap = new Map();

// Rate Limiting 함수
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

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Rate Limiting
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    checkRateLimit(clientIP);

    const {
      userApiKey,
      modelName,
      existingVerse1,
      existingChorus,
      genre,
      keyword,
      structure
    } = req.body;

    if (!userApiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    if (!existingVerse1 || !existingChorus) {
      return res.status(400).json({ error: 'Existing Verse 1 and Chorus required' });
    }

    // 프롬프트 생성
    const extendPrompt = `
You are "Suno AI Extend Master" - expert at continuing Korean ballad songs.

═══════════════════════════════════════════════════════════════
🎯 MISSION: Generate Verse 2 and Bridge that naturally continue from Verse 1
Genre: ${genre || 'Korean Ballad'}
Theme: ${keyword || 'emotional continuation'}
Structure: ${structure || 'standard'}
═══════════════════════════════════════════════════════════════

📋 EXISTING SONG (User provided):

**[Verse 1]**
${existingVerse1}

**[Chorus]**
${existingChorus}

═══════════════════════════════════════════════════════════════

🎯 YOUR TASK:

Generate **ONLY** the following sections:

1. **[Verse 2]** - 4 lines
   - Must match the TONE and ATMOSPHERE of Verse 1
   - Different words/imagery, but same emotional depth
   - Same syllable pattern as Verse 1 (3-5 syllables per line)
   - Continue the story or deepen the emotion

2. **[Pre-Chorus]** - 2 lines (if Verse 1 had one)
   - Build tension for the second chorus
   - 3-4 syllables per line

3. **[Chorus]** - 5-6 lines (VARIATION of existing chorus!)
   - Keep **ONE anchor line** the same as the original chorus
   - Change **ALL OTHER LINES** with new imagery
   - Example:
     * Original Chorus: "입술은 웃고 / 눈은 젖어 가 / 너 없는 식탁 / 혼자 남은 죄"
     * Chorus 2: "입술은 웃고 (SAME) / 손이 텅 비어 가 (NEW!) / 차가운 그릇만 (NEW!) / 하나 남은 밤 (NEW!)"

4. **[Bridge]** - 4 lines
   - SHIFT the perspective or add a new emotional layer
   - Different from Verse 1/2, more introspective or climactic
   - 3-5 syllables per line
   - This is the emotional turning point!

═══════════════════════════════════════════════════════════════

📋 CRITICAL RULES:

1️⃣ **MAINTAIN CONSISTENCY**:
   - Match the literary style of Verse 1
   - If Verse 1 uses metaphors → Verse 2 uses metaphors
   - If Verse 1 is sensory → Verse 2 is sensory
   - Same level of vocabulary sophistication

2️⃣ **SYLLABLE RULE** (STRICT!):
   - Verse 2: **3-5 syllables per line** (same as Verse 1!)
   - Pre-Chorus: **3-4 syllables per line**
   - Chorus: **3-5 syllables per line**
   - Bridge: **3-5 syllables per line**
   - Exceeding 6 syllables = FAILURE

3️⃣ **CHORUS VARIATION** (MANDATORY!):
   - Pick 1 anchor line from the original chorus
   - Change ALL other lines with different imagery
   - Keep the same emotional intensity
   - Example transformations:
     * "눈은 젖어 가" → "손이 텅 비어 가" (body part variation)
     * "너 없는 식탁" → "차가운 그릇만" (object variation)

4️⃣ **BRIDGE REQUIREMENTS**:
   - Must feel like a SHIFT or REVELATION
   - Different imagery than Verse 1/2
   - Often more abstract or philosophical
   - Sets up the Final Chorus climax

5️⃣ **TILDE (~) USAGE**:
   - Use ~ for long notes (same pattern as Verse 1)
   - Place after open vowels (아/오/우/으) or soft consonants (ㄹ/ㅇ)
   - Examples: "떨려~", "돌아~", "차가워~"

6️⃣ **NO COUNTERPOINT** in these sections:
   - Verse 2 and Bridge should be clean lyrics only
   - Save English ad-libs for Final Chorus

7️⃣ **INSTRUMENTAL DIRECTIVES** (include these!):
   - [Verse 2]: (Piano and strings, vocal more emotional)
   - [Pre-Chorus]: (Orchestra builds, drums enter subtly)
   - [Chorus]: (Strings fuller, bass added, driving rhythm)
   - [Bridge]: (Music strips down, piano and vocal only)

8️⃣ **OUTPUT FORMAT**:
   - Section tags: [Verse 2], [Pre-Chorus], [Chorus], [Bridge]
   - Instrumental directives at section start
   - NO syllable counts (3), (4) in output!
   - NO delivery notes [emotional delivery] in output!

═══════════════════════════════════════════════════════════════

✅ QUALITY CHECKLIST:

Before you generate, ensure:
□ Verse 2 matches Verse 1's tone and style?
□ All lines 3-5 syllables (6 max)?
□ Chorus has 1 anchor line + new variations?
□ Bridge provides emotional shift?
□ Tildes (~) used appropriately?
□ Instrumental directives included?
□ Clean output (no annotations)?

═══════════════════════════════════════════════════════════════

🎵 Generate ONLY [Verse 2], [Pre-Chorus], [Chorus], and [Bridge] now!

DO NOT regenerate Verse 1 or Intro. Only the continuation!
    `;

    // Gemini API 호출
    const model = modelName || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userApiKey}`;

    const payload = {
      contents: [{ parts: [{ text: extendPrompt }] }],
      generationConfig: { temperature: 0.85, topK: 40, topP: 0.95, maxOutputTokens: 2048 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Gemini API Error: ${response.status} - ${errorData?.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    const extension = data?.candidates?.[0]?.content?.parts?.[0]?.text || '생성 실패';

    return res.status(200).json({ extension });

  } catch (error) {
    console.error('Extend API Error:', error);
    
    if (error.message.includes('Too many requests')) {
      return res.status(429).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};
