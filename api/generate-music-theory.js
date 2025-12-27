// =====================================================
// Music Theory Generation API
// =====================================================

export default async function handler(req, res) {
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
    return res.status(500).json({ error: error.message });
  }
}
