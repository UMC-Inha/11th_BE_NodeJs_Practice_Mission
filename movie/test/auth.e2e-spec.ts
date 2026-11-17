import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Fixture, createFixture } from './support/app-fixture.js';

/**
 * 7주차: 로그인(JWT 발급) → AuthGuard(401) → 소유권 확인(403) 을 실제 MySQL·실제 AppModule 로 검증한다.
 * 파일마다 자기 일회용 DB 를 써서(umc_movie_test_auth) 다른 e2e 파일과 부딪치지 않는다.
 */
describe('7주차 로그인·인증·인가 (격리된 테스트 DB)', () => {
  let f: Fixture;

  beforeAll(async () => {
    f = await createFixture('umc_movie_test_auth');
  });

  afterAll(async () => {
    await f.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const get = (path: string, token?: string) => {
    const req = request(f.server()).get(path);
    return token === undefined
      ? req
      : req.set('Authorization', f.bearer(token));
  };

  const decode = (segment: string) =>
    JSON.parse(Buffer.from(segment, 'base64url').toString()) as Record<
      string,
      unknown
    >;

  /** 토큰 segment(0 header, 1 payload, 2 signature) 의 position 번째 글자를 "다른 글자로 교체"한다. 덧붙이지 않는다. */
  function replaceChar(token: string, segment: number, position: number) {
    const parts = token.split('.');
    const target = parts[segment];
    const swapped = target[position] === 'A' ? 'B' : 'A';
    parts[segment] =
      target.slice(0, position) + swapped + target.slice(position + 1);
    return parts.join('.');
  }

  describe('POST /auth/login', () => {
    it('200 + { nickname, accessToken }, 토큰은 점 두 개로 나뉜 JWT(HS256)', async () => {
      const user = f.newUser();
      await f.post('/members', user).expect(201);

      const res = await f
        .post('/auth/login', { email: user.email, password: user.password })
        .expect(200);

      expect(res.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '로그인에 성공했습니다.',
        result: { nickname: user.nickname, accessToken: expect.any(String) },
      });
      const [header, payload, signature] = (
        res.body.result.accessToken as string
      ).split('.');
      expect(signature.length).toBeGreaterThan(0);
      expect(decode(header)).toEqual({ alg: 'HS256', typ: 'JWT' });
      const claims = decode(payload);
      expect(Object.keys(claims).sort()).toEqual([
        'email',
        'exp',
        'iat',
        'sub',
      ]);
      expect(claims.email).toBe(user.email);
      expect(typeof claims.sub).toBe('string');
      expect(claims.exp).toBe((claims.iat as number) + 3600);
      // payload 는 누구나 읽을 수 있으므로 비밀번호·해시가 들어가면 안 된다
      expect(res.text).not.toContain(user.password);
      expect(JSON.stringify(claims)).not.toContain('$2');
    });

    it('같은 사람이 다시 로그인하면 sub 는 같고 새 토큰을 받는다', async () => {
      const a = await f.signUpAndLogin();
      const again = await f
        .post('/auth/login', { email: a.email, password: a.password })
        .expect(200);
      const first = decode(a.token.split('.')[1]);
      const second = decode(
        (again.body.result.accessToken as string).split('.')[1],
      );
      expect(second.sub).toBe(first.sub);
      expect(second.sub).toBe(String(a.memberId));
    });

    it('없는 이메일과 틀린 비밀번호는 상태·본문이 완전히 같다 (AUTH401_1)', async () => {
      const user = f.newUser();
      await f.post('/members', user).expect(201);

      const unknownEmail = await f
        .post('/auth/login', { email: 'nobody@test.dev', password: 'Umc!1234' })
        .expect(401);
      const wrongPassword = await f
        .post('/auth/login', { email: user.email, password: 'Wrong!1234' })
        .expect(401);

      expect(unknownEmail.body).toEqual(
        f.failure('AUTH401_1', '이메일 또는 비밀번호가 올바르지 않습니다.'),
      );
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.text).toBe(unknownEmail.text);
    });

    it('시드 회원처럼 올바른 bcrypt 해시가 아닌 값이 저장돼 있어도 500 이 아니라 AUTH401_1', async () => {
      const res = await f
        .post('/auth/login', { email: 'noco@umc.com', password: 'Umc!1234' })
        .expect(401);
      expect(res.body.code).toBe('AUTH401_1');
    });

    it('로그인에서는 비밀번호 규칙을 검사하지 않는다 (규칙에 안 맞는 비밀번호도 400 이 아니라 401)', async () => {
      const user = f.newUser();
      await f.post('/members', user).expect(201);
      const res = await f
        .post('/auth/login', { email: user.email, password: 'abc' })
        .expect(401);
      expect(res.body.code).toBe('AUTH401_1');
    });

    it('이메일 앞뒤 공백은 지우고 찾는다', async () => {
      const user = f.newUser();
      await f.post('/members', user).expect(201);
      await f
        .post('/auth/login', {
          email: `  ${user.email} `,
          password: user.password,
        })
        .expect(200);
    });

    it('이메일 형식이 틀리거나 비밀번호가 없으면 400', async () => {
      const bad: Array<[string, object]> = [
        ['이메일 형식', { email: 'nope', password: 'x' }],
        ['이메일 없음', { password: 'x' }],
        ['비밀번호 빈 값', { email: 'a@test.dev', password: '' }],
        ['비밀번호 없음', { email: 'a@test.dev' }],
        ['모르는 필드', { email: 'a@test.dev', password: 'x', role: 'admin' }],
      ];
      for (const [name, body] of bad) {
        const res = await f.post('/auth/login', body);
        expect(res.status, name).toBe(400);
        expect(res.body, name).toEqual(f.failure('COMMON400'));
      }
    });
  });

  describe('GET /members/me (AuthGuard)', () => {
    it('토큰 없이 호출하면 401 AUTH401_2', async () => {
      const res = await get('/members/me').expect(401);
      expect(res.body).toEqual(
        f.failure('AUTH401_2', '로그인이 필요한 요청입니다.'),
      );
    });

    it('Bearer 형식이 아니면 토큰이 없는 것으로 본다 (AUTH401_2)', async () => {
      const user = await f.signUpAndLogin();
      for (const header of [user.token, `Basic ${user.token}`, 'Bearer ']) {
        const res = await request(f.server())
          .get('/members/me')
          .set('Authorization', header);
        expect(res.status, header.slice(0, 12)).toBe(401);
        expect(res.body.code, header.slice(0, 12)).toBe('AUTH401_2');
      }
    });

    it('올바른 토큰이면 200 + 내 정보(password 없음), URL 어디에도 누구인지 없다', async () => {
      const user = await f.signUpAndLogin();
      const res = await get('/members/me', user.token).expect(200);

      expect(res.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '회원 정보를 조회했습니다.',
        result: {
          email: user.email,
          nickname: user.nickname,
          createdAt: expect.any(String),
        },
      });
      expect(Number.isNaN(Date.parse(res.body.result.createdAt))).toBe(false);
      expect(res.text).not.toContain('password');
      expect(res.text).not.toContain('$2');
    });

    it('payload 의 글자 하나를 다른 글자로 "교체"하면 서명 검증에 걸려 401 AUTH401_3', async () => {
      const user = await f.signUpAndLogin();
      // sub 를 다른 회원 번호로 바꿔 치기하려는 시도와 같은 효과: 내용이 바뀌면 서명이 맞지 않는다.
      const tampered = replaceChar(user.token, 1, 12);
      expect(tampered).not.toBe(user.token);
      expect(tampered.split('.')[0]).toBe(user.token.split('.')[0]);
      expect(tampered.split('.')[2]).toBe(user.token.split('.')[2]);

      const res = await get('/members/me', tampered).expect(401);
      expect(res.body).toEqual(
        f.failure('AUTH401_3', '유효하지 않은 토큰입니다.'),
      );
    });

    it('내용(sub)을 다른 회원으로 고쳐 쓰고 서명은 그대로 두면 AUTH401_3', async () => {
      const a = await f.signUpAndLogin();
      const b = await f.signUpAndLogin();
      const [header, payload, signature] = a.token.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ ...decode(payload), sub: String(b.memberId) }),
      ).toString('base64url');

      const res = await get(
        '/members/me',
        `${header}.${forgedPayload}.${signature}`,
      ).expect(401);
      expect(res.body.code).toBe('AUTH401_3');
    });

    it('서명의 글자를 교체해도, 다른 비밀키로 서명해도 AUTH401_3', async () => {
      const user = await f.signUpAndLogin();
      const res1 = await get('/members/me', replaceChar(user.token, 2, 10));
      expect(res1.status).toBe(401);
      expect(res1.body.code).toBe('AUTH401_3');

      const foreign = await new JwtService({
        secret: 'z'.repeat(48),
      }).signAsync(
        { sub: String(user.memberId), email: user.email },
        { expiresIn: 3600 },
      );
      const res2 = await get('/members/me', foreign);
      expect(res2.status).toBe(401);
      expect(res2.body.code).toBe('AUTH401_3');
    });

    it('유효시간이 지난 토큰은 401 AUTH401_4 — 토큰이 없을 때(AUTH401_2)와 code 가 다르다', async () => {
      const user = await f.signUpAndLogin();
      // 서버와 같은 키·설정의 JwtService 로 유효시간만 1초로 줄여 발급한다
      const shortLived = await f.jwt.signAsync(
        { sub: String(user.memberId), email: user.email },
        { expiresIn: 1 },
      );
      await get('/members/me', shortLived).expect(200); // 만료 전

      await new Promise((resolve) => setTimeout(resolve, 2200));

      const expired = await get('/members/me', shortLived).expect(401);
      const missing = await get('/members/me').expect(401);
      expect(expired.body).toEqual(
        f.failure('AUTH401_4', '토큰이 만료되었습니다. 다시 로그인해주세요.'),
      );
      expect(missing.body.code).toBe('AUTH401_2');
      expect(expired.status).toBe(missing.status);
      expect(expired.body.code).not.toBe(missing.body.code);
    });

    it('토큰은 멀쩡한데 회원이 이미 없으면 404 MEMBER404_1', async () => {
      const ghost = await f.signUpAndLogin();
      await f.members.delete({ memberId: ghost.memberId });
      const res = await get('/members/me', ghost.token).expect(404);
      expect(res.body.code).toBe('MEMBER404_1');
    });
  });

  describe('PATCH /members/me', () => {
    const patchMe = (token: string | undefined, body: object) => {
      const req = request(f.server()).patch('/members/me');
      return (
        token === undefined ? req : req.set('Authorization', f.bearer(token))
      ).send(body);
    };

    it('200 + 바뀐 내 정보, 같은 토큰으로 다시 조회해도 바뀐 닉네임이다', async () => {
      const user = await f.signUpAndLogin();
      const res = await patchMe(user.token, { nickname: '새닉네임' }).expect(
        200,
      );
      expect(res.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '회원 정보를 수정했습니다.',
        result: {
          email: user.email,
          nickname: '새닉네임',
          createdAt: expect.any(String),
        },
      });
      const again = await get('/members/me', user.token).expect(200);
      expect(again.body.result.nickname).toBe('새닉네임');
      // 5주차 닉네임 확인 API 도 바뀐 상태를 본다
      const check = await request(f.server())
        .get(`/members/nickname/${encodeURIComponent('새닉네임')}`)
        .expect(200);
      expect(check.body).toEqual({ available: false });
    });

    it('내가 지금 쓰는 닉네임으로 "수정"해도 중복이 아니다 (200)', async () => {
      const user = await f.signUpAndLogin();
      const res = await patchMe(user.token, { nickname: user.nickname }).expect(
        200,
      );
      expect(res.body.result.nickname).toBe(user.nickname);
    });

    it('다른 회원이 쓰는 닉네임이면 409 MEMBER409_1 이고 내 닉네임은 그대로', async () => {
      const a = await f.signUpAndLogin();
      const b = await f.signUpAndLogin();
      const res = await patchMe(b.token, { nickname: a.nickname }).expect(409);
      expect(res.body).toEqual(
        f.failure('MEMBER409_1', '이미 사용 중인 닉네임입니다.'),
      );
      const mine = await get('/members/me', b.token).expect(200);
      expect(mine.body.result.nickname).toBe(b.nickname);
    });

    it('같은 새 닉네임으로 동시에 바꾸면 한 명만 200, 나머지는 DB UNIQUE 가 막아 409 MEMBER409_1', async () => {
      const users = await Promise.all([
        f.signUpAndLogin(),
        f.signUpAndLogin(),
        f.signUpAndLogin(),
      ]);
      const results = await Promise.all(
        users.map((u) => patchMe(u.token, { nickname: '경쟁닉' })),
      );
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        200, 409, 409,
      ]);
      for (const r of results.filter((x) => x.status === 409)) {
        expect(r.body.code).toBe('MEMBER409_1');
      }
      expect(await f.members.countBy({ nickname: '경쟁닉' })).toBe(1);
    });

    it('닉네임 규칙(2~12자)을 어기면 400, 이메일·비밀번호는 여기서 바꿀 수 없다(400)', async () => {
      const user = await f.signUpAndLogin();
      const bad: Array<[string, object]> = [
        ['1자', { nickname: 'a' }],
        ['13자', { nickname: '가'.repeat(13) }],
        ['빈 Body', {}],
        ['이메일 몰래 변경', { nickname: '정상닉네임', email: 'x@test.dev' }],
        [
          '비밀번호 몰래 변경',
          { nickname: '정상닉네임', password: 'Hack!1234' },
        ],
      ];
      for (const [name, body] of bad) {
        const res = await patchMe(user.token, body);
        expect(res.status, name).toBe(400);
        expect(res.body.code, name).toBe('COMMON400');
      }
      const mine = await get('/members/me', user.token).expect(200);
      expect(mine.body.result.email).toBe(user.email);
    });

    it('토큰이 없으면 401 AUTH401_2', async () => {
      const res = await patchMe(undefined, { nickname: '새닉네임' }).expect(
        401,
      );
      expect(res.body.code).toBe('AUTH401_2');
    });
  });

  describe('AuthGuard 를 붙인 곳과 붙이지 않은 곳', () => {
    it('로그인이 필요한 API 는 토큰 없이 부르면 모두 401 AUTH401_2', async () => {
      const protectedCalls: Array<[string, string, object?]> = [
        ['get', '/members/me'],
        ['patch', '/members/me', { nickname: '새닉네임' }],
        ['post', '/ratings', { movieId: 550, score: 5 }],
        ['patch', '/ratings/1', { score: 5 }],
        ['delete', '/ratings/1'],
      ];
      for (const [method, path, body] of protectedCalls) {
        const call = (
          request(f.server()) as unknown as Record<
            string,
            (p: string) => request.Test
          >
        )[method](path);
        const res = await (body ? call.send(body) : call);
        expect(res.status, `${method} ${path}`).toBe(401);
        expect(res.body.code, `${method} ${path}`).toBe('AUTH401_2');
      }
    });

    it('공개 API(회원가입·로그인·중복 확인·평점 목록 조회)는 토큰 없이도 401 이 아니다', async () => {
      const user = f.newUser();
      expect((await f.post('/members', user)).status).toBe(201);
      expect(
        (
          await f.post('/auth/login', {
            email: user.email,
            password: user.password,
          })
        ).status,
      ).toBe(200);
      expect((await get('/members/email/a@test.dev')).status).toBe(200);
      expect((await get('/members/nickname/아무개')).status).toBe(200);
      expect((await get('/members/1/ratings')).status).toBe(200);
    });

    it('평점 목록 조회는 공개라서 다른 회원의 토큰이 없어도, 엉터리 토큰을 달아도 같은 결과', async () => {
      const owner = await f.signUpAndLogin();
      await f.addRating(owner, 550, 5, '공개 목록');
      const anonymous = await get(`/members/${owner.memberId}/ratings`).expect(
        200,
      );
      const garbage = await get(
        `/members/${owner.memberId}/ratings`,
        'garbage',
      ).expect(200);
      expect(garbage.body).toEqual(anonymous.body);
      expect(anonymous.body).toHaveLength(1);
    });
  });

  describe('6주차의 /members/{memberId}/ratings 쓰기 API 는 없어졌다', () => {
    it('유효한 토큰을 달아도 POST·PATCH·DELETE 모두 404 이고 평점은 그대로', async () => {
      const owner = await f.signUpAndLogin();
      const ratingId = await f.addRating(owner, 550, 5, '그대로');
      const base = `/members/${owner.memberId}/ratings`;
      const auth = ['Authorization', f.bearer(owner.token)] as const;

      const created = await request(f.server())
        .post(base)
        .set(...auth)
        .send({ movieId: 155, score: 3 });
      const updated = await request(f.server())
        .patch(`${base}/${ratingId}`)
        .set(...auth)
        .send({ score: 1 });
      const deleted = await request(f.server())
        .delete(`${base}/${ratingId}`)
        .set(...auth);

      for (const res of [created, updated, deleted]) {
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('COMMON404');
      }
      expect(await f.listRatings(owner.memberId)).toEqual([
        expect.objectContaining({ ratingId, score: 5, comment: '그대로' }),
      ]);
    });
  });

  describe('워크북 "9. Postman 전체 시나리오" 9단계 (회원 A, B)', () => {
    it('가입 → 로그인 → 등록 201 → 중복 409 → 본인 수정 200 → 남의 수정 403 → 토큰 없음 401 → 없는 평점 404 → 본인 삭제 200', async () => {
      // 1. 준비: 두 명을 가입시킨다
      const a = f.newUser();
      const b = f.newUser();
      await f.post('/members', a).expect(201);
      await f.post('/members', b).expect(201);

      // 2. 로그인: 각자 토큰을 받는다
      const tokenA = (
        await f
          .post('/auth/login', { email: a.email, password: a.password })
          .expect(200)
      ).body.result.accessToken as string;
      const tokenB = (
        await f
          .post('/auth/login', { email: b.email, password: b.password })
          .expect(200)
      ).body.result.accessToken as string;
      expect(tokenA).not.toBe(tokenB);

      // 3. 등록: 토큰 A 로 POST /ratings (요청 Body 에 memberId 가 없다)
      const body = { movieId: 603, score: 5, comment: '9단계 시나리오' };
      expect(Object.keys(body)).not.toContain('memberId');
      const created = await request(f.server())
        .post('/ratings')
        .set('Authorization', f.bearer(tokenA))
        .send(body)
        .expect(201);
      expect(created.body.code).toBe('COMMON201');
      const ratingId = created.body.result.ratingId as number;
      expect(typeof ratingId).toBe('number');

      // 4. 중복 등록: 같은 movieId → 409 RATING409_1
      const duplicated = await request(f.server())
        .post('/ratings')
        .set('Authorization', f.bearer(tokenA))
        .send(body)
        .expect(409);
      expect(duplicated.body.code).toBe('RATING409_1');

      // 5. 본인 수정: 토큰 A 로 PATCH → 200
      await request(f.server())
        .patch(`/ratings/${ratingId}`)
        .set('Authorization', f.bearer(tokenA))
        .send({ score: 4 })
        .expect(200);

      // 6. 남의 것 수정: 토큰만 B 로 바꿔 같은 요청 → 403 RATING403_1 (인증은 통과, 인가에서 걸림)
      const forbidden = await request(f.server())
        .patch(`/ratings/${ratingId}`)
        .set('Authorization', f.bearer(tokenB))
        .send({ score: 4 })
        .expect(403);
      expect(forbidden.body.code).toBe('RATING403_1');

      // 7. 토큰 없이: Authorization 헤더를 지우고 → 401 AUTH401_2
      const unauthorized = await request(f.server())
        .patch(`/ratings/${ratingId}`)
        .send({ score: 4 })
        .expect(401);
      expect(unauthorized.body.code).toBe('AUTH401_2');
      // 401 과 403 의 code 는 서로 달라야 한다
      expect(unauthorized.body.code).not.toBe(forbidden.body.code);

      // 8. 없는 평점: 토큰 A 로 DELETE /ratings/99999 → 404 RATING404_1
      const missing = await request(f.server())
        .delete('/ratings/99999')
        .set('Authorization', f.bearer(tokenA))
        .expect(404);
      expect(missing.body.code).toBe('RATING404_1');

      // 9. 본인 삭제: 토큰 A 로 3번의 평점 삭제 → 200 COMMON200
      const deleted = await request(f.server())
        .delete(`/ratings/${ratingId}`)
        .set('Authorization', f.bearer(tokenA))
        .expect(200);
      expect(deleted.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '평점 삭제에 성공했습니다.',
        result: null,
      });
    });
  });
});
