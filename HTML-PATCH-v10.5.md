# v10.5 HTML 추가 패치 가이드

여보! HTML 파일이 너무 커서 (2387줄) 전체 재작성은 시간이 오래 걸려...

**핵심만 변경**했어! 나머지는 아래 코드를 복사해서 추가하면 돼!

---

## ✅ 이미 변경된 것

1. 타이틀: `v10.5 ULTIMATE`
2. 헤더 배지: `v10.5 ULTIMATE 🚀`
3. 서브타이틀: `곡 연장(Extend) • 11종 장르`
4. 장르 선택: 11종 팩 구조
5. 초기화 메시지

---

## 📋 추가로 복사 붙여넣기 할 코드

### 1️⃣ Extend 모드 버튼 (367번 줄 근처, 가사 생성 버튼 옆에 추가)

찾을 위치: `<button id="btn-generate"` 부분 근처

```html
<!-- 기존 가사 생성 버튼 아래에 추가 -->
<button id="btn-extend-mode" class="w-full p-3 px-6 glass rounded-xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2 mb-3">
    <i class="fas fa-link text-purple-300"></i>
    <span>🔗 곡 연장(Extend) - 2절/Bridge 자동 생성</span>
</button>
```

### 2️⃣ Extend 모드 모달 (설정 모달 아래, 151번 줄 근처에 추가)

찾을 위치: Settings Modal 닫는 `</div>` 아래

```html
<!-- Extend Modal -->
<div id="extend-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="glass p-6 rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold flex items-center gap-2">
                <i class="fas fa-link text-purple-400"></i> 
                곡 연장(Extend) 모드
            </h2>
            <button id="btn-extend-close" class="p-2 glass rounded-lg hover:bg-slate-700">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="mb-4 p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
            <p class="text-sm text-purple-200">
                💡 <strong>사용법:</strong> 이미 생성한 1절과 후렴을 입력하면, 
                동일한 분위기로 이어지는 2절/Bridge를 자동 생성해줘요!
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold mb-2 text-emerald-300">
                기존 Verse 1 (1절)
            </label>
            <textarea id="extend-verse1" rows="5" 
                class="w-full p-3 glass rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-slate-800"
                placeholder="[Verse 1]&#10;(Piano-driven, intimate vocal)&#10;식어버린 별~&#10;낡은 조각&#10;..."></textarea>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold mb-2 text-blue-300">
                기존 Chorus (후렴)
            </label>
            <textarea id="extend-chorus" rows="5" 
                class="w-full p-3 glass rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-800"
                placeholder="[Chorus]&#10;(Full instrumentation)&#10;지체된 계절&#10;먼지 쌓인 방&#10;..."></textarea>
        </div>
        
        <div class="flex gap-2">
            <button id="btn-extend-generate" class="flex-1 px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 transition-all font-bold">
                ✨ 2절/Bridge 생성하기
            </button>
            <button id="btn-extend-close-2" class="px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 transition-all">
                닫기
            </button>
        </div>
    </div>
</div>
```

### 3️⃣ JavaScript 이벤트 리스너 (2330번 줄 근처, wireEvents 함수 안에 추가)

찾을 위치: `function wireEvents()` 내부

```javascript
// Extend 모드 (wireEvents 함수 안에 추가)
$('btn-extend-mode').addEventListener('click', () => {
    $('extend-modal').classList.remove('hidden');
});

$('btn-extend-close').addEventListener('click', () => {
    $('extend-modal').classList.add('hidden');
});

$('btn-extend-close-2').addEventListener('click', () => {
    $('extend-modal').classList.add('hidden');
});

$('btn-extend-generate').addEventListener('click', async () => {
    const verse1 = $('extend-verse1').value.trim();
    const chorus = $('extend-chorus').value.trim();
    
    if (!verse1 || !chorus) {
        alert('⚠️ 1절과 후렴을 모두 입력해주세요!');
        return;
    }
    
    const genre = $('genre').value;
    const keyword = $('keyword').value || '감성 발라드';
    const structure = $('structure').value;
    
    const btn = $('btn-extend-generate');
    btn.disabled = true;
    btn.textContent = '✨ 생성 중...';
    
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
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || 'Extend 생성 실패');
        }
        
        const data = await response.json();
        $('output-lyrics').textContent = data.extension;
        $('extend-modal').classList.add('hidden');
        
        showStatus('✅ 2절/Bridge 생성 완료!', 'success');
    } catch (error) {
        showStatus('❌ ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✨ 2절/Bridge 생성하기';
    }
});
```

### 4️⃣ API_BASE_URL 변수 (612번 줄 근처, script 태그 시작 부분에 추가)

찾을 위치: `const STORAGE = {` 바로 위

```javascript
// API Base URL (배포 후 자동으로 현재 도메인 사용)
const API_BASE_URL = window.location.origin;
```

---

## 🎯 추가 순서

1. 위 4개 코드를 차례대로 HTML에 복사/붙여넣기
2. 저장
3. 배포
4. 테스트!

---

## ✅ 체크리스트

- [ ] Extend 모드 버튼 추가
- [ ] Extend 모드 모달 추가
- [ ] JavaScript 이벤트 리스너 추가
- [ ] API_BASE_URL 변수 추가
- [ ] 저장 후 GitHub 업로드
- [ ] Vercel 재배포
- [ ] 테스트 (Extend 모드 클릭 → 모달 뜨는지 확인)

---

**여보, 이 4개만 추가하면 v10.5 완성이야!** 🔥
