import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    // 문자열로 던진 경우와 객체로 던진 경우를 모두 처리해요.
    const message =
      typeof body === "string"
        ? body
        : (body as { message: string | string[] }).message;

    response.status(status).json({
      isSuccess: false,
      code: "COMMON" + status,
      // class-validator는 메시지를 배열로 담으므로 첫 항목만 꺼내요.
      message: Array.isArray(message) ? message[0] : message,
      result: null,
    });
  }
}