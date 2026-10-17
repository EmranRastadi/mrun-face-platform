import axios, { AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UserCreateDto } from './dto/user-create.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  userBaseUrl: string | undefined = undefined;
  constructor(private configService: ConfigService) {
    this.userBaseUrl = this.configService.get<string>('USERS_SERVICE_URL');
  }

  private ensureConfigured() {
    if (!this.userBaseUrl) {
      throw new HttpException(
        'USERS_SERVICE_URL is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async getUsers() {
    this.ensureConfigured();
    try {
      const users: AxiosResponse<any, any> = await axios(
        `${this.userBaseUrl}/users`,
        { method: 'GET', timeout: 5000 },
      );
      return { results: users.data as unknown };
    } catch (err) {
      this.logger.error(
        `GET /users upstream failed: ${(err as Error).message}`,
      );
      throw new HttpException(
        'users-service unavailable',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
  async createUser(body: UserCreateDto) {
    this.ensureConfigured();
    try {
      const users: AxiosResponse<any, any> = await axios(
        `${this.userBaseUrl}/users`,
        { method: 'POST', data: body, timeout: 5000 },
      );
      return { results: users.data as unknown };
    } catch (err) {
      this.logger.error(
        `POST /users upstream failed: ${(err as Error).message}`,
      );
      throw new HttpException(
        'users-service unavailable',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
