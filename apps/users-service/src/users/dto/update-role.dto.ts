import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role, type UpdateRolePayload } from '@mrun/contracts';

export class UpdateRoleDto implements UpdateRolePayload {
  @ApiProperty({ enum: Role, example: Role.VIEWER })
  @IsEnum(Role)
  role: Role;
}
