import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import axios from 'axios';

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
  // @Get('users')
  // async users() {
  //   const usersList = await axios.get(`${process.env.USERS_SERVICE_URL}/users`);
  //   return {
  //     results: usersList,
  //   };
  // }
}
