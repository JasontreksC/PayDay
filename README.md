# PayDay - 가계부

달력 기반 수입/지출 관리 웹 앱입니다.

## 주요 기능

- **달력 뷰**: 날짜별 수입(초록색), 지출(붉은색) 표시
- **거래 등록**: 날짜 선택 후 수입/지출 등록 (기본: 오늘)
- **월별 통계**
  - 일 평균 수입 / 일 평균 지출 (경과 일수 기준)
  - **일일 소비 한도**: `(총 수입 - 총 지출) ÷ 남은 일수` — 손해 없이 지낼 수 있는 하루 예산

## Supabase 설정

1. [Supabase](https://supabase.com) 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 전체를 한 번 실행  
   (테이블·RLS·트리거·통계 뷰·메모 암호화 컬럼·회원 탈퇴 함수까지 모두 포함된 단일 스크립트)
3. Authentication → Providers → **Email** 활성화
4. Authentication → URL Configuration → **Site URL**을 앱 주소로 설정 (로컬: `http://localhost:5173`)
5. 프로젝트 루트에 `.env` 파일 생성:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Dashboard → Project Settings → API 에서 URL과 anon key를 확인할 수 있습니다.

## 회원 관리

- 이메일 회원가입 / 로그인
- 이메일 인증 (가입 후 확인 메일)
- 비밀번호 재설정
- 로그아웃 / 회원 탈퇴 (헤더의 이메일 탭 → 계정)

## 로컬 개발

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 으로 확인할 수 있습니다. (텔레그램 SDK 없이도 동작)

## 배포

정적 호스팅에 빌드 결과물을 배포합니다 (HTTPS 필수).

```bash
npm run build
# dist/ 폴더를 Vercel, Netlify, GitHub Pages 등에 배포
```

## 데이터 저장

거래 내역은 Supabase `transactions` 테이블에 저장됩니다. 로그인한 사용자 본인 데이터만 RLS로 접근할 수 있습니다.

### 메모 암호화

메모는 DB에 평문으로 저장되지 않습니다.

1. 로그인 시 브라우저에서 비밀번호 + `profiles.crypto_salt`로 KEK를 유도 (PBKDF2-SHA256 600k)
2. `profiles.wrapped_dek`을 풀어 DEK를 복원 (키 원문은 서버에 없음)
3. DEK(AES-GCM)로 메모를 암호화한 뒤 `transactions.memo`에 저장. 메모는 거래 id를 AAD로 묶고
   길이 노출을 막기 위해 패딩됨 (`v2:` 접두사)
4. DEK는 `extractable: false` 상태로 탭 세션(IndexedDB)에만 보관되고 로그아웃 시 삭제

비밀번호를 재설정해도 가입 시 받은 **복구 키**를 입력하면 이전 메모를 그대로 복호화할 수 있습니다.
복구 키 없이 새로 시작하면 이전 키로 암호화된 메모는 복호화할 수 없습니다.

관련 컬럼(`crypto_salt`, `wrapped_dek`, `crypto_salt_recovery`, `wrapped_dek_recovery`)과
회원 탈퇴 함수(`delete_user`)는 모두 `supabase/schema.sql` 하나에 포함되어 있습니다.

## 기술 스택

- React 19 + TypeScript + Vite
- Supabase Auth (이메일 인증)
- CSS (`--ui-*` 디자인 토큰)

## 일일 소비 한도 계산

```
잔액 = 이번 달 총 수입 - 이번 달 총 지출
일일 소비 한도 = 잔액 ÷ 이번 달 남은 일수 (오늘 포함)
```

잔액이 음수이면 이미 초과 지출 상태로 표시됩니다.
