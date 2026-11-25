# 5~9주차 — 영화 평점 서비스 (NestJS 새 프로젝트)

3~4주차 도서 대여 프로젝트(레포 루트)는 그대로 두고, 워크북대로 `nest new movie`로 새 프로젝트를 만들었다.
영화 정보는 프론트가 TMDB에서 직접 받고, 이 서버는 회원·평점·즐겨찾기만 맡는다.
5주차에 조회 API를 만들었고, 6주차에 회원가입과 평점 등록·수정·삭제를 더했고,
7주차에 **로그인(JWT)** 을 만들어 "요청한 사람이 누구인지"를 URL이 아니라 토큰으로 구분하게 바꿨다.
8주차에는 **즐겨찾기**와 "평점 + 즐겨찾기를 한 번에 저장하는 **트랜잭션**"(`POST /movie-records`)을 만들고,
**Swagger**(`/api-docs`)로 API 문서를 붙였다.
9주차에는 새 API 없이 **문서를 끝까지 채우고**(평점·내 정보 API), **테스트가 정말 잘못된 코드를 잡는지 일부러 깨뜨려 확인**했다. → [9주차](#9주차--문서-완성과-테스트-검증)

## 실행

```bash
cd movie
npm ci
cp .env.example .env        # DB 비밀번호, JWT_SECRET 채우기 (.env 는 Git 제외)
mysql -u root -p < sql/schema.sql   # umc_movie DB + member/rating/favorite
mysql -u root -p < sql/seed.sql     # 수현·민서, TMDB 영화 550·155 평점
npm run start:dev           # http://localhost:3000, API 문서: http://localhost:3000/api-docs
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
| **즐겨찾기 등록** 🔒 | POST | `/favorites` | 201 `{ ..., code: "COMMON201", result: { favoriteId, movieId, createdAt } }` |
| **내 즐겨찾기 목록** 🔒 | GET | `/favorites` | 200 `{ ..., result: [{ favoriteId, movieId, createdAt }] }` (favoriteId 최신순, 내 것만) |
| **즐겨찾기 여부** 🔒 | GET | `/favorites/{movieId}` | 200 `{ ..., result: { isFavorite: true \| false } }` (없으면 404가 아니라 `false`) |
| **즐겨찾기 해제** 🔒 | DELETE | `/favorites/{movieId}` | **200** `{ ..., code: "COMMON200", result: null }` |
| **영화 기록 (평점 + 즐겨찾기)** 🔒 | POST | `/movie-records` | 201 `{ ..., result: { rating: { ... }, favorite: { ... } \| null } }` |
| **API 문서(Swagger)** 🔓 | GET | `/api-docs` · `/api-docs-json` | HTML 화면 · OpenAPI JSON |

- 즐겨찾기 경로의 `{movieId}` 는 TMDB 영화 ID 다. 어느 요청에도 `memberId` 가 없다(토큰에서 꺼낸다).
- 즐겨찾기는 `(member_id, movie_id)` 가 **DB UNIQUE**(`uk_favorite_member_movie`)라 한 회원이 같은 영화를 두 번 넣을 수 없다. 남의 즐겨찾기를 해제하려 하면 "내 것 중에 없다"로 보고 404 를 돌려준다(남의 것이 있는지 알려 주지 않는다).

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

### 8주차: 즐겨찾기와 트랜잭션

`POST /movie-records` 는 "평점을 남기면서 즐겨찾기에도 넣기"라는 **한 가지 행동**이다. 요청은 `{ movieId, score, comment?, addToFavorites }` 이고, 평점 저장과 즐겨찾기 저장이 둘 다 성공해야 성공이다.

- `RatingService.create()` 와 `FavoriteService.create()` 를 연달아 부르면 **각자 따로 커밋**된다. 평점은 저장됐는데 즐겨찾기가 실패하면 평점만 남는다. 그래서 `MovieRecordService` 하나에서 `dataSource.transaction(async (manager) => …)` 로 묶었다. 콜백이 정상 종료하면 commit, 예외가 밖으로 나가면 rollback 이다.
- 콜백 안에서는 **`manager.getRepository(...)` 로 만든 Repository 만** 쓴다. 주입받아 둔 Repository 를 섞으면 같은 트랜잭션 연결을 쓴다는 보장이 없어서 일부가 롤백되지 않는다.
- 먼저 "이미 있는지" 확인해 친절한 409(`RATING409_1`·`FAVORITE409_1`)를 주지만, 동시에 들어온 요청이 그 확인을 함께 통과하는 경우의 **마지막 방어선은 DB UNIQUE** 다. UNIQUE 위반(`ER_DUP_ENTRY`)은 `AllExceptionsFilter` 가 키 이름을 보고 같은 409 로 바꾼다. 이때 트랜잭션도 같이 rollback 된다.
- MySQL InnoDB 의 기본 격리 수준은 `REPEATABLE READ` 다. 이 구현은 잠금(`FOR UPDATE`)이나 낙관적 잠금을 쓰지 않고 **UNIQUE 제약 + 트랜잭션**만으로 중복과 부분 저장을 막는다.
- 실제 MySQL 로 확인한 것(`test/movie-records.e2e-spec.ts`, `npm run verify:week08`): 즐겨찾기 INSERT 에 트리거로 오류를 내면 **방금 저장한 평점 행도 0개로 되돌아간다**(트랜잭션 없이 두 Service 를 이어 부르면 평점이 1개 남는 것도 같은 테스트에서 보여 준다). 같은 요청 8개를 동시에 보내면 201 이 정확히 1개, 나머지 7개는 409 이고 행은 1개뿐이다.

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
| 404 | `FAVORITE404_1` | 즐겨찾기한 영화를 찾을 수 없습니다. | 내 즐겨찾기에 없는 영화를 해제 (남의 즐겨찾기도 같은 응답) |
| 404 | `COMMON404` | (Nest 기본 메시지) | 없는 경로 (6주차 `/members/{memberId}/ratings` 쓰기 경로 포함) |
| 409 | `MEMBER409_1` | 이미 사용 중인 닉네임입니다. | 회원가입·내 정보 수정 (사전 확인과 DB UNIQUE 위반 모두) |
| 409 | `MEMBER409_2` | 이미 사용 중인 이메일입니다. | 회원가입 (**워크북 표에는 없는 코드**. 이메일과 닉네임을 code 로 구분하려고 6주차부터 따로 둔다) |
| 409 | `RATING409_1` | 이미 이 영화에 평점을 남기셨습니다. | 같은 영화에 평점 중복 (사전 확인과 DB UNIQUE 위반 모두) |
| 409 | `FAVORITE409_1` | 이미 이 영화를 즐겨찾기하셨습니다. | 즐겨찾기 중복, `POST /movie-records` 의 즐겨찾기 중복 (사전 확인과 DB UNIQUE 위반 모두) |
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
- 즐겨찾기: `movieId` 양의 정수(TMDB ID, 필수). `memberId` 는 받지 않는다(보내면 400). 경로의 `{movieId}` 도 양의 정수여야 한다.
- 영화 기록: `movieId` 양의 정수, `score` 1~5 정수(필수), `comment` 500자 이하(선택), `addToFavorites` 불리언(필수). `false` 면 평점만 저장하고 응답의 `favorite` 은 `null` 이다.
- DTO에 없는 필드를 보내면 400(`forbidNonWhitelisted`).
- 5주차 규칙은 그대로: (선택) 닉네임·이메일 형식 400, `?page=0&size=10` 페이지네이션, BIGINT ID는 숫자로 응답한다.

## Swagger (API 문서)

서버를 띄우고 `http://localhost:3000/api-docs` 를 열면 Swagger UI, `/api-docs-json` 에서 OpenAPI JSON 을 볼 수 있다(`src/swagger/`).

- 🔒 가 붙은 API 는 로그인이 필요한 API 다. 먼저 `POST /auth/login` 을 Try it out 으로 호출해 `accessToken` 을 복사하고, 화면 위쪽 **Authorize** 에 **토큰만** 붙여넣는다(`Bearer ` 는 Swagger 가 붙인다). 그 뒤의 모든 요청에 `Authorization: Bearer …` 가 실린다.
- 15개 API 모두 한 줄 요약(🔒·공개 표시)과 자물쇠가 있고, 각 API 에 성공 응답 예시와 그 API 가 낼 수 있는 실패 응답(400·401·403·404·409 중 해당하는 것)의 상태 코드·`code` 예시가 있다. 문서의 예시가 실제 응답과 같은지는 `test/swagger.e2e-spec.ts` 가 실제 서버 응답과 비교해 확인한다. (8주차에는 평점·내 정보 API 9개가 요약과 자물쇠만 있고 설명·예시가 비어 있었다. 9주차에 채웠다 → 아래 9주차 절)
- 문서 데코레이터(`@ApiProperty`·`@ApiResponse` 등)는 문서만 만들 뿐 요청 검증·응답 틀을 바꾸지 않는다(검증은 `ValidationPipe`, 실패 틀은 `AllExceptionsFilter` 그대로).
- 화면 기록: `evidence/week08-swagger-overview.jpg`(전체 API와 자물쇠), `evidence/week08-swagger-favorites-post.jpg`(Authorize 뒤 `POST /favorites` 를 Try it out 으로 보내 201 을 받은 화면). 9주차 화면은 아래 9주차 절.

## 9주차 — 문서 완성과 테스트 검증

새 API 는 없다. 기능은 8주차 그대로이고, 문서 데코레이터와 테스트만 늘었다(`git diff` 에서 `src/service/` 는 바뀌지 않았다).

### 1. Swagger 문서를 끝까지 채웠다 (필수 미션 앞부분)

8주차에 "15개 API 를 문서화했다"고 적었지만, 실제로 열어 보니 **평점·내 정보·회원가입·중복 확인 9개 API 는 한 줄 요약과 자물쇠만 있고 설명(description)이 0자, 성공 예시가 없고 실패 응답은 401 하나뿐**이었다(즐겨찾기·영화 기록·로그인만 채워져 있었다). 9주차에 9개를 채웠다.

| API | 토큰 | 문서에 적은 실패 응답 (상태 코드 · `code`) |
|---|---|---|
| `POST /ratings` | 필요 | 400 `COMMON400`(별점 범위·영화 ID·memberId 를 몰래 보냄) · 401 `AUTH401_2/3/4` · 404 `MEMBER404_1` · 409 `RATING409_1` |
| `PATCH /ratings/{ratingId}` | 필요 | 400 · 401 · 403 `RATING403_1` · 404 `RATING404_1` |
| `DELETE /ratings/{ratingId}` | 필요 | 400 · 401 · 403 `RATING403_1` · 404 `RATING404_1` |
| `GET /members/{memberId}/ratings` | 공개 | 400 · 404 `MEMBER404_1` (성공 본문은 5주차 명세대로 공통 틀로 감싸지 않은 배열) |
| `GET /members/me` | 필요 | 401 · 404 `MEMBER404_1` |
| `PATCH /members/me` | 필요 | 400 · 401 · 404 · 409 `MEMBER409_1` |
| `GET /members/nickname/{nickname}`, `GET /members/email/{email}` | 공개 | 400 |
| `POST /members` | 공개 | 400 · 409 `MEMBER409_2`(이메일) / `MEMBER409_1`(닉네임) |
| `GET /favorites`, `GET /favorites/{movieId}`, `DELETE /favorites/{movieId}` | 필요 | 8주차 문서 + 9주차에 `DELETE` 의 400 추가 |

- 문서의 실패 예시는 **실제로 던지는 예외를 만드는 함수에서 그대로 뽑는다**(`src/swagger/api-docs.ts` 의 `ApiRatingForbidden` 등). 예외 문구를 바꾸면 문서도 같이 바뀐다.
- 8주차에 빠져 있던 400 두 개도 이번에 채웠다: `POST /auth/login`(이메일 형식), `DELETE /favorites/{movieId}`(숫자가 아닌 movieId).
- `test/swagger.e2e-spec.ts`(현재 50개)가 (a) 필수 API 의 한 줄 요약에 토큰 필요 여부가 있는지, 설명이 20자 이상인지, 응답 상태 코드 목록이 정확히 맞는지, (b) 문서에 적은 실패 예시가 **실제 서버가 돌려주는 응답과 같은지**를 확인한다. 예시가 문서에 없으면 빈 객체와 비교해 조용히 통과하지 않고 바로 실패한다.

### 2. 평점 테스트 (필수 미션 뒷부분)

| 요구 | 테스트 | 상태 |
|---|---|---|
| 단위: 같은 영화에 평점 중복 → `RATING409_1` | `src/service/rating.service.spec.ts` › create › "같은 회원·같은 영화면 409 RATING409_1 이고 저장하지 않는다" | **6~7주차에 이미 있던 테스트.** 9주차에 새로 쓰지 않았고, 아래 R1 실험으로 "정말 잡는지"만 확인했다 |
| 단위: 남의 평점 수정 → `RATING403_1` | 같은 파일 › update › "다른 회원의 평점이면 403 RATING403_1 이고 바꾸지 않는다" | 위와 같음 (R2 실험) |
| 통합: 토큰 없이 `POST /ratings` → 401 | `test/ratings.e2e-spec.ts` › "토큰 없이 … 401 AUTH401_2 이고 평점은 저장되지 않는다" (DB 행 수 0 까지 확인) | **9주차 새로 작성** |
| 통합: 토큰을 담아 `POST /ratings` → 201 | 같은 파일 › "토큰을 담아 … 201 이고 … DB 에 한 행이 저장된다" (작성자는 토큰이 정함) | **9주차 새로 작성** |

- 모든 통합 테스트는 매번 만들었다 지우는 일회용 MySQL DB(`umc_movie_test_*`)에서 돈다. 워크북은 메모리 DB(sql.js)를 쓰라고 했지만, 5주차부터 써 온 방식(진짜 MySQL)을 그대로 두었다. UNIQUE 제약·트랜잭션 rollback·동시 요청처럼 **진짜 MySQL 에서만 드러나는 동작**을 확인해야 했기 때문이다. 대신 로컬 MySQL 이 있어야 하고 통합 테스트가 느리다(약 20~40초).
- 전체: 단위 11개 파일 **143개 통과**, 통합 7개 파일 **145개 통과**, `npm run build`·`npm run lint` 오류 없음 (`evidence/week09-tests/full-*-verbose.txt`, `build-lint.txt`).

### 3. 일부러 깨뜨려 보기 (실습 6 + 확장)

워크북 실습 6("중복 검사를 지우면 테스트가 실패한다")을 즐겨찾기만이 아니라 평점·트랜잭션·문서에도 해 보았다. 코드를 바꾸고 → 테스트를 돌리고 → 원래대로 되돌렸다(`scripts/mutations-week09-*.sh`, 끝나면 `git status` 로 원복 확인).

| 변이 (지운 것) | 단위 테스트 | 통합 테스트 |
|---|---|---|
| **MA** `FavoriteService` 중복 사전 검사 | **1개 실패** (`409 FAVORITE409_1 이고 저장하지 않는다`) | **실패 0개** (27개 모두 통과) |
| **MC** MA + DB UNIQUE 위반을 `FAVORITE409_1` 로 바꾸는 필터 | 1개 실패 | **5개 실패** (중복 409 시나리오, 동시 8요청 등) |
| **MB** `POST /movie-records` 의 트랜잭션 | **9개 실패** | **2개 실패** (트리거로 즐겨찾기 INSERT 를 실패시키는 rollback 테스트, 경쟁 상황 테스트) |
| **R1** `RatingService` 중복 사전 검사 | 1개 실패 (`409 RATING409_1`) | 실패 0개 (34개 통과) |
| **R2** `RatingService` 소유권(403) 검사 | 3개 실패 | 4개 실패 |
| **R3** `POST /ratings` 의 `@UseGuards(AuthGuard)` | **실패 0개** (전체 143개 통과 — Service 는 가드가 붙어 있는지 모른다) | **18개 실패** (34개 중). 새 401 테스트뿐 아니라 `POST /ratings` 를 쓰는 테스트가 모두 깨진다. 가드가 없으면 `@LoginMember()` 가 "가드를 빠뜨렸다"는 오류를 던져 500 이 되기 때문이다 |
| **R4** `POST /ratings` 가 201 대신 200 | — | 16개 실패 (새 201 테스트 포함) |
| **D1** 문서 예시 문구를 틀리게(`5점` → `6점`) | — | swagger 1개 실패 (문서 vs 실제 응답 비교) — 당시 파일은 49개 |
| **D2** `PATCH /ratings` 문서에서 403 제거 | — | swagger 3개 실패 |
| **D3** `DELETE /ratings` 문서에서 자물쇠 제거 | — | swagger 2개 실패 |

**실험으로 알게 된 것 (정직하게)**

1. **중복 사전 검사를 지워도 통합 테스트는 초록불이다 (MA, R1).** `existsBy` 로 미리 막는 코드 뒤에는 DB `UNIQUE` 제약과, 그 위반을 409 로 바꾸는 예외 필터가 두 번째 방어선으로 있다. 그래서 사전 검사만 지우면 사용자에게 가는 응답은 그대로 `FAVORITE409_1` 이다. 사전 검사가 지켜 주는 것은 "어떤 코드가 응답하는가"가 아니라 "DB 에 불필요한 INSERT 를 시도하지 않는다"는 점이고, 그건 **단위 테스트만 잡는다**(`저장하지 않는다` 단언). 두 방어선을 모두 지우면(MC) 그제야 통합 테스트가 실패한다.
2. **워크북의 선택 미션 시나리오 테스트만으로는 트랜잭션을 증명하지 못한다.** "이미 즐겨찾기한 영화에 `addToFavorites: true`" 시나리오는 사전 검사가 평점을 저장하기 전에 먼저 막는다. 그래서 트랜잭션을 걷어 내도(MB) 이 테스트는 통과한다(`test/movie-records.e2e-spec.ts` 의 해당 테스트 이름에 이 사실을 적어 두었다). 트랜잭션을 진짜 증명하는 것은 8주차에 만든 **트리거 기반 rollback 테스트**(평점 INSERT 가 성공한 뒤 즐겨찾기 INSERT 가 DB 에서 실패하게 만들어 두 테이블이 0행인지 센다)와 **경쟁 상황 테스트**이고, MB 에서 이 둘이 실패했다.
3. 문서도 코드처럼 깨뜨려 볼 수 있다(D1~D3). 문서와 실제 응답을 비교하는 테스트가 없었다면 8주차처럼 "문서화했다"는 말만 남고 비어 있어도 아무도 몰랐을 것이다.

### 4. 증거 파일

| 파일 | 내용 |
|---|---|
| `evidence/week09-swagger-overview.jpg`, `…-overview-2.jpg` | Swagger UI 전체 API 15개(버전 라벨 `9주차`), 태그, 자물쇠 |
| `evidence/week09-swagger-post-ratings-doc.jpg`, `…-responses.jpg` | `POST /ratings` 를 펼친 화면: 설명, 요청 예시 두 가지, 201·400·401·404·409 예시 |
| `evidence/week09-swagger-patch-ratings-doc.jpg` | `PATCH /ratings/{ratingId}`: 경로 변수 설명, 요청 예시, 200 예시 |
| `evidence/week09-swagger-authorize.jpg` | Authorize 로 토큰을 넣은 화면(값은 `******` 로 가려짐) |
| `evidence/week09-swagger-post-ratings-201.jpg`, `…-409.jpg` | `POST /ratings` 를 Try it out 으로 실행: 201 → 같은 요청 한 번 더 → 409 `RATING409_1` |
| `evidence/week09-swagger-patch-ratings-403.jpg` | 다른 회원의 평점(`ratingId 4`)을 내 토큰으로 `PATCH` → 403 `RATING403_1` |
| `evidence/week09-swagger-post-favorites-doc.jpg`, `…-201.jpg`, `…-409.jpg`, `…-401.jpg` | 워크북 실습 3: `POST /favorites` 문서 → Authorize 후 201 → 409 `FAVORITE409_1` → Logout 후 401 `AUTH401_2` |
| `evidence/week09-test-unit-pass.png`, `…-e2e-pass.png`, `…-mission-rating.png` | 단위·통합 전체 통과 화면, 평점 미션 테스트 |
| `evidence/week09-test-fail-*.png` | 실습 6(`…-favorite-unit`, `…-favorite-e2e-still-green`, `…-both-defenses-e2e`), 트랜잭션 제거(`…-transaction-removed`), 평점 변이(`…-rating-unit`, `…-rating-e2e`) |
| `evidence/week09-tests/*.txt` | 위 화면의 원본 출력(전체 통과 verbose, 변이별 출력). `…-rating-e2e.png` 의 R3·R4 는 출력이 매우 길어 이미지에는 실패 줄만 발췌했고, 이 폴더에는 R1·R2 와 R3 의 단위 결과(`mutR3-…-unit.txt`)까지만 있다(R3·R4 의 통합 출력 원본은 두지 않았다) |

- Swagger 화면은 **촬영용 일회용 서버**(`PORT 3100`, 일회용 DB `umc_movie_test_swagger9`, 실행마다 새로 만든 무작위 JWT 키)에서 찍었고, 촬영 뒤 서버를 끄고 DB 를 지웠다. 개발 DB(`umc_movie`)는 건드리지 않았다.
- 화면의 curl 줄에는 토큰의 header 와 payload 앞부분만 보이고 **서명 부분은 화면 오른쪽 끝에서 잘려 보이지 않는다**. 그 키는 이미 폐기됐다.
- 테스트 화면(`*.png`)은 실제 터미널 캡처가 아니라, 실제로 돌린 출력 텍스트(`evidence/week09-tests/`)를 터미널 모양으로 그린 것이다. 개인 폴더 경로는 `~/movie` 로 줄였고 내용은 고치지 않았다(발췌한 그림은 제목과 첫 줄에 발췌라고 적었다).

### 5. 확인하지 못한 것 / 한계

- 이번 주 변경은 문서 데코레이터와 테스트뿐이라 새로 띄워 본 실서버 시나리오는 없다. Postman·Newman 스크립트(`verify:week08` 등)는 8주차 그대로이고 9주차 것은 만들지 않았다.
- 테스트가 초록불이어도 브라우저에서만 나타나는 CORS 문제는 잡지 못한다(워크북 안내와 같음). 8주차까지의 e2e 가 preflight 응답까지만 확인한다.
- `scripts/mutations-week09-*.sh` 를 다시 돌리면 `evidence/week09-tests/` 의 해당 파일이 개인 경로가 들어간 원본 출력으로 덮어써진다. 깨끗한 작업 트리에서만 돌릴 것(소스를 잠시 바꿨다가 되돌린다).

## CORS

`main.ts` → `app.setup.ts`의 `app.enableCors({ origin: CORS_ORIGINS })`. 기본값은 `http://localhost:5173` 하나.
`CORS_ORIGINS=*` 는 비교 실험용이다. `POST`·`PATCH`·`DELETE` 가 허용 Method 에 들어 있고,
브라우저가 `Authorization` 헤더를 단 요청 앞에 보내는 사전 요청(preflight)도 허용 출처에 한해 통과한다(e2e 로 확인).

- CORS 설정 전 재현: `npm run build && node --env-file=.env scripts/start-without-cors.mjs`
- 간이 프론트: 레포 루트 `mock-frontend/` 에서 `npx serve -l 5173`

## 검증

```bash
npm run build && npm test && npm run test:e2e && npm run lint
scripts/mutations-week09-favorite.sh MA MB MC   # 9주차: 코드를 일부러 깨뜨려 테스트가 잡는지 확인 (깨끗한 작업 트리에서만. 끝나면 원복)
scripts/mutations-week09-rating.sh R1 R2 R3 R4  # 9주차: 평점 테스트 변이
npm run verify:week08     # 8주차: 실제 서버(PORT 3100)에 즐겨찾기·영화 기록·트랜잭션 rollback·동시 8요청 등 32개 확인 → evidence/week08-api-results.json
npm run newman:week08     # 8주차: Postman Collection 27개 요청·55개 assertion → evidence/week08-newman.json (컬렉션: evidence/week08.postman_collection.json)
npm run verify:week07     # 7주차: 실제 서버(PORT 3100)에 9단계 시나리오 등 26개 요청 + 비교·디코드·SQL 확인 5개 → evidence/week07-api-results.json
npm run newman:week07     # 7주차: Postman Collection 20개 요청·46개 assertion → evidence/week07-newman.json
npm run verify:expiry     # 7주차 선택 1: JWT_ACCESS_EXPIRATION=60 으로 토큰 만료 직접 확인(약 65초) → evidence/week07-expiry.json
npm run verify:week05     # 5주차: 실제 DB 조회 18개 요청 (evidence/week05-api-results.json 을 다시 쓴다)
```

- `test:e2e` 의 `members.e2e-spec.ts`(5주차)와 `verify:week05` 는 실제 로컬 MySQL(`umc_movie`, 시드 데이터)에 **조회만** 한다.
- 쓰기·인증 테스트(`members-write.e2e-spec.ts`, `auth.e2e-spec.ts`, 8주차 `favorites`·`movie-records`·`swagger` e2e)와 7·8주차 `verify:*`·`newman:*` 스크립트는 **매번 새로 만드는 일회용 DB**(`umc_movie_test`, `umc_movie_test_auth`, `umc_movie_test_rec`, `umc_movie_test_ratings`, `umc_movie_test_verify8` …)에서만 돌고 끝나면 지운다. 테스트 DB 헬퍼는 이름이 `umc_movie_test` 로 시작하지 않으면 `DROP` 을 하기 전에 멈춘다. `umc_movie` 의 데이터는 바뀌지 않는다.
- e2e 는 `.env` 의 진짜 `JWT_SECRET` 대신 실행마다 새로 만든 일회용 키를 쓴다(`test/support/env.ts`). 라이브 스크립트도 서버를 띄울 때마다 무작위 키를 넣는다.
- 8주차 트랜잭션 테스트는 MySQL 트리거로 "즐겨찾기 INSERT 가 실패하는 상황"을 만들어 rollback 을 확인하고, 테스트가 끝나면 트리거도 지운다(일회용 DB 안에서만).
- 라이브 스크립트가 남기는 증거 파일의 JWT 는 **서명 부분을 `<signature masked>` 로 가린다**(header·payload 는 읽을 수 있게 둔다).
- `evidence/week06-*` 는 **6주차 계약**(`/members/{memberId}/ratings`, 삭제 204, `MEMBER4091` 같은 code)의 기록이다. 해당 코드와 스크립트는 `brownglasses/week06` 브랜치에 있다. 7주차에서 경로가 바뀌어 6주차 스크립트(`verify-week06`, `run-newman-week06`)는 이 브랜치에서 지웠다.
