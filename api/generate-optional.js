// =====================================================
// Optional Content Generation API v11.0
// (Translation, Marketing, Video, Art) + Rate Limiting!
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

module.exports = async (req, res) => {
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

    const { userApiKey, modelName, keyword, genre, type } = req.body;

    if (!userApiKey || !keyword || !type) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    let prompt = '';

    if (type === 'translation') {
      prompt = `Generate ENGLISH lyrics for ${genre} song based on "${keyword}".
Keep structure tags, vary choruses, keep 1 anchor line.
Output ONLY English lyrics.`;
    } else if (type === 'marketing') {
      prompt = `Create SNS Marketing Pack for Korean ${genre} song "${keyword}".
Include: 3 titles, description, 15-20 hashtags, viral challenge idea.`;
    } else if (type === 'video') {
      prompt = `Create cinematic video prompt for Google Veo (9:16 YouTube Shorts).

Theme: ${keyword}
Mood: ${genre} ballad

First 3 seconds must grab attention.
Output: 1-2 paragraphs.`;
    } else if (type === 'art') {
      prompt = `Create AI Image Generator prompt.

Subject: Album Cover for ${genre} song "${keyword}"
NO text, NO letters, NO faces (silhouette ok).
Output: one copy-paste ready prompt.`;
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const model = modelName || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userApiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, topK: 40, topP: 0.95, maxOutputTokens: 4096 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Generation failed';

    return res.status(200).json({ result });

  } catch (error) {
    console.error('Error:', error);
    
    if (error.message.includes('Too many requests')) {
      return res.status(429).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message });
  }
}
