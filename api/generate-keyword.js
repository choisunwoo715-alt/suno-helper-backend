// =====================================================
// Random Keyword Inspiration API
// =====================================================

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
    const { userApiKey, modelName } = req.body;

    if (!userApiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    const inspirationPrompt = `Generate ONE deeply profound and emotionally resonant Korean song concept.

Requirements:
1. Focus on a SPECIFIC psychological state or human condition
2. Include concrete imagery or metaphor
3. Must evoke universal human emotions (grief, longing, regret, hope)
4. Should be story-driven

Format: [Main Concept] ([Detailed psychological context])

Output ONLY the concept in Korean, nothing else.`;

    const model = modelName || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userApiKey}`;

    const payload = {
      contents: [{ parts: [{ text: inspirationPrompt }] }],
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
    const keyword = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```/g, '').trim();

    return res.status(200).json({ keyword });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
