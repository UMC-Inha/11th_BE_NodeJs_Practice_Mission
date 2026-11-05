# BE Node Js 워크북 전용 레포입니다!

### 워크북 수행 방법

1. 현재 레포를 fork하여 가져옵니다
2. fork된 레포를 clone하여 로컬에 가져옵니다
3. Visual Studio Code를 이용하여 프로젝트를 열어줍니다
4. 워크북 그리고 미션을 수행하며 코드를 작성합니다
5. 워크북과 미션을 완료하면 fork된 레포에 push합니다
6. pr을 올려주세요!

### pr 올리기

1. 제목은 그대로 ! ([00주차/에반] 워크북 제출합니다.)
2. 라벨은 챕터만 추가
3. 이슈 연결
4. 교육국장에게 리뷰 요청
5. pr 템플릿에 맞게 항목 채워주기

### 커밋 컨벤션

| 커밋 타입       | 설명                                                                | 예시                           |
| --------------- | ------------------------------------------------------------------- | ------------------------------ |
| ✨ **Feat**     | 새로운 기능 추가                                                    | `FEAT: 기능 추가`              |
| 🐛 **Fix**      | 버그 수정                                                           | `FIX: 오류 수정`               |
| 📄 **Docs**     | 문서 수정                                                           | `DOCS: README 파일 수정`       |
| ♻️ **Refactor** | 코드 리팩토링                                                       | `REFACTOR: 함수 구조 개선`     |
| 📦 **Chore**    | 빌드 업무 수정, 패키지 매니저 수정 등 production code와 무관한 변경 | `CHORE: .gitignore 파일 수정`  |
| 💬 **Comment**  | 주석 추가 및 변경                                                   | `COMMENT: 함수 설명 주석 추가` |
| 🔥 **Remove**   | 파일 또는 폴더 삭제                                                 | `REMOVE: 불필요한 파일 삭제`   |
| 🚚 **Rename**   | 파일 또는 폴더명 수정                                               | `RENAME: 폴더명 변경`          |


## 4주차 — TypeORM + DTO 도서 API

3주차 Raw SQL 버전은 `brownglasses/week03` 브랜치와 `src/book.repository.ts`에 보존했다. 4주차 도서 Controller는 `BooksModule`의 TypeORM Repository만 사용하며, 기존 대여 API는 3주차 구현을 유지한다.

```bash
npm ci
# 기존 3주차 DB를 복사할 때만, .env의 DB_NAME을 3주차 DB 이름으로 설정 후 실행
node --env-file=.env scripts/prepare-week04-db.mjs
# 이후 .env의 DB_NAME=umc_week04_library로 변경
npm run migration:run
npm run start:dev
```

- `GET /books`: 최신 등록순, 카테고리 이름 포함 Response DTO
- `POST /books`: `{ "categoryId": 1, "title": "새 도서", "description": "선택" }` → 201
- `GET /books?keyword=스프링`: 제목 부분 검색, 검색 결과 없으면 200 `[]`
- 빈/공백/101자 제목, 잘못된 입력 타입 → 400
- 없는 카테고리 → 404, 같은 제목(동시 요청 포함) → 409
- `bookId`는 MySQL BIGINT의 정밀도를 보존하는 문자열이고 `isAvailable`은 boolean이다.
- `synchronize: false`; UNIQUE 변경은 Migration으로 실행한다. 기존 제목 중복이 있으면 Migration이 실패하며 원래 행을 자동 삭제하지 않는다.

```bash
npm run build
npm run verify:week04  # 실행할 때마다 실습용 도서 3건 추가. 별도 실습 DB에서 사용.
npm test
npm run lint
```

검증 결과: `evidence/week04-api-results.json`. Postman 요청 모음은 `evidence/week04.postman_collection.json`을 Import한다. DB 접속 정보는 `.env`로만 관리한다.
