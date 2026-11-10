import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class KeycloakExchangeDto {
  @ApiProperty({
    description: 'Access token issued by the Keycloak realm',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6IC...',
  })
  @IsString()
  @MinLength(1)
  access_token: string;
}
