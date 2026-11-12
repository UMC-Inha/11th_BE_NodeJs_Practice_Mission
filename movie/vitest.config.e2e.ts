import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // 일회용 JWT 키·유효시간을 앱이 만들어지기 전에 환경변수에 넣는다.
    setupFiles: ['./test/support/env.ts'],
  },
});
