import {Body, Controller, Get, Post} from '@nestjs/common';
import { UsersService } from './users.service';
import {UserCreateDto} from "./dto/user-create.dto"
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }
  @Post()
  createUser(@Body() body: UserCreateDto) {

    return this.usersService.createUser(body);
  }
}
