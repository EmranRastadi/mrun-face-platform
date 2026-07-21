import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
    };
  }
  @Get('users')
  users() {
    return {
      results: [
        {
          name: 'emran',
          age: 33,
        },
      ],
    };
  }
}
