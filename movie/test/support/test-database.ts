import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

/** 쓰기 e2e 전용 DB 이름. 개발용 umc_movie 와 섞이지 않는다. */
export const TEST_DB_NAME = 'umc_movie_test';

const sqlFile = (name: string) =>
  readFileSync(new URL(`../../sql/${name}`, import.meta.url), 'utf8');

/** schema.sql·seed.sql 이 쓰는 DB 이름(umc_movie)을 테스트 DB 이름으로 바꿔 끼운다. */
const forTestDb = (sql: string) => sql.replaceAll('umc_movie', TEST_DB_NAME);

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
export async function createTestDatabase(): Promise<void> {
  const connection = await connect();
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
    await connection.query(forTestDb(sqlFile('schema.sql')));
    await connection.query(forTestDb(sqlFile('seed.sql')));
  } finally {
    await connection.end();
  }
}

/** 테스트가 끝나면 테스트 DB 를 지운다. 이름이 고정이라 다른 DB 는 지울 수 없다. */
export async function dropTestDatabase(): Promise<void> {
  const connection = await connect();
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  } finally {
    await connection.end();
  }
}
