import axios, { AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import {UserCreateDto} from "./dto/user-create.dto";

@Injectable()
export class UsersService {
  userBaseUrl: string | undefined = undefined;
  constructor(private configService: ConfigService) {
    this.userBaseUrl = this.configService.get<string>('USERS_SERVICE_URL');
  }

  async getUsers() {
    try {
      const users: AxiosResponse<any, any> = await axios(
        `${this.userBaseUrl}/users`,
        { method: 'Get' },
      );
      return { results: users.data };
    } catch (e) {}
  }
  async createUser(body: UserCreateDto) {
    try {
      const users: AxiosResponse<any, any> = await axios(
        `${this.userBaseUrl}/users`,
        { method: 'Post' , data: body },
      );
      return { results: users.data };
    } catch (e) {}
  }
}
