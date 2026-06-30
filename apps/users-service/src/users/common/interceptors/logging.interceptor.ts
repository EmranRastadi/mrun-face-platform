import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const { method, url, body, params, query } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const response = ctx.getResponse();
        const duration = Date.now() - startTime;

        this.logger.log(
          JSON.stringify({
            method,
            url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            body: method !== 'GET' ? body : undefined,
            params,
            query,
            response: data,
          }),
        );
      }),
    );
  }
}