import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserCreateDto } from './dto/user-create.dto';
import { UserUpdateDto } from './dto/user-update.dto';
import { UserRoleUpdateDto } from './dto/user-role-update.dto';
import { Roles } from '../auth-service/roles.decorator';
import { Role } from '@mrun/contracts';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List users (admin only)' })
  getUsers(@Headers('authorization') authorization?: string) {
    return this.usersService.getUsers(authorization);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a user (admin only)' })
  createUser(
    @Body() body: UserCreateDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.usersService.createUser(body, authorization);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user (admin or self)' })
  getUser(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization?: string,
  ) {
    return this.usersService.getUser(id, authorization);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Change a user role (admin only)' })
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UserRoleUpdateDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.usersService.updateRole(id, body, authorization);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (admin or self)' })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UserUpdateDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.usersService.updateUser(id, body, authorization);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  async removeUser(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization?: string,
  ) {
    await this.usersService.deleteUser(id, authorization);
  }
}
