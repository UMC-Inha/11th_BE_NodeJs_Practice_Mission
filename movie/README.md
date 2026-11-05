# 5~6주차 — 영화 평점 서비스 (NestJS 새 프로젝트)

3~4주차 도서 대여 프로젝트(레포 루트)는 그대로 두고, 워크북대로 `nest new movie`로 새 프로젝트를 만들었다.
영화 정보는 프론트가 TMDB에서 직접 받고, 이 서버는 회원·평점(이후 즐겨찾기)만 맡는다.
5주차에 조회 API를 만들었고, 6주차에 회원가입과 평점 등록·수정·삭제를 더했다.

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
| 닉네임 중복 체크 | GET | `/members/nickname/{nickname}` | 200 `{ "available": true }` |
| 이메일 중복 체크 | GET | `/members/email/{email}` | 200 `{ "available": true }` |
| 유저별 평점 조회 | GET | `/members/{memberId}/ratings` | 200 `[{ ratingId, movieId, score, comment, createdAt, updatedAt }]` (ratingId 최신순) |
| 회원가입 | POST | `/members` | 201 `{ isSuccess, code: "COMMON201", message, result: { memberId, email, nickname } }` |
| 평점 등록 | POST | `/members/{memberId}/ratings` | 201 `{ ..., code: "COMMON201", result: ratingId }` |
| 평점 수정 | PATCH | `/members/{memberId}/ratings/{ratingId}` | 200 `{ ..., code: "COMMON200", result: null }` |
| 평점 삭제 | DELETE | `/members/{memberId}/ratings/{ratingId}` | 204 (본문 없음) |

- 5주차 조회 API의 **성공 본문은 그대로** 둔다(프론트가 이미 `{available}`·배열을 그대로 읽는다). 6주차 쓰기 API의 성공은 `{ isSuccess, code, message, result }` 틀로 감싼다.
- **실패는 모든 API가 같은 틀**이다(`AllExceptionsFilter`). HTTP 상태 코드는 5주차와 같다.

```json
{ "isSuccess": false, "code": "MEMBER4091", "message": "이미 사용 중인 이메일입니다.", "result": null }
```

| 상태 | code | 언제 |
|---|---|---|
| 400 | `COMMON400` | 형식·범위 위반, DTO에 없는 값, 숫자가 아닌 ID, 깨진 JSON |
| 403 | `RATING4031` | 다른 회원의 평점을 수정·삭제 |
| 404 | `MEMBER4041` / `RATING4041` / `COMMON404` | 없는 회원 / 없는 평점 / 없는 경로 |
| 409 | `MEMBER4091` / `MEMBER4092` / `RATING4091` | 이메일 / 닉네임 / 같은 영화 평점 중복 (사전 확인과 DB UNIQUE 위반 모두) |
| 500 | `COMMON500` | 예상 못 한 오류. 화면에는 고정 문구만, 원문은 서버 로그에만 |

### 입력 규칙

- 회원가입: `email` 이메일 형식(254자 이하), `nickname` 2~12자, `password` 대문자·소문자·숫자·특수문자 포함 8자 이상(72자 이하, bcrypt 한계). 이메일·닉네임은 앞뒤 공백을 지우고 검증한다.
- 비밀번호는 bcrypt 해시(60자)로만 저장하고 응답에는 절대 넣지 않는다.
- 평점: `movieId` 양의 정수(TMDB ID), `score` 1~5 정수(필수), `comment` 500자 이하(선택).
- 수정은 PATCH라서 `comment`를 **생략하면 기존 후기를 유지**하고 `null`을 보내면 지운다. `score`는 항상 보낸다.
- DTO에 없는 필드를 보내면 400(`forbidNonWhitelisted`).
- 로그인(7주차) 전이라 요청한 회원은 경로의 `memberId`로 구분한다.
- 5주차 규칙은 그대로: (선택) 닉네임·이메일 형식 400, `?page=0&size=10` 페이지네이션, BIGINT ID는 숫자로 응답한다.

## CORS

`main.ts` → `app.setup.ts`의 `app.enableCors({ origin: CORS_ORIGINS })`. 기본값은 `http://localhost:5173` 하나.
`CORS_ORIGINS=*` 는 비교 실험용이다. 쓰기 API를 위해 `POST`·`PATCH`·`DELETE`도 허용 Method에 들어 있다.

- CORS 설정 전 재현: `npm run build && node --env-file=.env scripts/start-without-cors.mjs`
- 간이 프론트: 레포 루트 `mock-frontend/` 에서 `npx serve -l 5173`

## 검증

```bash
npm run build && npm test && npm run test:e2e && npm run lint
node --env-file=.env scripts/verify-week05.mjs          # 5주차: 실제 DB 18개 요청 → evidence/week05-api-results.json
node --env-file=.env scripts/verify-week06.mjs          # 6주차: 테스트 DB 26개 확인 → evidence/week06-api-results.json
node --env-file=.env scripts/run-newman-week06.mjs      # 6주차: Postman Collection 18개 요청·37개 assertion
```

- `test:e2e` 의 `members.e2e-spec.ts`(5주차)와 `verify-week05` 는 실제 로컬 MySQL(`umc_movie`, 시드 데이터)에 **조회만** 한다.
- 6주차 쓰기 테스트(`members-write.e2e-spec.ts`)와 `verify-week06`·`run-newman-week06` 은 **매번 새로 만드는 `umc_movie_test`** 에서만 돌고 끝나면 지운다. `umc_movie` 의 데이터는 바뀌지 않는다.
