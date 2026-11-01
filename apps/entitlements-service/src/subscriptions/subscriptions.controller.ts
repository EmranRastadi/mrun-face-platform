import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload, SubscriptionStatus } from '@mrun/contracts';
import { RequirePermission } from '../auth/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import {
  CreateOrganizationSubscriptionDto,
  CreateRobotSubscriptionDto,
  UpdateOrganizationSubscriptionDto,
} from '../dto/entitlements.dto';

@ApiTags('subscriptions')
@ApiBearerAuth('access-token')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @RequirePermission('subscriptions:read')
  list(
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: SubscriptionStatus,
  ) {
    return this.subscriptions.listOrganizationSubscriptions({
      organizationId,
      status,
    });
  }

  @Post()
  @RequirePermission('subscriptions:manage')
  create(
    @Body() dto: CreateOrganizationSubscriptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.subscriptions.createOrganizationSubscription(dto, user.sub);
  }

  @Get(':id')
  @RequirePermission('subscriptions:read')
  get(@Param('id') id: string) {
    return this.subscriptions.getOrganizationSubscription(id);
  }

  @Patch(':id')
  @RequirePermission('subscriptions:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationSubscriptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.subscriptions.updateOrganizationSubscription(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermission('subscriptions:manage')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.subscriptions.cancelOrganizationSubscription(id, user.sub);
  }
}

@ApiTags('robot-subscriptions')
@ApiBearerAuth('access-token')
@Controller('robot-subscriptions')
export class RobotSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @RequirePermission('subscriptions:read')
  list(
    @Query('organizationId') organizationId?: string,
    @Query('robotId') robotId?: string,
    @Query('status') status?: SubscriptionStatus,
  ) {
    return this.subscriptions.listRobotSubscriptions({
      organizationId,
      robotId,
      status,
    });
  }

  @Post()
  @RequirePermission('subscriptions:manage')
  create(
    @Body() dto: CreateRobotSubscriptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.subscriptions.createRobotSubscription(dto, user.sub);
  }

  @Get(':id')
  @RequirePermission('subscriptions:read')
  get(@Param('id') id: string) {
    return this.subscriptions.getRobotSubscription(id);
  }

  @Delete(':id')
  @RequirePermission('subscriptions:manage')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.subscriptions.cancelRobotSubscription(id, user.sub);
  }
}
