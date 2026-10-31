import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { Public } from '../auth-service/public.decorator';
import { LoginDto } from 'src/auth-service/dto/auth-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Public()
  @Post('login')
  login(@Query() loginDto: LoginDto, @Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('USERS_SERVICE_URL', req, res);
  }

  @Get('me')
  me(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward('USERS_SERVICE_URL', req, res);
  }
}
