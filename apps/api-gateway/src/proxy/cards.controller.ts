import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@ApiTags('cards')
@ApiBearerAuth('access-token')
@Controller('cards')
export class CardsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  forwardRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('CARDS_SERVICE_URL', req, res);
  }

  @All('*')
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('CARDS_SERVICE_URL', req, res);
  }
}
