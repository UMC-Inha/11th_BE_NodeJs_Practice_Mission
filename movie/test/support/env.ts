import { randomBytes } from 'node:crypto';

/**
 * e2e 는 개발자 .env 의 진짜 JWT_SECRET 을 쓰지 않고, 실행마다 새로 만든 일회용 키를 쓴다.
 * (ConfigModule 은 이미 있는 환경변수를 .env 값으로 덮어쓰지 않는다.)
 * 그래서 .env 에 JWT 설정이 없는 환경에서도 테스트가 돈다.
 */
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_ACCESS_EXPIRATION = '3600';
