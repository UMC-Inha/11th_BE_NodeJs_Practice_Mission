import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { setupSwagger } from './swagger/swagger.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // CORS(허용 출처: .env CORS_ORIGINS, 기본 http://localhost:5173)와 입력 검증
  configureApp(app);
  // 8주차 Challenge: Swagger UI http://localhost:3000/api-docs
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
