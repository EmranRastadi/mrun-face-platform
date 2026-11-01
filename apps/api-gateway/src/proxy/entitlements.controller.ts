import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@ApiTags('entitlements')
@ApiBearerAuth('access-token')
@Controller([
  'plans',
  'features',
  'subscriptions',
  'robot-subscriptions',
  'entitlement-overrides',
  'entitlements',
])
export class EntitlementsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  forwardRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('ENTITLEMENTS_SERVICE_URL', req, res);
  }

  @All('*')
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('ENTITLEMENTS_SERVICE_URL', req, res);
  }
}
