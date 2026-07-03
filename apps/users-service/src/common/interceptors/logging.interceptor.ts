// apps/users-service/src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // برای تولید Correlation ID

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // استفاده از Logger مخصوص این کلاس
  private readonly logger = new Logger(LoggingInterceptor.name);

  // تزریق ConfigService برای دسترسی به تنظیمات
  constructor(
    // @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

//   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
//     // دریافت درخواست (Request) از Context
//     const request = context.switchToHttp().getRequest();
//     const response = context.switchToHttp().getResponse();

//     // استخراج اطلاعات مهم از درخواست
//     const { method, url, headers, body, query, params, ip } = request;
//     const userAgent = headers['user-agent'] || 'unknown';
//     const correlationId = headers['x-correlation-id'] || uuidv4();

//     // ذخیره Correlation ID در Request برای استفاده در سایر بخش‌ها
//     request['correlationId'] = correlationId;

//     // زمان شروع پردازش (برای محاسبه تاخیر)
//     const startTime = Date.now();

//     // لاگ ورودی (Incoming Request)
//     this.logger.log({
//       event: 'request_received',
//       correlationId,
//       method,
//       url,
//       query,
//       params,
//       ip,
//       userAgent,
//       body: this.shouldLogBody(method, url) ? body : '**[REDACTED]**', // حذف بدنه در صورت نیاز
//       timestamp: new Date().toISOString(),
//     });

//     // ادامه پردازش (Execution)
//     return next.handle().pipe(
//       // در صورت موفقیت (Success)
//       tap((data) => {
//         const responseTime = Date.now() - startTime;

//         this.logger.log({
//           event: 'request_completed',
//           correlationId,
//           method,
//           url,
//           statusCode: response.statusCode,
//           responseTime: `${responseTime}ms`,
//           timestamp: new Date().toISOString(),
//         });
//       }),
//       // در صورت بروز خطا (Error)
//       catchError((error) => {
//         const responseTime = Date.now() - startTime;

//         this.logger.error({
//           event: 'request_failed',
//           correlationId,
//           method,
//           url,
//           statusCode: error.status || 500,
//           error: error.message,
//           stack: this.configService.get('nodeEnv') === 'development' ? error.stack : undefined,
//           responseTime: `${responseTime}ms`,
//           timestamp: new Date().toISOString(),
//         });

//         // انتشار مجدد خطا برای پردازش توسط فیلترهای دیگر
//         throw error;
//       }),
//     );
//   }

//   /**
//    * بررسی کنیم که آیا بدنه درخواست باید لاگ شود یا خیر
//    * برای امنیت، بدنه درخواست‌های حساس مثل login را لاگ نمی‌کنیم
//    */
//   private shouldLogBody(method: string, url: string): boolean {
//     // لیست URL هایی که نباید بدنه‌شان لاگ شود
//     const sensitiveUrls = ['/auth/login', '/auth/register', '/users/change-password'];
//     const isSensitive = sensitiveUrls.some((sensitiveUrl) => url.includes(sensitiveUrl));

//     // فقط درخواست‌های POST, PUT, PATCH را چک می‌کنیم
//     const isWriteMethod = ['POST', 'PUT', 'PATCH'].includes(method);

//     return isWriteMethod && !isSensitive;
//   }
}