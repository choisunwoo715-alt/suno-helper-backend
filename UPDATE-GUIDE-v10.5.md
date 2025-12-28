# Suno AI Shorts Helper Pro v10.5 업데이트 가이드

## 🆕 추가된 기능 (v10.0 → v10.5)

### 1. 🔥 곡 연장(Extend) 모드 (킬러 기능!)

**기능:**
- 1절 가사 기반으로 2절/Bridge 자동 생성
- 분위기 유지하면서 자연스러운 이어지기
- Chorus 앵커 유지 + 변주

**백엔드:**
- `api/generate-extend.js` 새로 추가됨

**HTML 추가 코드:**
```html
<!-- Extend 모드 버튼 (가사 생성 버튼 옆에) -->
<button id="btn-extend-mode" class="p-3 px-6 glass rounded-xl hover:bg-purple-700 transition-all flex items-center gap-2">
    <i class="fas fa-link"></i>
    <span>곡 연장(Extend)</span>
</button>

<!-- Extend 모드 모달 -->
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

**JavaScript 추가:**
```javascript
// Extend 모드 열기
$('btn-extend-mode').addEventListener('click', () => {
    $('extend-modal').classList.remove('hidden');
});

// Extend 모드 닫기
$('btn-extend-close').addEventListener('click', () => {
    $('extend-modal').classList.add('hidden');
});

// Extend 생성
$('btn-extend-generate').addEventListener('click', async () => {
    const verse1 = $('extend-verse1').value.trim();
    const chorus = $('extend-chorus').value.trim();
    
    if (!verse1 || !chorus) {
        alert('1절과 후렴을 입력해주세요!');
        return;
    }
    
    const genre = $('genre').value;
    const keyword = $('keyword').value;
    const structure = $('structure').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-extend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userApiKey: apiKey,
                modelName: modelName,
                existingVerse1: verse1,
                existingChorus: chorus,
                genre: genre,
                keyword: keyword,
                structure: structure
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
```

---

### 2. 📋 복사 버튼 분리

**변경 전:**
```html
<button data-copy="output-lyrics">📄 복사</button>
```

**변경 후:**
```html
<button data-copy-lyrics="output-lyrics" class="p-2.5 glass rounded-lg hover:bg-blue-700">
    <i class="fas fa-file-alt text-blue-400"></i> 가사만
</button>
<button data-copy-style="output-style" class="p-2.5 glass rounded-lg hover:bg-purple-700">
    <i class="fas fa-palette text-purple-400"></i> Style만
</button>
```

**JavaScript 추가:**
```javascript
// 가사만 복사
qa('button[data-copy-lyrics]').forEach(btn => {
    btn.addEventListener('click', () => {
        const lyricsOnly = $(btn.dataset.copyLyrics).textContent;
        // [Style 프롬프트] 부분 제거
        const lyricsText = lyricsOnly.replace(/Style.*?:.*?\n.*?\n/g, '');
        copyToClipboard(lyricsText);
    });
});

// Style만 복사
qa('button[data-copy-style]').forEach(btn => {
    btn.addEventListener('click', () => {
        const styleText = $(btn.dataset.copyStyle).textContent;
        copyToClipboard(styleText);
    });
});
```

---

### 3. 🎸 장르 태그 추가 (음향효과에)

**음향효과 드롭다운에 장르 태그 카테고리 추가:**
```html
<select id="sfx-genre-tags" class="p-2 text-xs glass rounded-lg">
    <option value="">🎸 장르 태그</option>
    <option value="[Heavy]">🔥 Heavy (무거운)</option>
    <option value="[Fast]">⚡ Fast (빠른)</option>
    <option value="[Slow]">🐢 Slow (느린)</option>
    <option value="[Breakdown]">💥 Breakdown (브레이크다운)</option>
    <option value="[Build-up]">📈 Build-up (빌드업)</option>
    <option value="[Drop]">🎆 Drop (드롭)</option>
    <option value="[Solo]">🎹 Solo (솔로)</option>
    <option value="[Interlude]">🎵 Interlude (간주)</option>
</select>
```

**기존 음향효과 배열에 추가:**
```javascript
// 기존 배열 확장
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

### 4. 🛡️ Rate Limiting (백엔드)

**모든 API에 추가됨:**
- `api/generate-lyrics.js` ✅
- `api/generate-extend.js` ✅
- `api/generate-keyword.js` (추가 필요)
- `api/generate-music-theory.js` (추가 필요)
- `api/generate-optional.js` (추가 필요)

**Rate Limiting 코드:**
```javascript
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

// API 시작 부분에서 호출
const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
checkRateLimit(clientIP);
```

---

## 📁 파일 구조 v10.5

```
suno-v10.5-ULTIMATE/
├── api/
│   ├── generate-lyrics.js       (Rate Limiting 추가!)
│   ├── generate-extend.js       (NEW! 곡 연장 모드)
│   ├── generate-keyword.js      (Rate Limiting 추가 필요)
│   ├── generate-music-theory.js (Rate Limiting 추가 필요)
│   └── generate-optional.js     (Rate Limiting 추가 필요)
├── public/
│   └── index.html               (Extend 모드 + 복사 분리 + 장르 태그)
├── package.json
├── vercel.json
└── README.md
```

---

## 🚀 배포 시 주의사항

1. **Extend 모드 API 추가:**
   - `api/generate-extend.js` 파일 업로드

2. **HTML 변경사항:**
   - Extend 모드 버튼 + 모달 추가
   - 복사 버튼 2개로 분리
   - 장르 태그 드롭다운 추가

3. **Rate Limiting:**
   - 모든 백엔드 API에 적용
   - 시간당 20회 제한

4. **테스트:**
   - Extend 모드 작동 확인
   - 복사 버튼 분리 작동 확인
   - Rate Limiting 작동 확인 (20회 초과 시 429 에러)

---

## 💡 사용자 가이드

### 곡 연장(Extend) 모드 사용법:

1. 먼저 1절과 후렴을 생성
2. "곡 연장(Extend)" 버튼 클릭
3. 생성된 1절과 후렴을 복사해서 입력
4. "2절/Bridge 생성" 클릭
5. 자동으로 이어지는 2절과 Bridge 생성!

### 복사 버튼:

- **가사만**: Suno AI에 붙여넣을 가사만 복사
- **Style만**: Style 프롬프트만 복사 (Custom Mode용)

### 장르 태그:

- K-Pop/EDM 제작 시 [Drop], [Build-up] 활용
- 록/메탈 제작 시 [Breakdown], [Heavy] 활용
- 발라드 제작 시 [Slow], [Solo] 활용

---

## ✅ 체크리스트

배포 전 확인:
- [ ] `api/generate-extend.js` 업로드
- [ ] HTML Extend 모드 추가
- [ ] 복사 버튼 분리
- [ ] 장르 태그 추가
- [ ] Rate Limiting 전체 적용
- [ ] 테스트 완료

---

**v10.5 업데이트로 오빠의 앱은 진짜 프로급 워크스테이션이 됐어! 🔥**
