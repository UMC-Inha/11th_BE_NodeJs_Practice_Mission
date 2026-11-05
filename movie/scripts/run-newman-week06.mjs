// 6주차 Postman Collection 을 Newman 으로 실제 서버에 보내 결과를 evidence/week06-newman.json 에 남긴다.
// 일회용 테스트 DB(umc_movie_test)에 앱을 띄우므로 개발용 umc_movie 는 건드리지 않는다.
// npm run build && node --env-file=.env scripts/run-newman-week06.mjs
import 'reflect-metadata';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const TEST_DB = 'umc_movie_test';
const sqlFile = async (name) =>
  (
    await readFile(new URL(`../sql/${name}`, import.meta.url), 'utf8')
  ).replaceAll('umc_movie', TEST_DB);

const admin = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
});
await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
await admin.query(await sqlFile('schema.sql'));
await admin.query(await sqlFile('seed.sql'));

process.env.DB_NAME = TEST_DB;
const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const app = await NestFactory.create(AppModule, { logger: false });
configureApp(app);
await app.listen(0, '127.0.0.1');
const baseUrl = await app.getUrl();

try {
  // 같은 프로세스에서 서버가 응답해야 하므로 동기 실행(spawnSync) 대신 비동기 spawn 을 쓴다.
  const code = await new Promise((resolve) => {
    const child = spawn(
      'npx',
      [
        '--yes',
        'newman',
        'run',
        'evidence/week06.postman_collection.json',
        '--env-var',
        `baseUrl=${baseUrl}`,
        '--reporters',
        'cli,json',
        '--reporter-json-export',
        'evidence/week06-newman.json',
      ],
      { stdio: 'inherit' },
    );
    child.on('close', resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  await app.close();
  await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await admin.end();
}
