# PayDay - 텔레그램 미니 앱 가계부

달력 기반 수입/지출 관리 텔레그램 Mini App입니다.

## 주요 기능

- **달력 뷰**: 날짜별 수입(초록색), 지출(붉은색) 표시
- **거래 등록**: 날짜 선택 후 수입/지출 등록 (기본: 오늘)
- **월별 통계**
  - 일 평균 수입 / 일 평균 지출 (경과 일수 기준)
  - **일일 소비 한도**: `(총 수입 - 총 지출) ÷ 남은 일수` — 손해 없이 지낼 수 있는 하루 예산

## 로컬 개발

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 으로 확인할 수 있습니다. (텔레그램 SDK 없이도 동작)

## 텔레그램 봇 연동

### 1. BotFather에서 봇 생성

1. [@BotFather](https://t.me/BotFather) 에서 `/newbot` 으로 봇 생성
2. `/newapp` 으로 Mini App 생성 후 Web App URL 설정

### 2. 앱 배포

정적 호스팅에 빌드 결과물을 배포합니다 (HTTPS 필수).

```bash
npm run build
# dist/ 폴더를 Vercel, Netlify, GitHub Pages 등에 배포
```

### 3. Mini App URL 등록

BotFather에서 설정한 HTTPS URL을 Web App URL로 등록합니다.

예: `https://your-domain.com`

### 4. 봇 메뉴 버튼 (선택)

BotFather `/mybots` → 봇 선택 → Bot Settings → Menu Button → Configure menu button

## 데이터 저장

현재는 브라우저 `localStorage`에 저장됩니다. 기기/브라우저별로 데이터가 유지됩니다.

## 기술 스택

- React 19 + TypeScript + Vite
- [@twa-dev/sdk](https://github.com/twa-dev/sdk) — Telegram Web App SDK
- CSS (Telegram 테마 변수 연동)

## 일일 소비 한도 계산

```
잔액 = 이번 달 총 수입 - 이번 달 총 지출
일일 소비 한도 = 잔액 ÷ 이번 달 남은 일수 (오늘 포함)
```

잔액이 음수이면 이미 초과 지출 상태로 표시됩니다.
