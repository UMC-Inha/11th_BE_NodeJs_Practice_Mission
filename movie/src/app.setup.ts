import { INestApplication, ValidationPipe } from '@nestjs/common';

export const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

/**
 * .env 의 CORS_ORIGINS(쉼표 구분)를 허용 출처로 바꾼다.
 * - 비어 있으면 기본값 http://localhost:5173 하나만 허용
 * - "*" 이면 모든 출처 허용 (선택 미션 비교 실험용. 평소에는 쓰지 않는다)
 */
export function parseCorsOrigins(raw: string | undefined): string | string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (origins.includes('*')) return '*';
  return origins.length > 0 ? origins : [DEFAULT_CORS_ORIGIN];
}

/** main.ts 와 테스트가 똑같은 CORS·검증 설정을 쓰도록 한곳에 모은다. */
export function configureApp(
  app: INestApplication,
  corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS),
): void {
  app.enableCors({
    // 우리 화면 주소만 허용한다. 목록에 없는 출처의 응답은 브라우저가 막는다.
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // page=0&size=10 처럼 문자열로 들어온 Query 를 DTO 타입(number)으로 바꾼다.
      transform: true,
      whitelist: true,
    }),
  );
}
