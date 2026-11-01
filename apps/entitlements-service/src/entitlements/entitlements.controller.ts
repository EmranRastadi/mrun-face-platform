import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '@mrun/contracts';
import { RequirePermission } from '../auth/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { EntitlementsService } from './entitlements.service';
import {
  ConsumeEntitlementDto,
  CreateEntitlementOverrideDto,
  EntitlementCheckDto,
} from '../dto/entitlements.dto';

@ApiTags('entitlements')
@ApiBearerAuth('access-token')
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('resolve')
  @RequirePermission('subscriptions:read')
  resolve(
    @Query('organizationId') organizationId: string,
    @Query('featureKey') featureKey: string,
    @Query('robotId') robotId?: string,
  ) {
    return this.entitlements.resolve(organizationId, featureKey, robotId);
  }

  @Post('check')
  @RequirePermission('subscriptions:read')
  check(@Body() dto: EntitlementCheckDto) {
    return this.entitlements.check(dto);
  }

  @Post('consume')
  @RequirePermission('subscriptions:manage')
  consume(
    @Body() dto: ConsumeEntitlementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entitlements.consume(dto, user.sub);
  }

  @Get('usage')
  @RequirePermission('usage:read')
  usage(
    @Query('organizationId') organizationId: string,
    @Query('featureKey') featureKey?: string,
    @Query('robotId') robotId?: string,
  ) {
    return this.entitlements.usage(organizationId, featureKey, robotId);
  }
}

@ApiTags('entitlement-overrides')
@ApiBearerAuth('access-token')
@Controller('entitlement-overrides')
export class EntitlementOverridesController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  @RequirePermission('subscriptions:read')
  list(
    @Query('organizationId') organizationId?: string,
    @Query('featureKey') featureKey?: string,
    @Query('robotId') robotId?: string,
    @Query('includeRevoked') includeRevoked?: string,
  ) {
    return this.entitlements.listOverrides({
      organizationId,
      featureKey,
      robotId,
      includeRevoked: includeRevoked === 'true',
    });
  }

  @Post()
  @RequirePermission('subscriptions:manage')
  create(
    @Body() dto: CreateEntitlementOverrideDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entitlements.createOverride(dto, user.sub);
  }

  @Delete(':id')
  @RequirePermission('subscriptions:manage')
  revoke(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.entitlements.revokeOverride(id, user.sub);
  }
}
