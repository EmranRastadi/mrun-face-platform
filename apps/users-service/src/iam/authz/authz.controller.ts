import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '@mrun/contracts';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthzService } from './authz.service';
import { AuthzCheckDto } from '../dto/iam.dto';

@ApiTags('authz')
@ApiBearerAuth('access-token')
@Controller('authz')
@UseGuards(JwtAuthGuard)
export class AuthzController {
  constructor(private readonly authz: AuthzService) {}

  /** Self-check: evaluates a permission for the calling user. */
  @Post('check')
  check(@Body() dto: AuthzCheckDto, @CurrentUser() user: JwtPayload) {
    return this.authz.check(user.sub, dto);
  }

  @Get('me/permissions')
  async myPermissions(
    @CurrentUser() user: JwtPayload,
    @Query('organizationId') organizationId?: string,
  ) {
    const context = await this.authz.tokenContext(user.sub);
    const orgId = organizationId ?? context.activeOrganizationId;
    const effective = await this.authz.effectivePermissions(user.sub, orgId);
    return {
      organizationId: orgId,
      platformStaff: context.platformStaff,
      permissionVersion: context.permissionVersion,
      ...effective,
    };
  }
}
