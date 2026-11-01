import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

/**
 * IAM, RBAC and authorization endpoints. All of them live in `users-service`
 * and are protected there by `JwtAuthGuard` + `PermissionsGuard`; the gateway
 * only forwards the request and the caller's token.
 */
@ApiTags('iam')
@ApiBearerAuth('access-token')
@Controller([
  'organizations',
  'org-units',
  'permissions',
  'roles',
  'assignments',
  'grants',
  'authz',
])
export class IamProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  forwardRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('USERS_SERVICE_URL', req, res);
  }

  @All('*')
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('USERS_SERVICE_URL', req, res);
  }
}
