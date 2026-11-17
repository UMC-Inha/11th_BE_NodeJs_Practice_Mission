import bcrypt from 'bcrypt';
import { Not, Repository } from 'typeorm';
import { Member } from '../entity/member.entity.js';
import { ApiException, ErrorCode } from '../exception/api.exception.js';
import { MemberService } from './member.service.js';

describe('MemberService', () => {
  function serviceWith(exists: boolean) {
    const repository = { exists: vi.fn().mockResolvedValue(exists) };
    return {
      repository,
      service: new MemberService(repository as unknown as Repository<Member>),
    };
  }

  it('이미 있는 닉네임이면 available=false', async () => {
    const { service, repository } = serviceWith(true);
    await expect(service.checkNickname('수현')).resolves.toEqual({
      available: false,
    });
    expect(repository.exists).toHaveBeenCalledWith({
      where: { nickname: '수현' },
    });
  });

  it('없는 이메일이면 available=true', async () => {
    const { service, repository } = serviceWith(false);
    await expect(service.checkEmail('new@umc.com')).resolves.toEqual({
      available: true,
    });
    expect(repository.exists).toHaveBeenCalledWith({
      where: { email: 'new@umc.com' },
    });
  });
});

describe('MemberService.signUp', () => {
  const dto = {
    email: 'umc@example.com',
    password: 'Umc!1234',
    nickname: 'moviefan',
  };

  function setup(existing: { email?: boolean; nickname?: boolean } = {}) {
    const repository = {
      // 첫 호출은 이메일, 두 번째 호출은 닉네임 중복 확인이다.
      exists: vi
        .fn()
        .mockResolvedValueOnce(existing.email ?? false)
        .mockResolvedValueOnce(existing.nickname ?? false),
      create: vi.fn((data: Partial<Member>) => data as Member),
      save: vi.fn((data: Member) =>
        Promise.resolve(Object.assign({}, data, { memberId: 9 })),
      ),
    };
    return {
      repository,
      service: new MemberService(repository as unknown as Repository<Member>),
    };
  }

  it('비밀번호는 bcrypt 해시(60자)로만 저장하고 응답에는 password 가 없다', async () => {
    const { service, repository } = setup();
    const result = await service.signUp(dto);

    expect(result).toEqual({
      memberId: 9,
      email: 'umc@example.com',
      nickname: 'moviefan',
    });
    expect(JSON.stringify(result)).not.toContain('password');

    const stored = repository.create.mock.calls[0][0] as Member;
    expect(stored.password).not.toBe(dto.password);
    expect(stored.password).toHaveLength(60);
    await expect(bcrypt.compare(dto.password, stored.password)).resolves.toBe(
      true,
    );
  });

  it('이메일 중복이면 409 MEMBER409_2 이고 저장하지 않는다', async () => {
    const { service, repository } = setup({ email: true });
    const error = await service.signUp(dto).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).code).toBe(ErrorCode.EMAIL_DUPLICATED);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('닉네임 중복이면 409 MEMBER409_1 (이메일과 code 가 다르다)', async () => {
    const { service, repository } = setup({ nickname: true });
    const error = await service.signUp(dto).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).code).toBe(ErrorCode.NICKNAME_DUPLICATED);
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('MemberService 내 정보 (GET·PATCH /members/me)', () => {
  const createdAt = new Date('2026-09-02T12:14:03Z');
  const stored: Member = {
    memberId: 7,
    email: 'movie@umc.com',
    password: '$2b$10$thisIsNotARealHashButItMustNeverBeInAnyResponse',
    nickname: '영화광',
    createdAt,
    updatedAt: createdAt,
  };

  function setup(member: Member | null, nicknameTaken = false) {
    const repository = {
      findOneBy: vi.fn().mockResolvedValue(member),
      exists: vi.fn().mockResolvedValue(nicknameTaken),
      save: vi.fn((data: Member) => Promise.resolve(data)),
    };
    return {
      repository,
      service: new MemberService(repository as unknown as Repository<Member>),
    };
  }

  it('getMyInfo 는 email·nickname·createdAt 만 돌려주고 password 는 없다', async () => {
    const { service, repository } = setup(structuredClone(stored));
    const result = await service.getMyInfo(7);

    expect(repository.findOneBy).toHaveBeenCalledWith({ memberId: 7 });
    expect(result).toEqual({
      email: 'movie@umc.com',
      nickname: '영화광',
      createdAt,
    });
    expect(JSON.stringify(result)).not.toContain('password');
    expect(JSON.stringify(result)).not.toContain('$2b$');
  });

  it('토큰은 멀쩡한데 회원이 이미 없으면 404 MEMBER404_1', async () => {
    const { service } = setup(null);
    const error = await service.getMyInfo(7).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(404);
    expect((error as ApiException).code).toBe(ErrorCode.MEMBER_NOT_FOUND);
  });

  it('updateMyInfo 는 "나를 제외한" 회원 중에서 닉네임 중복을 찾는다', async () => {
    const { service, repository } = setup(structuredClone(stored));
    const result = await service.updateMyInfo(7, { nickname: '새닉네임' });

    expect(repository.exists).toHaveBeenCalledWith({
      where: { nickname: '새닉네임', memberId: Not(7) },
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 7, nickname: '새닉네임' }),
    );
    expect(result).toEqual({
      email: 'movie@umc.com',
      nickname: '새닉네임',
      createdAt,
    });
  });

  it('다른 회원이 쓰는 닉네임이면 409 MEMBER409_1 이고 저장하지 않는다', async () => {
    const { service, repository } = setup(structuredClone(stored), true);
    const error = await service
      .updateMyInfo(7, { nickname: '수현' })
      .catch((e: unknown) => e);
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).code).toBe(ErrorCode.NICKNAME_DUPLICATED);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('없는 회원이면 404 이고 중복 확인도 하지 않는다', async () => {
    const { service, repository } = setup(null);
    const error = await service
      .updateMyInfo(7, { nickname: '새닉네임' })
      .catch((e: unknown) => e);
    expect((error as ApiException).code).toBe(ErrorCode.MEMBER_NOT_FOUND);
    expect(repository.exists).not.toHaveBeenCalled();
  });
});
