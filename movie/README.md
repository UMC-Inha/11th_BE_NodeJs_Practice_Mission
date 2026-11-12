# 5~7주차 — 영화 평점 서비스 (NestJS 새 프로젝트)

3~4주차 도서 대여 프로젝트(레포 루트)는 그대로 두고, 워크북대로 `nest new movie`로 새 프로젝트를 만들었다.
영화 정보는 프론트가 TMDB에서 직접 받고, 이 서버는 회원·평점(이후 즐겨찾기)만 맡는다.
5주차에 조회 API를 만들었고, 6주차에 회원가입과 평점 등록·수정·삭제를 더했고,
7주차에 **로그인(JWT)** 을 만들어 "요청한 사람이 누구인지"를 URL이 아니라 토큰으로 구분하게 바꿨다.

## 실행

```bash
cd movie
npm ci
cp .env.example .env        # DB 비밀번호, JWT_SECRET 채우기 (.env 는 Git 제외)
mysql -u root -p < sql/schema.sql   # umc_movie DB + member/rating/favorite
mysql -u root -p < sql/seed.sql     # 수현·민서, TMDB 영화 550·155 평점
npm run start:dev           # http://localhost:3000
```

### JWT 환경변수 (7주차)

| 이름 | 뜻 | 규칙 |
|---|---|---|
| `JWT_SECRET` | 토큰 서명 키 | **32자 이상** 무작위 문자열. `openssl rand -base64 48`. 없거나 짧거나 `.env.example`의 예시 값 그대로면 서버가 **시작되지 않는다** |
| `JWT_ACCESS_EXPIRATION` | Access Token 유효시간(**초**) | 1 이상의 정수. 생략하면 3600(1시간). `1h` 같은 표기는 받지 않는다 |

- 키를 아는 사람은 누구나 원하는 내용으로 토큰을 만들 수 있다. `.env` 는 `.gitignore` 에 들어 있고, `.env.example` 에는 **쓰면 안 되는 예시 값**만 있다.
- 서명 알고리즘은 HS256으로 고정했다(헤더의 `alg` 를 바꿔 끼우는 공격 방지).

## API

`🔓` 토큰 필요 없음 · `🔒` `Authorization: Bearer {accessToken}` 필요

| API | Method | URL | 성공 응답 |
|---|---|---|---|
| 닉네임 중복 체크 🔓 | GET | `/members/nickname/{nickname}` | 200 `{ "available": true }` |
| 이메일 중복 체크 🔓 | GET | `/members/email/{email}` | 200 `{ "available": true }` |
| 유저별 평점 조회 🔓 | GET | `/members/{memberId}/ratings` | 200 `[{ ratingId, movieId, score, comment, createdAt, updatedAt }]` (ratingId 최신순, 공개 API) |
| 회원가입 🔓 | POST | `/members` | 201 `{ isSuccess, code: "COMMON201", message, result: { memberId, email, nickname } }` |
| **로그인** 🔓 | POST | `/auth/login` | 200 `{ ..., code: "COMMON200", result: { nickname, accessToken } }` |
| **내 정보 조회** 🔒 | GET | `/members/me` | 200 `{ ..., result: { email, nickname, createdAt } }` |
| **내 정보 수정** 🔒 | PATCH | `/members/me` | 200 내 정보 조회와 같은 `result` |
| 평점 등록 🔒 | POST | `/ratings` | 201 `{ ..., code: "COMMON201", result: { ratingId, movieId, score, comment, createdAt, updatedAt } }` |
| 평점 수정 🔒 | PATCH | `/ratings/{ratingId}` | 200 `{ ..., code: "COMMON200", result: { ... 수정된 평점 } }` |
| 평점 삭제 🔒 | DELETE | `/ratings/{ratingId}` | **200** `{ ..., code: "COMMON200", result: null }` |

### 6주차 → 7주차에서 바뀐 것

| | 6주차 | 7주차 |
|---|---|---|
| 평점 등록 | `POST /members/{memberId}/ratings` → result `ratingId` 숫자 | `POST /ratings` → result 평점 객체 |
| 평점 수정 | `PATCH /members/{memberId}/ratings/{ratingId}` → result `null` | `PATCH /ratings/{ratingId}` → result 평점 객체 |
| 평점 삭제 | `DELETE /members/{memberId}/ratings/{ratingId}` → **204** 본문 없음 | `DELETE /ratings/{ratingId}` → **200** + `result: null` |
| 누구의 평점인가 | 클라이언트가 URL에 적은 memberId | 서버가 토큰에서 꺼낸 memberId (요청 어디에도 없다) |
| 실패 code | `MEMBER4091` 같은 `{도메인}{상태}{순번}` | `MEMBER409_2` 같은 `{도메인}{상태}_{순번}` |

- 6주차의 `/members/{memberId}/ratings` **쓰기 경로는 없어졌다**(POST·PATCH·DELETE 모두 404). URL에 남겨 두면 클라이언트가 그 값을 바꿔 보낼 수 있기 때문이다. 값을 받지 않는 것이 곧 그 값을 조작당하지 않는 방법이다.
- 삭제를 204에서 200으로 바꾼 이유: 204는 본문을 보내지 않겠다는 뜻이라 `{ isSuccess, code, message, result }` 를 실을 수 없다. 삭제만 응답 틀에서 빠지지 않도록 200 + `result: null` 로 맞췄다.
- 5주차 조회 API(`GET /members/{memberId}/ratings`, 중복 체크)의 **성공 본문은 그대로**다(프론트가 이미 `{available}`·배열을 그대로 읽는다). 특정 회원의 평점 목록은 누구나 볼 수 있는 공개 기능이라 토큰을 요구하지 않는다.
- 6주차 평점 등록·수정·삭제를 호출하던 클라이언트는 `/ratings` + `Authorization` 헤더로 바꿔야 한다.

### 인증과 인가는 다른 일이다

```
POST /auth/login ──▶ AuthService: 이메일로 회원 찾기 → bcrypt.compare → JwtService.sign({ sub, email }) ──▶ accessToken
요청 + Authorization: Bearer … ──▶ AuthGuard (인증, 401) ──▶ 컨트롤러 (@LoginMember() memberId) ──▶ 서비스 (인가, 403)
```

- **인증(누구냐) = `AuthGuard`**: 컨트롤러가 실행되기 전에 헤더의 토큰을 꺼내 서명·만료를 검증하고, 통과하면 `sub` 를 숫자 회원 번호로 요청에 담는다. 로그인이 필요한 곳에 `@UseGuards(AuthGuard)` 를 붙인다.
- **인가(네 것이냐) = 서비스**: `RatingService.findOwnedRating` 이 평점을 먼저 찾고(없으면 404) 작성자를 토큰의 회원과 비교한다(다르면 403). 이 규칙은 DB를 봐야 알 수 있는 기능별 규칙이라 관문이 아니라 서비스에 둔다.
- 컨트롤러는 토큰을 모른다. `@LoginMember() memberId: number` (`src/decorator/login-member.decorator.ts`) 로 회원 번호만 받는다. 요청 객체의 키 이름은 `src/guard/authenticated-request.ts` 한 곳에만 있다.
- 로그인 실패는 **이메일이 없어도, 비밀번호가 틀려도 똑같은 응답**(`AUTH401_1`)이다. 구분해 알려 주면 이메일을 하나씩 넣어 보며 가입 여부를 알아낼 수 있다. 응답 시간으로도 알 수 없도록, 없는 이메일에도 cost 10의 가짜 해시와 `bcrypt.compare` 를 한 번 한다(이 Mac에서 보정 전: 틀린 비밀번호 75.9ms vs 없는 이메일 1.7ms, 보정 후: 57.8ms vs 57.5ms).
- 토큰 payload 는 암호화가 아니라 인코딩이라 누구나 읽을 수 있다. `sub`(회원 번호)·`email`·`iat`·`exp` 만 담고 비밀번호는 넣지 않는다.

### 실패 응답

**실패는 모든 API가 같은 틀**이다(`AllExceptionsFilter`). HTTP 상태 코드는 5주차와 같다.

```json
{ "isSuccess": false, "code": "AUTH401_2", "message": "로그인이 필요한 요청입니다.", "result": null }
```

| 상태 | code | message | 언제 |
|---|---|---|---|
| 400 | `COMMON400` | (검증 메시지) | 형식·범위 위반, DTO에 없는 값(예: 평점 Body 의 `memberId`), 숫자가 아닌 ID, 깨진 JSON |
| 401 | `AUTH401_1` | 이메일 또는 비밀번호가 올바르지 않습니다. | 로그인 실패 (이메일 없음 · 비밀번호 틀림 구분 없음) |
| 401 | `AUTH401_2` | 로그인이 필요한 요청입니다. | `Authorization` 헤더가 없거나 `Bearer {토큰}` 형식이 아님 |
| 401 | `AUTH401_3` | 유효하지 않은 토큰입니다. | 서명이 맞지 않음(위조·변조), 토큰이 아닌 문자열, 다른 키로 서명, `alg` 가 HS256 이 아님 |
| 401 | `AUTH401_4` | 토큰이 만료되었습니다. 다시 로그인해주세요. | 서명은 맞지만 유효시간(`exp`)이 지남 |
| 403 | `RATING403_1` | 본인이 작성한 평점만 수정하거나 삭제할 수 있습니다. | 다른 회원의 평점을 수정·삭제 |
| 404 | `MEMBER404_1` | 해당 회원을 찾을 수 없습니다. | 없는 회원 (토큰을 발급한 뒤 회원이 사라진 경우 포함) |
| 404 | `RATING404_1` | 해당 평점을 찾을 수 없습니다. | 없는 평점 (403 보다 먼저 확인) |
| 404 | `COMMON404` | (Nest 기본 메시지) | 없는 경로 (6주차 `/members/{memberId}/ratings` 쓰기 경로 포함) |
| 409 | `MEMBER409_1` | 이미 사용 중인 닉네임입니다. | 회원가입·내 정보 수정 (사전 확인과 DB UNIQUE 위반 모두) |
| 409 | `MEMBER409_2` | 이미 사용 중인 이메일입니다. | 회원가입 (**워크북 표에는 없는 코드**. 이메일과 닉네임을 code 로 구분하려고 6주차부터 따로 둔다) |
| 409 | `RATING409_1` | 이미 이 영화에 평점을 남기셨습니다. | 같은 영화에 평점 중복 (사전 확인과 DB UNIQUE 위반 모두) |
| 500 | `COMMON500` | 서버 내부 오류가 발생했습니다. … | 예상 못 한 오류. 화면에는 고정 문구만, 원문은 서버 로그에만 |

- **401 과 403 의 차이**: 401은 "네가 누군지 모르겠어"(토큰이 없거나 위조됐거나 만료됨), 403은 "누군지는 알겠는데 그건 네 것이 아니야". 프론트는 401이면 로그인 화면으로, 403이면 "권한이 없습니다" 안내로 보내야 해서 code 로 구분할 수 있어야 한다. 만료(`AUTH401_4`)도 같은 401 이지만 토큰이 없을 때(`AUTH401_2`)와 이유가 달라서 code 를 나눴다.
- 성공 code 는 계속 `COMMON200` / `COMMON201` 이고 무슨 일이 성공했는지는 `message` 가 알려 준다.

#### 6주차 code → 7주차 code

| 6주차 | 7주차 | 뜻 |
|---|---|---|
| `MEMBER4041` | `MEMBER404_1` | 없는 회원 |
| `MEMBER4091` | `MEMBER409_2` | 이메일 중복 |
| `MEMBER4092` | `MEMBER409_1` | 닉네임 중복 |
| `RATING4041` | `RATING404_1` | 없는 평점 |
| `RATING4031` | `RATING403_1` | 남의 평점 |
| `RATING4091` | `RATING409_1` | 같은 영화 평점 중복 |

`message` 는 없는 회원("존재하지 않는 유저입니다." → "해당 회원을 찾을 수 없습니다.")·없는 평점("존재하지 않는 평점입니다." → "해당 평점을 찾을 수 없습니다.")만 워크북 표대로 바뀌었다.

### 입력 규칙

- 회원가입: `email` 이메일 형식(254자 이하), `nickname` 2~12자, `password` 대문자·소문자·숫자·특수문자 포함 8자 이상(72자 이하, bcrypt 한계). 이메일·닉네임은 앞뒤 공백을 지우고 검증한다.
- 로그인: `email` 형식, `password` 비어 있지 않은 문자열. **비밀번호 규칙은 검사하지 않는다**(규칙이 바뀌기 전에 가입한 회원이 로그인조차 못 하게 되기 때문). 맞는지는 bcrypt 비교가 알려 준다.
- 내 정보 수정: `nickname` 2~12자. 내가 지금 쓰는 닉네임은 중복이 아니다(나를 제외한 회원 중에서 찾는다). 이메일·비밀번호는 여기서 바꿀 수 없다(보내면 400).
- 비밀번호는 bcrypt 해시(60자)로만 저장하고 응답에는 절대 넣지 않는다.
- 평점: `movieId` 양의 정수(TMDB ID), `score` 1~5 정수(필수), `comment` 500자 이하(선택). **`memberId` 는 받지 않는다**(보내면 400).
- 수정은 PATCH라서 `comment`를 **생략하면 기존 후기를 유지**하고 `null`을 보내면 지운다. `score`는 항상 보낸다. (워크북 예제는 `dto.comment ?? null` 이라 생략하면 후기가 지워진다. 6주차부터 이 쪽으로 바꿨고 7주차에도 그대로 둔다.)
- DTO에 없는 필드를 보내면 400(`forbidNonWhitelisted`).
- 5주차 규칙은 그대로: (선택) 닉네임·이메일 형식 400, `?page=0&size=10` 페이지네이션, BIGINT ID는 숫자로 응답한다.

## CORS

`main.ts` → `app.setup.ts`의 `app.enableCors({ origin: CORS_ORIGINS })`. 기본값은 `http://localhost:5173` 하나.
`CORS_ORIGINS=*` 는 비교 실험용이다. `POST`·`PATCH`·`DELETE` 가 허용 Method 에 들어 있고,
브라우저가 `Authorization` 헤더를 단 요청 앞에 보내는 사전 요청(preflight)도 허용 출처에 한해 통과한다(e2e 로 확인).

- CORS 설정 전 재현: `npm run build && node --env-file=.env scripts/start-without-cors.mjs`
- 간이 프론트: 레포 루트 `mock-frontend/` 에서 `npx serve -l 5173`

## 검증

```bash
npm run build && npm test && npm run test:e2e && npm run lint
npm run verify:week07     # 7주차: 실제 서버(PORT 3100)에 9단계 시나리오 등 26개 요청 + 비교·디코드·SQL 확인 5개 → evidence/week07-api-results.json
npm run newman:week07     # 7주차: Postman Collection 20개 요청·46개 assertion → evidence/week07-newman.json
npm run verify:expiry     # 7주차 선택 1: JWT_ACCESS_EXPIRATION=60 으로 토큰 만료 직접 확인(약 65초) → evidence/week07-expiry.json
npm run verify:week05     # 5주차: 실제 DB 조회 18개 요청 (evidence/week05-api-results.json 을 다시 쓴다)
```

- `test:e2e` 의 `members.e2e-spec.ts`(5주차)와 `verify:week05` 는 실제 로컬 MySQL(`umc_movie`, 시드 데이터)에 **조회만** 한다.
- 쓰기·인증 테스트(`members-write.e2e-spec.ts`, `auth.e2e-spec.ts`)와 7주차 `verify:*`·`newman:*` 스크립트는 **매번 새로 만드는 일회용 DB**(`umc_movie_test`, `umc_movie_test_auth`, `umc_movie_test_verify7` …)에서만 돌고 끝나면 지운다. 테스트 DB 헬퍼는 이름이 `umc_movie_test` 로 시작하지 않으면 `DROP` 을 하기 전에 멈춘다. `umc_movie` 의 데이터는 바뀌지 않는다.
- e2e 는 `.env` 의 진짜 `JWT_SECRET` 대신 실행마다 새로 만든 일회용 키를 쓴다(`test/support/env.ts`). 라이브 스크립트도 서버를 띄울 때마다 무작위 키를 넣는다.
- 라이브 스크립트가 남기는 증거 파일의 JWT 는 **서명 부분을 `<signature masked>` 로 가린다**(header·payload 는 읽을 수 있게 둔다).
- `evidence/week06-*` 는 **6주차 계약**(`/members/{memberId}/ratings`, 삭제 204, `MEMBER4091` 같은 code)의 기록이다. 해당 코드와 스크립트는 `brownglasses/week06` 브랜치에 있다. 7주차에서 경로가 바뀌어 6주차 스크립트(`verify-week06`, `run-newman-week06`)는 이 브랜치에서 지웠다.
