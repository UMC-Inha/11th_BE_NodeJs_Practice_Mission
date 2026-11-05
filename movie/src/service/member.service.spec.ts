import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
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

  it('이메일 중복이면 409 MEMBER4091 이고 저장하지 않는다', async () => {
    const { service, repository } = setup({ email: true });
    const error = await service.signUp(dto).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).code).toBe(ErrorCode.EMAIL_DUPLICATED);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('닉네임 중복이면 409 MEMBER4092 (이메일과 code 가 다르다)', async () => {
    const { service, repository } = setup({ nickname: true });
    const error = await service.signUp(dto).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).code).toBe(ErrorCode.NICKNAME_DUPLICATED);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
