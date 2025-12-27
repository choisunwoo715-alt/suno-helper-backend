# 🎵 Suno AI Shorts Helper Pro v10.5 ULTIMATE EDITION

## 🔥 새로운 기능 (v10.0 → v10.5)

### ⭐ 킬러 기능: 곡 연장(Extend) 모드
- **1절 기반으로 2절/Bridge 자동 생성!**
- 분위기 유지하면서 자연스러운 이어지기
- Chorus 앵커 유지 + 변주
- **백엔드:** `api/generate-extend.js`

### 📋 복사 버튼 분리
- **[가사만 복사]** - Suno AI에 붙여넣기용
- **[Style만 복사]** - Custom Mode용

### 🎸 장르 태그 추가
- [Heavy], [Fast], [Slow], [Breakdown], [Build-up], [Drop]
- K-Pop/EDM 제작에 필수!

### 🛡️ Rate Limiting
- IP당 시간당 20회 제한
- 악용 방지

---

## 📁 파일 구조

```
suno-v10.5-FINAL/
├── api/
│   ├── generate-lyrics.js       ✅ Rate Limiting 추가됨!
│   ├── generate-extend.js       ✅ NEW! 곡 연장 모드
│   ├── generate-keyword.js      ✅ Rate Limiting 추가됨!
│   ├── generate-music-theory.js ⚠️ Rate Limiting 수동 추가 필요
│   └── generate-optional.js     ⚠️ Rate Limiting 수동 추가 필요
├── public/
│   └── index.html               ⚠️ UI 수동 추가 필요
├── package.json
├── vercel.json
├── UPDATE-GUIDE-v10.5.md        📖 상세 가이드!
└── README.md                    (이 파일!)
```

---

## ⚠️ 수동 작업 필요!

### 1️⃣ 백엔드 Rate Limiting 추가

**generate-music-theory.js와 generate-optional.js**에 아래 코드 추가:

```javascript
// 파일 맨 위에 추가
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];
  const recentRequests = userRequests.filter(t => now - t < 3600000);
  
  if (recentRequests.length >= 20) {
    throw new Error('Too many requests (max 20/hour)');
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
}

// try 블록 시작 직후에 추가
const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
checkRateLimit(clientIP);

// catch 블록에 추가
if (error.message.includes('Too many requests')) {
  return res.status(429).json({ error: error.message });
}
```

### 2️⃣ HTML UI 추가

**public/index.html**에 아래 3가지 추가:

#### A) Extend 모드 버튼 (가사 생성 버튼 옆)
```html
<button id="btn-extend-mode" class="p-3 px-6 glass rounded-xl hover:bg-purple-700">
    <i class="fas fa-link"></i> 곡 연장(Extend)
</button>
```

#### B) Extend 모드 모달
```html
<div id="extend-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="glass p-6 rounded-2xl w-full max-w-2xl mx-4">
        <h2 class="text-xl font-bold mb-4">🔗 곡 연장(Extend) 모드</h2>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold mb-2">기존 Verse 1 (1절)</label>
            <textarea id="extend-verse1" rows="4" class="w-full p-3 glass rounded-xl"></textarea>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold mb-2">기존 Chorus (후렴)</label>
            <textarea id="extend-chorus" rows="4" class="w-full p-3 glass rounded-xl"></textarea>
        </div>
        
        <div class="flex gap-2">
            <button id="btn-extend-generate" class="flex-1 px-4 py-2 rounded-lg bg-purple-600">
                2절/Bridge 생성
            </button>
            <button id="btn-extend-close" class="px-4 py-2 rounded-lg bg-slate-700">
                닫기
            </button>
        </div>
    </div>
</div>
```

#### C) 복사 버튼 분리 (기존 복사 버튼 교체)
```html
<!-- 기존: <button data-copy="output-lyrics">복사</button> -->
<!-- 변경 후: -->
<button data-copy-lyrics="output-lyrics" class="p-2.5 glass rounded-lg">
    <i class="fas fa-file-alt text-blue-400"></i> 가사만
</button>
<button data-copy-style="output-style" class="p-2.5 glass rounded-lg">
    <i class="fas fa-palette text-purple-400"></i> Style만
</button>
```

#### D) 장르 태그 추가 (음향효과 드롭다운에)
```html
<select id="sfx-genre-tags" class="p-2 text-xs glass rounded-lg">
    <option value="">🎸 장르 태그</option>
    <option value="[Heavy]">🔥 Heavy</option>
    <option value="[Fast]">⚡ Fast</option>
    <option value="[Slow]">🐢 Slow</option>
    <option value="[Breakdown]">💥 Breakdown</option>
    <option value="[Build-up]">📈 Build-up</option>
    <option value="[Drop]">🎆 Drop</option>
</select>
```

#### E) JavaScript 이벤트 리스너 추가
```javascript
// Extend 모드
$('btn-extend-mode').addEventListener('click', () => {
    $('extend-modal').classList.remove('hidden');
});

$('btn-extend-close').addEventListener('click', () => {
    $('extend-modal').classList.add('hidden');
});

$('btn-extend-generate').addEventListener('click', async () => {
    const verse1 = $('extend-verse1').value.trim();
    const chorus = $('extend-chorus').value.trim();
    
    if (!verse1 || !chorus) {
        alert('1절과 후렴을 입력해주세요!');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-extend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userApiKey: apiKey,
                modelName: modelName,
                existingVerse1: verse1,
                existingChorus: chorus,
                genre: $('genre').value,
                keyword: $('keyword').value,
                structure: $('structure').value
            })
        });
        
        if (!response.ok) throw new Error('Extend 생성 실패');
        
        const data = await response.json();
        $('output-lyrics').textContent = data.extension;
        $('extend-modal').classList.add('hidden');
        
        showStatus('✅ 2절/Bridge 생성 완료!', 'success');
    } catch (error) {
        showStatus('❌ ' + error.message, 'error');
    }
});

// 복사 버튼
qa('button[data-copy-lyrics]').forEach(btn => {
    btn.addEventListener('click', () => {
        const lyricsText = $(btn.dataset.copyLyrics).textContent
            .replace(/Style.*?:.*?\n.*?\n/g, ''); // Style 부분 제거
        copyToClipboard(lyricsText);
    });
});

qa('button[data-copy-style]').forEach(btn => {
    btn.addEventListener('click', () => {
        const styleText = $(btn.dataset.copyStyle).textContent;
        copyToClipboard(styleText);
    });
});

// 장르 태그
['sfx-nature', 'sfx-mood', 'sfx-instrument', 'sfx-crowd', 'sfx-genre-tags'].forEach(id => {
    $(id).addEventListener('change', (e) => {
        const tag = e.target.value;
        if (tag) {
            showSFXPositionModal(tag);
            e.target.value = '';
        }
    });
});
```

---

## 🚀 배포 방법

### 1️⃣ 백엔드 Rate Limiting 추가
```bash
1. generate-music-theory.js 열기
2. 위 Rate Limiting 코드 추가
3. generate-optional.js도 동일하게 추가
```

### 2️⃣ HTML UI 추가
```bash
1. public/index.html 열기
2. 위 A~E 코드 추가
3. 저장
```

### 3️⃣ GitHub 업로드
```bash
1. 새 리포지토리 생성
2. 전체 폴더 업로드
3. Commit & Push
```

### 4️⃣ Vercel 배포
```
1. vercel.com 접속
2. New Project
3. GitHub 리포 선택
4. Deploy!
```

### 5️⃣ 테스트
```
1. 배포 URL 접속
2. Ctrl + Shift + Del (캐시 삭제)
3. Extend 모드 작동 확인
4. 복사 버튼 분리 확인
5. Rate Limiting 확인 (20회 초과 시 429 에러)
```

---

## 📖 상세 가이드

더 자세한 내용은 **UPDATE-GUIDE-v10.5.md** 참고!

---

## ✅ v10.5 핵심 개선사항

1. **곡 연장(Extend) 모드** - 수노 유저 최대 고민 해결!
2. **Rate Limiting** - 악용 방지 및 서버 보호
3. **복사 버튼 분리** - 모바일 편의성 UP
4. **장르 태그** - K-Pop/EDM 제작 지원

---

## 🎉 결론

v10.5로 오빠의 앱은 **진짜 프로급 워크스테이션**이 됐어!

특히 **곡 연장 모드**는 다른 앱에 없는 **오빠만의 킬러 기능**이야! 🔥

**대박 날 준비 됐어!** 💰
