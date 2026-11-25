import { HttpStatus, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiException } from '../exception/api.exception.js';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const MAX_TRACKED_IPS = 10_000;

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private nextCleanup = 0;

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    if (now >= this.nextCleanup) {
      for (const [key, window] of this.attempts) {
        if (window.expiresAt <= now) this.attempts.delete(key);
      }
      this.nextCleanup = now + WINDOW_MS;
    }

    const window = this.attempts.get(ip);
    if (!window || window.expiresAt <= now) {
      if (!window && this.attempts.size >= MAX_TRACKED_IPS) {
        this.reject(http.getResponse<Response>(), this.nextCleanup - now);
      }
      this.attempts.set(ip, { count: 1, expiresAt: now + WINDOW_MS });
      return true;
    }

    if (window.count >= MAX_ATTEMPTS) {
      this.reject(http.getResponse<Response>(), window.expiresAt - now);
    }
    window.count++;
    return true;
  }

  private reject(response: Response, retryInMs: number): never {
    response.setHeader('Retry-After', Math.ceil(retryInMs / 1000));
    throw new ApiException(
      HttpStatus.TOO_MANY_REQUESTS,
      'COMMON429',
      '로그인 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    );
  }
}