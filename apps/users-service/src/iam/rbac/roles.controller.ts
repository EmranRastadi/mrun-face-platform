import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '@mrun/contracts';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../authz/guards/permissions.guard';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import {
  CreateRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from '../dto/iam.dto';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  @RequirePermission('roles:read')
  list(@Query('organizationId') organizationId?: string) {
    return this.roles.list(organizationId ?? null);
  }

  @Post()
  @RequirePermission('roles:manage')
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.roles.create(dto, user.sub);
  }

  @Get(':id')
  @RequirePermission('roles:read')
  get(@Param('id') id: string) {
    return this.roles.get(id);
  }

  @Patch(':id')
  @RequirePermission('roles:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.roles.update(id, dto, user.sub);
  }

  @Put(':id/permissions')
  @RequirePermission('roles:manage')
  setPermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.roles.setPermissions(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermission('roles:manage')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.roles.remove(id, user.sub);
    return { ok: true };
  }
}

@ApiTags('permissions')
@ApiBearerAuth('access-token')
@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  list() {
    return this.permissions.list();
  }

  @Get('groups')
  listGroups(@Query('organizationId') organizationId?: string) {
    return this.permissions.listGroups(organizationId ?? null);
  }
}
