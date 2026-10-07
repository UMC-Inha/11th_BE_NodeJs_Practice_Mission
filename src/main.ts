import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Pool } from 'mysql2/promise';
import { AppModule } from './app.module.js';
import { DATABASE_CONNECTION } from './database.provider.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 실습 체크리스트 "서버 콘솔에 에러 없이 DB 커넥션이 연결된다" 확인용.
  // 커넥션 풀은 첫 쿼리 때 연결을 만들기 때문에, 켜질 때 한 번 찔러 봐야
  // 비밀번호·DB 이름이 틀린 것을 첫 API 요청 전에 바로 알 수 있습니다.
  const pool = app.get<Pool>(DATABASE_CONNECTION);
  await pool.query('SELECT 1');
  Logger.log('DB 커넥션 풀 연결 성공', 'Database');

  // 인증이 없는 실습용 API라 내 컴퓨터(127.0.0.1)에서만 열어 둡니다.
  await app.listen(process.env.PORT ?? 3000, '127.0.0.1');
}
await bootstrap();
