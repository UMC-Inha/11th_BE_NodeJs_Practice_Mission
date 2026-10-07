import mysql from 'mysql2/promise';
const source = process.env.DB_NAME;
const target = 'umc_week04_library';
if (!source || source === target)
  throw new Error('3주차 DB_NAME으로 실행하세요.');
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
try {
  const [existing] = await connection.execute(
    'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
    [target],
  );
  if (existing.length)
    throw new Error('4주차 DB가 이미 있습니다. 덮어쓰지 않습니다.');
  await connection.query(
    `CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    [target],
  );
  for (const table of ['category', 'users', 'book', 'rental']) {
    const [rows] = await connection.query('SHOW CREATE TABLE ??.??', [
      source,
      table,
    ]);
    await connection.query(`USE ??`, [target]);
    await connection.query(rows[0]['Create Table']);
    await connection.query('INSERT INTO ??.?? SELECT * FROM ??.??', [
      target,
      table,
      source,
      table,
    ]);
  }
  console.log('3주차 DB를 보존한 채 umc_week04_library 복사 완료');
} finally {
  await connection.end();
}
