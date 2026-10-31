import axios, { AxiosResponse, Method } from 'axios';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UserCreateDto } from './dto/user-create.dto';
import { UserUpdateDto } from './dto/user-update.dto';
import { UserRoleUpdateDto } from './dto/user-role-update.dto';

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

  private authHeaders(authorization?: string) {
    return authorization ? { authorization } : undefined;
  }

  private async request(
    method: Method,
    path: string,
    authorization?: string,
    data?: unknown,
  ) {
    this.ensureConfigured();
    try {
      const response: AxiosResponse<unknown, unknown> = await axios(
        `${this.userBaseUrl}${path}`,
        {
          method,
          data,
          timeout: 5000,
          headers: this.authHeaders(authorization),
        },
      );
      return { results: response.data };
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const body = axios.isAxiosError(err) ? err.response?.data : undefined;
      this.logger.error(
        `${method} ${path} upstream failed: ${(err as Error).message}`,
      );
      throw new HttpException(
        (body as Record<string, unknown> | string | undefined) ??
          'users-service unavailable',
        status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }

  getUsers(authorization?: string) {
    return this.request('GET', '/users', authorization);
  }

  createUser(body: UserCreateDto, authorization?: string) {
    return this.request('POST', '/users', authorization, body);
  }

  getUser(id: number, authorization?: string) {
    return this.request('GET', `/users/${id}`, authorization);
  }

  updateUser(id: number, body: UserUpdateDto, authorization?: string) {
    return this.request('PATCH', `/users/${id}`, authorization, body);
  }

  updateRole(id: number, body: UserRoleUpdateDto, authorization?: string) {
    return this.request('PATCH', `/users/${id}/role`, authorization, body);
  }

  async deleteUser(id: number, authorization?: string) {
    await this.request('DELETE', `/users/${id}`, authorization);
  }
}
