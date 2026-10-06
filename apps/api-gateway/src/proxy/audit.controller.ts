import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('audit')
export class AuditProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*')
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('AUDIT_SERVICE_URL', req, res);
  }
}
