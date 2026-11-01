import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '@mrun/contracts';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../authz/guards/permissions.guard';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { AssignmentsService } from './assignments.service';
import { GrantsService } from './grants.service';
import { AssignRoleDto, CreateGrantDto } from '../dto/iam.dto';

@ApiTags('assignments')
@ApiBearerAuth('access-token')
@Controller('assignments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  @RequirePermission('roles:read')
  list(
    @Query('userId') userId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('roleId') roleId?: string,
    @Query('status') status?: string,
  ) {
    return this.assignments.list({
      userId: userId ? Number(userId) : undefined,
      organizationId,
      roleId,
      status: status as never,
    });
  }

  @Post()
  @RequirePermission('roles:assign')
  assign(@Body() dto: AssignRoleDto, @CurrentUser() user: JwtPayload) {
    return this.assignments.assign(dto, user.sub);
  }

  @Delete(':id')
  @RequirePermission('roles:assign')
  revoke(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.assignments.revoke(id, user.sub);
  }
}

@ApiTags('grants')
@ApiBearerAuth('access-token')
@Controller('grants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GrantsController {
  constructor(private readonly grants: GrantsService) {}

  @Get()
  @RequirePermission('roles:read')
  list(
    @Query('organizationId') organizationId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.grants.list({ organizationId, resourceType, resourceId });
  }

  @Post()
  @RequirePermission('roles:manage')
  create(@Body() dto: CreateGrantDto, @CurrentUser() user: JwtPayload) {
    return this.grants.create(dto, user.sub);
  }

  @Delete(':id')
  @RequirePermission('roles:manage')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.grants.remove(id, user.sub);
    return { ok: true };
  }
}
