// 7주차 라이브 검증 스크립트들이 같이 쓰는 도구.
//  - 일회용 DB(umc_movie_test_*) 만들기/지우기: 이름이 일회용 규칙이 아니면 아무것도 하지 않고 멈춘다.
//  - 빌드된 서버(node dist/main.js)를 실제 프로세스로 PORT 3100 에 띄우고 끝나면 내린다.
//  - 증거 파일에 남기는 JWT 는 서명 부분을 가린다(header·payload 는 읽을 수 있게 둔다).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

export const PORT = 3100;
const DISPOSABLE_DB = /^umc_movie_test_[a-z0-9]+$/;

const sqlFile = async (name, dbName) =>
  (
    await readFile(new URL(`../../sql/${name}`, import.meta.url), 'utf8')
  ).replaceAll('umc_movie', dbName);

function assertDisposable(dbName) {
  if (!DISPOSABLE_DB.test(dbName)) {
    throw new Error(
      `일회용 DB 이름이 아닙니다: ${dbName} (umc_movie_test_xxx 만 허용)`,
    );
  }
}

export async function adminConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
}

export async function createDisposableDb(admin, dbName) {
  assertDisposable(dbName);
  await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await admin.query(await sqlFile('schema.sql', dbName));
  await admin.query(await sqlFile('seed.sql', dbName));
}

export async function dropDisposableDb(admin, dbName) {
  assertDisposable(dbName);
  await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
}

/** JWT 의 서명(세 번째 덩어리)만 가린다. header·payload 는 그대로 둔다. */
export const maskTokens = (text) =>
  text.replace(
    /(eyJ[\w-]+\.[\w-]+)\.[\w-]*/g,
    (_, headerAndPayload) => `${headerAndPayload}.<signature masked>`,
  );

/** 객체를 JSON 으로 바꾸면서 JWT 서명을 가린다. */
export const toMaskedJson = (value) =>
  maskTokens(JSON.stringify(value, null, 2)) + '\n';

/**
 * 빌드된 서버를 별도 프로세스로 띄운다. 이 실행에서만 쓰는 무작위 JWT 키를 넣고(.env 의 진짜 키는 쓰지 않는다),
 * 서버 출력은 모아 두기만 한다(키·DB 비밀번호는 서버가 출력하지 않는다).
 */
export async function startServer({ dbName, accessExpiration = '3600' }) {
  assertDisposable(dbName);
  const logs = [];
  const child = spawn('node', ['dist/main.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_NAME: dbName,
      JWT_SECRET: randomBytes(32).toString('hex'),
      JWT_ACCESS_EXPIRATION: accessExpiration,
      CORS_ORIGINS: 'http://localhost:5173',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });

  const base = `http://127.0.0.1:${PORT}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (exited) throw new Error(`서버가 바로 종료됐습니다:\n${logs.join('')}`);
    try {
      const response = await fetch(`${base}/members/email/ready@test.dev`);
      if (response.status === 200) break;
    } catch {
      // 아직 뜨는 중
    }
    if (Date.now() > deadline) {
      child.kill('SIGTERM');
      throw new Error(`서버가 30초 안에 뜨지 않았습니다:\n${logs.join('')}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  async function stop() {
    if (exited) return;
    await new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill('SIGTERM');
    });
  }
  return { base, logs, stop };
}
