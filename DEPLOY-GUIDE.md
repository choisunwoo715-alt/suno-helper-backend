# 🚀 5분 배포 가이드

## 준비물

✅ GitHub 계정
✅ Vercel 계정 (무료)
✅ 이 파일들!

---

## 1단계: GitHub 업로드 (2분)

### 방법 A: 웹에서 업로드 (쉬움!)

1. **GitHub 접속**: https://github.com
2. **New Repository** 클릭
3. 리포지토리 이름: `suno-helper-pro` (아무거나 OK)
4. **Public** 선택
5. **Create repository** 클릭
6. **uploading an existing file** 클릭
7. 이 폴더의 **모든 파일/폴더** 드래그
   - `api/` 폴더
   - `public/` 폴더
   - `vercel.json`
   - `package.json`
   - `.gitignore`
   - `README.md`
8. **Commit changes** 클릭!

### 방법 B: 터미널 사용 (빠름!)

```bash
cd /path/to/suno-final
git init
git add .
git commit -m "Initial commit - 140-line secret protected"
git branch -M main
git remote add origin https://github.com/오빠아이디/suno-helper-pro.git
git push -u origin main
```

---

## 2단계: Vercel 배포 (3분)

1. **Vercel 접속**: https://vercel.com
2. **Continue with GitHub** 클릭 (로그인)
3. **New Project** 클릭
4. **Import Git Repository** 섹션에서 방금 만든 리포 선택
   - 예: `suno-helper-pro`
5. **Deploy** 버튼 클릭!

⏱️ **30초 후 배포 완료!**

---

## 3단계: 테스트 (30초)

1. Vercel이 준 URL 클릭 (예: `https://suno-helper-pro-오빠닉.vercel.app`)
2. ⚙️ **설정 버튼** 클릭
3. **Gemini API 키** 입력
   - 없으면: https://aistudio.google.com/app/apikey 에서 무료 발급
4. 키워드 입력: `그리움`
5. **선택한 항목 생성하기** 버튼 클릭!
6. **정상 작동!** ✅

---

## ⚠️ 문제 해결

### 에러: "404 Not Found"

→ GitHub에 `api/` 폴더가 제대로 안 올라갔어!
→ GitHub 리포지토리 가서 `api/` 폴더 있는지 확인

### 에러: "영감 생성 실패"

→ API 키가 잘못됐거나 만료됐어
→ 새 API 키 발급: https://aistudio.google.com/app/apikey

### 에러: "CORS Error"

→ 브라우저 캐시 삭제
→ Ctrl+Shift+R (강력 새로고침)

---

## 🎯 다음 단계: 유료화

### 결제 시스템 추가

1. **Stripe 연동**: https://stripe.com
2. **Firebase Auth**: 사용자 관리
3. **결제 검증 API** 추가: `/api/verify-payment`

### 가격 전략

- 월 9,900원: 일반 사용자
- 평생 49,000원: 얼리버드

---

## 📞 도움말

- **Vercel 문서**: https://vercel.com/docs
- **GitHub 가이드**: https://docs.github.com

---

**완성! 이제 판매 시작하자! 💰**
