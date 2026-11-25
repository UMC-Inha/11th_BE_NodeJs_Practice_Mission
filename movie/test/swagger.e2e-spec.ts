import { Logger } from '@nestjs/common';
import request from 'supertest';
import { Fixture, createFixture } from './support/app-fixture.js';

type Operation = {
  summary?: string;
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    content: Record<
      string,
      { schema?: unknown; examples?: Record<string, { value: unknown }> }
    >;
  };
  responses: Record<
    string,
    {
      content?: {
        'application/json': {
          example?: { code: string; message: string; result: unknown };
          examples?: Record<
            string,
            { value: { code: string; message: string } }
          >;
        };
      };
    }
  >;
};
type OpenApi = {
  openapi: string;
  info: { title: string; version: string };
  components: {
    securitySchemes: Record<
      string,
      { type: string; scheme: string; bearerFormat?: string }
    >;
  };
  paths: Record<string, Record<string, Operation>>;
};

/**
 * 8주차 Challenge: Swagger 문서가 약속한 내용을 담고 있는지 /api-docs-json 으로 검사한다.
 * 보호 API 와 공개 API 의 구분, 요청·응답 예시, 실패 code+상태를 확인하고,
 * 문서의 예시가 실제 서버 응답과 어긋나지 않는지도 같은 DB 위에서 비교한다.
 */
describe('Swagger 문서 (격리된 테스트 DB)', () => {
  let f: Fixture;
  let doc: OpenApi;

  beforeAll(async () => {
    f = await createFixture('umc_movie_test_docs', { swagger: true });
    doc = (await request(f.server()).get('/api-docs-json').expect(200))
      .body as OpenApi;
  });

  afterAll(async () => {
    await f.close();
  });

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const op = (path: string, method: string): Operation => {
    const found = doc.paths[path]?.[method];
    expect(
      found,
      `${method.toUpperCase()} ${path} 가 문서에 있다`,
    ).toBeDefined();
    return found;
  };
  const example = (path: string, method: string, status: number) =>
    op(path, method).responses[String(status)].content?.['application/json'];

  it('UI(/api-docs)와 JSON(/api-docs-json)이 모두 열리고 Bearer 인증 방식이 정의돼 있다', async () => {
    const ui = await request(f.server())
      .get('/api-docs')
      .redirects(1)
      .expect(200);
    expect(ui.text).toContain('swagger-ui');

    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBe('MovieLog API');
    expect(doc.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('8주차 API 다섯 개의 Method·URL 이 문서에 있다', () => {
    expect(Object.keys(doc.paths['/favorites']).sort()).toEqual([
      'get',
      'post',
    ]);
    expect(Object.keys(doc.paths['/favorites/{movieId}']).sort()).toEqual([
      'delete',
      'get',
    ]);
    expect(Object.keys(doc.paths['/movie-records'])).toEqual(['post']);
  });

  describe('토큰이 필요한 API 와 공개 API 의 구분', () => {
    const protectedOps: Array<[string, string]> = [
      ['/favorites', 'post'],
      ['/favorites', 'get'],
      ['/favorites/{movieId}', 'get'],
      ['/favorites/{movieId}', 'delete'],
      ['/movie-records', 'post'],
      ['/members/me', 'get'],
      ['/members/me', 'patch'],
      ['/ratings', 'post'],
      ['/ratings/{ratingId}', 'patch'],
      ['/ratings/{ratingId}', 'delete'],
    ];
    const publicOps: Array<[string, string]> = [
      ['/auth/login', 'post'],
      ['/members', 'post'],
      ['/members/nickname/{nickname}', 'get'],
      ['/members/email/{email}', 'get'],
      ['/members/{memberId}/ratings', 'get'],
    ];

    it.each(protectedOps)(
      '%s %s 는 자물쇠(bearer)가 있고 401 AUTH401_2/3/4 예시가 있다',
      (path, method) => {
        expect(op(path, method).security).toEqual([{ bearer: [] }]);
        const examples = example(path, method, 401)?.examples ?? {};
        expect(Object.keys(examples).sort()).toEqual([
          'AUTH401_2',
          'AUTH401_3',
          'AUTH401_4',
        ]);
      },
    );

    it.each(publicOps)('%s %s 는 자물쇠가 없다', (path, method) => {
      expect(op(path, method).security).toBeUndefined();
    });

    it('요약에도 토큰 필요 여부가 적혀 있다', () => {
      expect(op('/favorites', 'post').summary).toContain('토큰 필요');
      expect(op('/auth/login', 'post').summary).toContain('공개');
    });
  });

  describe('요청 예시와 성공/실패 응답 (상태 코드 + code)', () => {
    it('POST /favorites: 요청 Body 예시, 201 / 400 / 401 / 404 / 409', () => {
      const post = op('/favorites', 'post');
      expect(
        post.requestBody?.content['application/json'].examples?.['기본'].value,
      ).toEqual({ movieId: 550 });
      expect(Object.keys(post.responses).sort()).toEqual([
        '201',
        '400',
        '401',
        '404',
        '409',
      ]);
      expect(example('/favorites', 'post', 201)?.example).toMatchObject({
        code: 'COMMON201',
        message: '즐겨찾기를 등록했습니다.',
        result: { favoriteId: 1, movieId: 550 },
      });
      expect(
        example('/favorites', 'post', 409)?.examples?.FAVORITE409_1.value.code,
      ).toBe('FAVORITE409_1');
      expect(
        example('/favorites', 'post', 404)?.examples?.MEMBER404_1.value.code,
      ).toBe('MEMBER404_1');
      expect(
        example('/favorites', 'post', 400)?.examples?.COMMON400.value.code,
      ).toBe('COMMON400');
    });

    it('GET /favorites: 빈 배열도 정상(200)이라고 적혀 있다', () => {
      const get = op('/favorites', 'get');
      expect(Object.keys(get.responses).sort()).toEqual(['200', '401']);
      expect(get.responses['200']).toBeDefined();
      expect(example('/favorites', 'get', 200)?.example?.code).toBe(
        'COMMON200',
      );
    });

    it('GET /favorites/{movieId}: isFavorite 예시', () => {
      expect(
        example('/favorites/{movieId}', 'get', 200)?.example?.result,
      ).toEqual({ isFavorite: true });
    });

    it('DELETE /favorites/{movieId}: 200 은 result null, 404 FAVORITE404_1', () => {
      expect(
        example('/favorites/{movieId}', 'delete', 200)?.example,
      ).toMatchObject({
        code: 'COMMON200',
        result: null,
      });
      expect(
        example('/favorites/{movieId}', 'delete', 404)?.examples?.FAVORITE404_1
          .value.code,
      ).toBe('FAVORITE404_1');
    });

    it('POST /movie-records: 요청 예시 두 가지, 201 에 rating+favorite, 409 는 RATING409_1·FAVORITE409_1', () => {
      const post = op('/movie-records', 'post');
      const examples =
        post.requestBody?.content['application/json'].examples ?? {};
      expect(Object.keys(examples).sort()).toEqual(
        ['평점 + 즐겨찾기', '평점만'].sort(),
      );
      expect(examples['평점만'].value).toMatchObject({ addToFavorites: false });

      const created = example('/movie-records', 'post', 201)?.example;
      expect(created?.result).toHaveProperty('rating');
      expect(created?.result).toHaveProperty('favorite');
      expect(
        Object.keys(
          example('/movie-records', 'post', 409)?.examples ?? {},
        ).sort(),
      ).toEqual(['FAVORITE409_1', 'RATING409_1']);
    });

    it('POST /auth/login: 401 AUTH401_1 예시, 입력 오류 400 예시', () => {
      expect(
        example('/auth/login', 'post', 401)?.examples?.AUTH401_1.value.code,
      ).toBe('AUTH401_1');
      expect(
        example('/auth/login', 'post', 400)?.examples?.COMMON400.value.code,
      ).toBe('COMMON400');
    });

    it('DELETE /favorites/{movieId}: 숫자가 아닌 movieId 의 400 예시도 있다 (9주차에 채움)', () => {
      expect(
        example('/favorites/{movieId}', 'delete', 400)?.examples?.COMMON400
          .value.code,
      ).toBe('COMMON400');
    });
  });

  describe('9주차 필수 미션: 평점·내 정보·즐겨찾기 문서 (한 줄 설명 · 토큰 필요 여부 · 실패 응답의 상태 코드와 code)', () => {
    // [경로, 메서드, 토큰 필요 여부, 문서에 있어야 하는 응답 상태 코드]
    const required: Array<[string, string, boolean, string[]]> = [
      ['/ratings', 'post', true, ['201', '400', '401', '404', '409']],
      [
        '/ratings/{ratingId}',
        'patch',
        true,
        ['200', '400', '401', '403', '404'],
      ],
      [
        '/ratings/{ratingId}',
        'delete',
        true,
        ['200', '400', '401', '403', '404'],
      ],
      ['/members/{memberId}/ratings', 'get', false, ['200', '400', '404']],
      ['/members/me', 'get', true, ['200', '401', '404']],
      ['/members/me', 'patch', true, ['200', '400', '401', '404', '409']],
      ['/favorites', 'get', true, ['200', '401']],
      ['/favorites/{movieId}', 'get', true, ['200', '400', '401']],
      ['/favorites/{movieId}', 'delete', true, ['200', '400', '401', '404']],
    ];

    it.each(required)(
      '%s %s: 한 줄 요약에 토큰 필요 여부가 있고, 설명이 있고, 응답 상태 코드가 빠짐없이 적혀 있다 (자물쇠 %s, %j)',
      (path, method, needsToken, statuses) => {
        const operation = op(path, method);
        expect(operation.summary).toContain(needsToken ? '토큰 필요' : '공개');
        expect(operation.security !== undefined).toBe(needsToken);
        expect(
          (operation as { description?: string }).description?.length ?? 0,
          `${method} ${path} 설명`,
        ).toBeGreaterThanOrEqual(20);
        expect(Object.keys(operation.responses).sort()).toEqual(statuses);
      },
    );

    it.each(required)(
      '%s %s: 실패 응답은 모두 code 가 적혀 있고, code 의 상태 숫자가 HTTP 상태와 같다',
      (path, method) => {
        for (const [status, response] of Object.entries(
          op(path, method).responses,
        )) {
          if (status.startsWith('2')) continue;
          const content = response.content?.['application/json'];
          const values = content?.examples
            ? Object.values(content.examples).map((e) => e.value.code)
            : [];
          expect(
            values.length,
            `${method} ${path} ${status} 예시`,
          ).toBeGreaterThan(0);
          for (const code of values) {
            // COMMON400, AUTH401_2, RATING403_1 처럼 code 안에 HTTP 상태가 들어 있다.
            expect(code, `${method} ${path} ${status}`).toMatch(
              new RegExp(`^[A-Z]+${status}(_\\d+)?$`),
            );
          }
        }
      },
    );

    it('POST /ratings: 요청 예시 두 가지, 201 에 만들어진 평점, 409 RATING409_1, 404 MEMBER404_1', () => {
      const examples =
        op('/ratings', 'post').requestBody?.content['application/json']
          .examples ?? {};
      expect(Object.keys(examples).sort()).toEqual(['별점 + 후기', '별점만']);
      expect(example('/ratings', 'post', 201)?.example).toMatchObject({
        code: 'COMMON201',
        result: { ratingId: 3, movieId: 238, score: 5 },
      });
      expect(
        Object.keys(example('/ratings', 'post', 409)?.examples ?? {}),
      ).toEqual(['RATING409_1']);
      expect(
        Object.keys(example('/ratings', 'post', 404)?.examples ?? {}),
      ).toEqual(['MEMBER404_1']);
    });

    it('PATCH·DELETE /ratings/{ratingId}: 403 RATING403_1 과 404 RATING404_1 이 따로 적혀 있다', () => {
      for (const method of ['patch', 'delete']) {
        expect(
          Object.keys(
            example('/ratings/{ratingId}', method, 403)?.examples ?? {},
          ),
        ).toEqual(['RATING403_1']);
        expect(
          Object.keys(
            example('/ratings/{ratingId}', method, 404)?.examples ?? {},
          ),
        ).toEqual(['RATING404_1']);
      }
      expect(
        example('/ratings/{ratingId}', 'delete', 200)?.example,
      ).toMatchObject({ code: 'COMMON200', result: null });
    });

    it('GET /members/{memberId}/ratings: 5주차 명세 그대로 공통 틀로 감싸지 않은 배열 예시', () => {
      const body = example('/members/{memberId}/ratings', 'get', 200) as {
        example?: unknown;
      };
      expect(Array.isArray(body.example)).toBe(true);
    });

    it('PATCH /members/me 409 MEMBER409_1, POST /members 409 는 이메일(MEMBER409_2)과 닉네임(MEMBER409_1)을 구분한다', () => {
      expect(
        Object.keys(example('/members/me', 'patch', 409)?.examples ?? {}),
      ).toEqual(['MEMBER409_1']);
      expect(
        Object.keys(example('/members', 'post', 409)?.examples ?? {}).sort(),
      ).toEqual(['MEMBER409_1', 'MEMBER409_2']);
    });
  });

  describe('문서의 예시가 실제 서버 응답과 어긋나지 않는다', () => {
    it('401 AUTH401_2 / 409 FAVORITE409_1 / 404 FAVORITE404_1 의 code·message 가 문서와 같다', async () => {
      const documented = (
        path: string,
        method: string,
        status: number,
        code: string,
      ) => example(path, method, status)?.examples?.[code].value;
      const me = await f.signUpAndLogin();

      const noToken = await request(f.server()).get('/favorites').expect(401);
      expect(noToken.body).toMatchObject(
        documented('/favorites', 'get', 401, 'AUTH401_2') ?? {},
      );

      await f.addFavorite(me, 550);
      const dup = await f
        .as(me)
        .post('/favorites', { movieId: 550 })
        .expect(409);
      expect(dup.body).toMatchObject(
        documented('/favorites', 'post', 409, 'FAVORITE409_1') ?? {},
      );

      const missing = await f.as(me).delete('/favorites/123456').expect(404);
      expect(missing.body).toMatchObject(
        documented('/favorites/{movieId}', 'delete', 404, 'FAVORITE404_1') ??
          {},
      );

      const ratingDup = await (async () => {
        await f
          .as(me)
          .post('/movie-records', {
            movieId: 5,
            score: 4,
            addToFavorites: false,
          })
          .expect(201);
        return f
          .as(me)
          .post('/movie-records', {
            movieId: 5,
            score: 4,
            addToFavorites: false,
          })
          .expect(409);
      })();
      expect(ratingDup.body).toMatchObject(
        documented('/movie-records', 'post', 409, 'RATING409_1') ?? {},
      );
    });

    it('Swagger 를 켜도 입력 검증은 그대로다: 모르는 속성은 400', async () => {
      const me = await f.signUpAndLogin();
      const res = await f
        .as(me)
        .post('/favorites', { movieId: 550, nope: 1 })
        .expect(400);
      expect(res.body.message).toBe('property nope should not exist');
    });

    it('9주차: 평점·회원 API 의 실패 예시(400·403·404·409)도 실제 응답과 같다', async () => {
      // 문서에 그 예시가 없으면 빈 객체와 비교해서 조용히 통과하지 않고, 바로 실패하게 한다.
      const documented = (
        path: string,
        method: string,
        status: number,
        name: string,
      ) => {
        const found = example(path, method, status)?.examples?.[name]?.value;
        expect(
          found,
          `${method.toUpperCase()} ${path} ${status} 문서에 '${name}' 예시가 있다`,
        ).toBeDefined();
        return found as object;
      };
      const owner = await f.signUpAndLogin();
      const other = await f.signUpAndLogin();
      const ratingId = await f.addRating(owner, 700, 4);
      const patch = (token: string, id: number | string, body: object) =>
        request(f.server())
          .patch(`/ratings/${id}`)
          .set('Authorization', f.bearer(token))
          .send(body);

      // POST /ratings 409 · 400
      const dup = await f
        .as(owner)
        .post('/ratings', { movieId: 700, score: 4 })
        .expect(409);
      expect(dup.body).toMatchObject(
        documented('/ratings', 'post', 409, 'RATING409_1'),
      );
      const tooHigh = await f
        .as(owner)
        .post('/ratings', { movieId: 701, score: 6 })
        .expect(400);
      expect(tooHigh.body).toMatchObject(
        documented('/ratings', 'post', 400, '별점 범위 오류'),
      );
      const badMovie = await f
        .as(owner)
        .post('/ratings', { movieId: 0, score: 3 })
        .expect(400);
      expect(badMovie.body).toMatchObject(
        documented('/ratings', 'post', 400, '영화 ID 오류'),
      );
      const sneaky = await f
        .as(owner)
        .post('/ratings', { movieId: 702, score: 3, memberId: other.memberId })
        .expect(400);
      expect(sneaky.body).toMatchObject(
        documented('/ratings', 'post', 400, 'memberId 를 몰래 보냄'),
      );

      // PATCH·DELETE /ratings/{ratingId} 403 · 404 · 400
      const forbidden = await patch(other.token, ratingId, { score: 1 }).expect(
        403,
      );
      expect(forbidden.body).toMatchObject(
        documented('/ratings/{ratingId}', 'patch', 403, 'RATING403_1'),
      );
      const forbiddenDelete = await request(f.server())
        .delete(`/ratings/${ratingId}`)
        .set('Authorization', f.bearer(other.token))
        .expect(403);
      expect(forbiddenDelete.body).toMatchObject(
        documented('/ratings/{ratingId}', 'delete', 403, 'RATING403_1'),
      );
      const missing = await patch(owner.token, 987654, { score: 1 }).expect(
        404,
      );
      expect(missing.body).toMatchObject(
        documented('/ratings/{ratingId}', 'patch', 404, 'RATING404_1'),
      );
      const lowScore = await patch(owner.token, ratingId, { score: 0 }).expect(
        400,
      );
      expect(lowScore.body).toMatchObject(
        documented('/ratings/{ratingId}', 'patch', 400, '별점 범위 오류'),
      );
      const notNumber = await request(f.server())
        .delete('/ratings/abc')
        .set('Authorization', f.bearer(owner.token))
        .expect(400);
      expect(notNumber.body).toMatchObject(
        documented('/ratings/{ratingId}', 'delete', 400, 'ratingId 형식 오류'),
      );

      // 유저별 평점 조회 400 · 404 (공개 API)
      const badSize = await request(f.server())
        .get(`/members/${owner.memberId}/ratings?size=100`)
        .expect(400);
      expect(badSize.body).toMatchObject(
        documented('/members/{memberId}/ratings', 'get', 400, 'size 범위 오류'),
      );
      const noMember = await request(f.server())
        .get('/members/987654/ratings')
        .expect(404);
      expect(noMember.body).toMatchObject(
        documented('/members/{memberId}/ratings', 'get', 404, 'MEMBER404_1'),
      );

      // 내 정보 수정 409 · 400, 중복 확인 400, 회원가입 409 · 400
      const nickDup = await request(f.server())
        .patch('/members/me')
        .set('Authorization', f.bearer(owner.token))
        .send({ nickname: other.nickname })
        .expect(409);
      expect(nickDup.body).toMatchObject(
        documented('/members/me', 'patch', 409, 'MEMBER409_1'),
      );
      const nickShort = await request(f.server())
        .patch('/members/me')
        .set('Authorization', f.bearer(owner.token))
        .send({ nickname: 'a' })
        .expect(400);
      expect(nickShort.body).toMatchObject(
        documented('/members/me', 'patch', 400, '닉네임 길이 오류'),
      );
      const nickParam = await request(f.server())
        .get('/members/nickname/a')
        .expect(400);
      expect(nickParam.body).toMatchObject(
        documented(
          '/members/nickname/{nickname}',
          'get',
          400,
          '닉네임 길이 오류',
        ),
      );
      const emailParam = await request(f.server())
        .get('/members/email/not-an-email')
        .expect(400);
      expect(emailParam.body).toMatchObject(
        documented('/members/email/{email}', 'get', 400, '이메일 형식 오류'),
      );
      const emailDup = await f
        .post('/members', { ...f.newUser(), email: owner.email })
        .expect(409);
      expect(emailDup.body).toMatchObject(
        documented('/members', 'post', 409, 'MEMBER409_2'),
      );
      const nameDup = await f
        .post('/members', { ...f.newUser(), nickname: owner.nickname })
        .expect(409);
      expect(nameDup.body).toMatchObject(
        documented('/members', 'post', 409, 'MEMBER409_1'),
      );
      const badEmail = await f
        .post('/members', { ...f.newUser(), email: 'nope' })
        .expect(400);
      expect(badEmail.body).toMatchObject(
        documented('/members', 'post', 400, '이메일 형식 오류'),
      );
      const weakPassword = await f
        .post('/members', { ...f.newUser(), password: 'abc' })
        .expect(400);
      expect(weakPassword.body).toMatchObject(
        documented('/members', 'post', 400, '비밀번호 규칙 오류'),
      );
      const role = await f
        .post('/members', { ...f.newUser(), role: 'admin' })
        .expect(400);
      expect(role.body).toMatchObject(
        documented('/members', 'post', 400, '모르는 필드'),
      );

      // 8주차 문서에 빠져 있다가 9주차에 채운 400 두 개
      const badLogin = await f
        .post('/auth/login', { email: 'nope', password: 'x' })
        .expect(400);
      expect(badLogin.body).toMatchObject(
        documented('/auth/login', 'post', 400, 'COMMON400'),
      );
      const badFavoriteId = await f
        .as(owner)
        .delete('/favorites/abc')
        .expect(400);
      expect(badFavoriteId.body).toMatchObject(
        documented('/favorites/{movieId}', 'delete', 400, 'COMMON400'),
      );
    });
  });
});
