/**
 * 6주차부터 쓰기 API의 성공·실패가 똑같이 따르는 응답 틀.
 *
 *   { "isSuccess": true,  "code": "COMMON201", "message": "...", "result": {...} }
 *   { "isSuccess": false, "code": "MEMBER4091", "message": "...", "result": null }
 *
 * 5주차 조회 API(중복 확인·평점 목록)의 "성공" 본문은 이미 화면이 그대로 쓰고 있어서
 * 감싸지 않는다. 대신 실패는 어느 API에서든 이 틀로 내려간다(AllExceptionsFilter).
 */
export class ApiResponse<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T | null;

  static success<T>(code: string, message: string, result: T | null) {
    return { isSuccess: true, code, message, result } as ApiResponse<T>;
  }

  static fail(code: string, message: string) {
    return {
      isSuccess: false,
      code,
      message,
      result: null,
    } as ApiResponse<null>;
  }
}
