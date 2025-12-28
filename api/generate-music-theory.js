// =====================================================
// Music Theory Generation API v11.0
// Rate Limiting 추가!
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

    const { userApiKey, modelName, keyword, genre, emotionIntensity } = req.body;

    if (!userApiKey || !keyword) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const musicTheoryPrompt = `You are a professional music producer.

Song: "${keyword}"
Genre: ${genre}
Emotion: ${emotionIntensity}%

Provide:
BPM: one exact number
Key: one exact key
Chord Progression: 4 chords
Tags: "[BPM] BPM, [Key] key, [Progression]"
Reasoning: brief`;

    const model = modelName || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userApiKey}`;

    const payload = {
      contents: [{ parts: [{ text: musicTheoryPrompt }] }],
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
