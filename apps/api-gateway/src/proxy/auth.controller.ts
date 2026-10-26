import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { Public } from '../auth/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Public()
  @Post('login')
  login(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('USERS_SERVICE_URL', req, res);
  }

  @Get('me')
  me(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('USERS_SERVICE_URL', req, res);
  }
}
