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

    it('POST /auth/login: 401 AUTH401_1 예시', () => {
      expect(
        example('/auth/login', 'post', 401)?.examples?.AUTH401_1.value.code,
      ).toBe('AUTH401_1');
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
  });
});
