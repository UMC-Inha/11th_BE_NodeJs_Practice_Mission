// 7주차 Postman Collection 을 Newman 으로 실제 서버(node dist/main.js, PORT 3100)에 보내
// 결과를 evidence/week07-newman.json 에 남긴다. 일회용 테스트 DB(umc_movie_test_newman7)만 쓰고 끝나면 지운다.
// Newman 리포트에 들어간 JWT 는 서명 부분을 가려서 저장한다.
// npm run newman:week07
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import {
  adminConnection,
  createDisposableDb,
  dropDisposableDb,
  maskTokens,
  startServer,
} from './lib/live.mjs';

const DB = 'umc_movie_test_newman7';
const REPORT = 'evidence/week07-newman.json';
const admin = await adminConnection();
await createDisposableDb(admin, DB);
const server = await startServer({ dbName: DB });

try {
  const code = await new Promise((resolve) => {
    const child = spawn(
      'npx',
      [
        '--yes',
        'newman',
        'run',
        'evidence/week07.postman_collection.json',
        '--env-var',
        `baseUrl=${server.base}`,
        '--reporters',
        'cli,json',
        '--reporter-json-export',
        REPORT,
      ],
      { stdio: 'inherit' },
    );
    child.on('close', resolve);
  });
  // 리포트에는 요청/응답 원문이 들어 있어서 토큰 서명을 가린 뒤 다시 저장한다.
  const raw = await readFile(REPORT, 'utf8');
  await writeFile(REPORT, maskTokens(raw));
  process.exitCode = code ?? 1;
} finally {
  await server.stop();
  await dropDisposableDb(admin, DB);
  await admin.end();
}
