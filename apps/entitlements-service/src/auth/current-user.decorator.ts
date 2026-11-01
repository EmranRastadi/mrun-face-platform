import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@mrun/contracts';

/** Authenticated user populated by `AccessGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.user as JwtPayload | undefined;
  },
);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.principal;
  },
);
