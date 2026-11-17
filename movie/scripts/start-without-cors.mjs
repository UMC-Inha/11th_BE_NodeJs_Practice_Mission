// 실습 0 재현용: CORS 설정(app.enableCors) 없이 서버를 띄운다.
// npm run build 후 node --env-file=.env scripts/start-without-cors.mjs
// 이 상태에서 http://localhost:5173 간이 프론트 버튼을 누르면 브라우저 콘솔에 CORS 에러가 뜬다.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';

const app = await NestFactory.create(AppModule);
await app.listen(process.env.PORT ?? 3000);
console.log(`CORS 설정 없이 실행 중: ${await app.getUrl()}`);
