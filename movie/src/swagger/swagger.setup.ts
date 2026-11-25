import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_UI_PATH = 'api-docs';
export const SWAGGER_JSON_PATH = 'api-docs-json';

/**
 * Swagger UI(/api-docs)와 OpenAPI JSON(/api-docs-json)을 붙인다.
 * 토큰이 필요한 API 에는 컨트롤러의 @ApiBearerAuth() 가 자물쇠를 붙이고,
 * 화면 위쪽 Authorize 버튼에 로그인으로 받은 accessToken 을 넣으면 요청에 Authorization: Bearer 가 실린다.
 * 요청 검증(ValidationPipe)·오류 틀(AllExceptionsFilter)은 이 문서와 상관없이 그대로 동작한다.
 */
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('MovieLog API')
    .setDescription(
      '영화 평점 서비스. 🔒 표시가 있는 API 는 Authorization: Bearer {accessToken} 헤더가 필요하다. 성공·실패 응답은 모두 { isSuccess, code, message, result } 틀을 따른다(5주차 조회 API 의 성공 본문만 예외).',
    )
    .setVersion('9주차')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
  });
  return document;
}
