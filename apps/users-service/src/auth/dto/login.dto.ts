import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import type { LoginPayload } from '@mrun/contracts';

export class LoginDto implements LoginPayload {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(1)
  password: string;
}
