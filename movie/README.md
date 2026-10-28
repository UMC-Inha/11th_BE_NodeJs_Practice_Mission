# 5주차 — 영화 평점 서비스 (NestJS 새 프로젝트)

3~4주차 도서 대여 프로젝트(레포 루트)는 그대로 두고, 워크북대로 `nest new movie`로 새 프로젝트를 만들었다.
영화 정보는 프론트가 TMDB에서 직접 받고, 이 서버는 회원·평점(이후 즐겨찾기)만 맡는다.

## 실행

```bash
cd movie
npm ci
cp .env.example .env        # DB 비밀번호 채우기 (.env 는 Git 제외)
mysql -u root -p < sql/schema.sql   # umc_movie DB + member/rating/favorite
mysql -u root -p < sql/seed.sql     # 수현·민서, TMDB 영화 550·155 평점
npm run start:dev           # http://localhost:3000
```

## API

| API | Method | URL | 성공 응답 |
|---|---|---|---|
| 닉네임 중복 체크 | GET | `/members/nickname/{nickname}` | `{ "available": true }` |
| 이메일 중복 체크 | GET | `/members/email/{email}` | `{ "available": true }` |
| 유저별 평점 조회 | GET | `/members/{memberId}/ratings` | `[{ ratingId, movieId, score, comment, createdAt, updatedAt }]` (ratingId 최신순) |

- 없는 회원 → 404, 숫자가 아닌 memberId → 400
- (선택) 닉네임 2~12자, 이메일 형식이 틀리면 중복 확인 전에 400
- (선택) `?page=0&size=10` 을 주면 잘라서 응답, 둘 다 없으면 명세대로 전체. size 1~50
- BIGINT ID는 숫자로 응답한다(`bigNumberStrings: false`). 회원·평점 ID와 TMDB 영화 ID는 2^53보다 훨씬 작다.

## CORS

`main.ts` → `app.setup.ts`의 `app.enableCors({ origin: CORS_ORIGINS })`. 기본값은 `http://localhost:5173` 하나.
`CORS_ORIGINS=*` 는 비교 실험용이다.

- CORS 설정 전 재현: `npm run build && node --env-file=.env scripts/start-without-cors.mjs`
- 간이 프론트: 레포 루트 `mock-frontend/` 에서 `npx serve -l 5173`

## 검증

```bash
npm run build && npm test && npm run test:e2e && npm run lint
node --env-file=.env scripts/verify-week05.mjs          # 실제 DB 18개 요청 → evidence/week05-api-results.json
npx newman run evidence/week05.postman_collection.json  # Postman Collection 11개 요청·14개 assertion
```

`test:e2e` 와 `verify-week05` 는 실제 로컬 MySQL(umc_movie, 시드 데이터)에 조회만 한다.
