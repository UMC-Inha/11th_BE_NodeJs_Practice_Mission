import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

/** 쓰기 e2e 전용 DB 이름. 개발용 umc_movie 와 섞이지 않는다. */
export const TEST_DB_NAME = 'umc_movie_test';

/**
 * 테스트 파일은 병렬로 돌 수 있어서 파일마다 자기 DB 를 쓴다(umc_movie_test, umc_movie_test_auth ...).
 * DROP DATABASE 를 하는 코드이므로 이름이 umc_movie_test 로 시작하는 DB 만 받는다.
 * 개발용 umc_movie 나 다른 DB 이름을 넘기면 아무것도 지우기 전에 오류가 난다.
 */
const DISPOSABLE_DB_NAME = /^umc_movie_test(_[a-z0-9]+)?$/;

function assertDisposable(dbName: string): void {
  if (!DISPOSABLE_DB_NAME.test(dbName)) {
    throw new Error(
      `일회용 테스트 DB 이름이 아닙니다: ${dbName} (umc_movie_test 또는 umc_movie_test_xxx 만 허용)`,
    );
  }
}

const sqlFile = (name: string) =>
  readFileSync(new URL(`../../sql/${name}`, import.meta.url), 'utf8');

/** schema.sql·seed.sql 이 쓰는 DB 이름(umc_movie)을 테스트 DB 이름으로 바꿔 끼운다. */
const forTestDb = (sql: string, dbName: string) =>
  sql.replaceAll('umc_movie', dbName);

async function connect() {
  return mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
}

/**
 * 테스트 DB 를 비우고 schema.sql + seed.sql 로 새로 만든다.
 * 쓰기 테스트가 행을 만들고 지워도 개발용 umc_movie 데이터는 그대로 남는다.
 */
export async function createTestDatabase(
  dbName: string = TEST_DB_NAME,
): Promise<void> {
  assertDisposable(dbName);
  const connection = await connect();
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await connection.query(forTestDb(sqlFile('schema.sql'), dbName));
    await connection.query(forTestDb(sqlFile('seed.sql'), dbName));
  } finally {
    await connection.end();
  }
}

/** 테스트가 끝나면 테스트 DB 를 지운다. 일회용 이름이 아니면 지우지 않는다. */
export async function dropTestDatabase(
  dbName: string = TEST_DB_NAME,
): Promise<void> {
  assertDisposable(dbName);
  const connection = await connect();
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  } finally {
    await connection.end();
  }
}
