import { Repository } from 'typeorm';
import { Member } from '../entity/member.entity.js';
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
