import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authz/guards/permissions.guard';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { OrgUnitsService } from './org-units.service';
import {
  AddOrgUnitMemberDto,
  CreateOrgUnitDto,
  UpdateOrgUnitDto,
} from '../dto/iam.dto';

@ApiTags('org-units')
@ApiBearerAuth('access-token')
@Controller('organizations/:organizationId/units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationUnitsController {
  constructor(private readonly units: OrgUnitsService) {}

  @Get()
  @RequirePermission('org.units:read')
  list(
    @Param('organizationId') organizationId: string,
    @Query('kind') kind?: string,
  ) {
    return this.units.list(organizationId, kind);
  }

  @Post()
  @RequirePermission('org.units:manage')
  create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateOrgUnitDto,
  ) {
    return this.units.create(organizationId, dto);
  }
}

@ApiTags('org-units')
@ApiBearerAuth('access-token')
@Controller('org-units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrgUnitsController {
  constructor(private readonly units: OrgUnitsService) {}

  @Patch(':unitId')
  @RequirePermission('org.units:manage')
  async update(
    @Param('unitId') unitId: string,
    @Body() dto: UpdateOrgUnitDto,
    @Query('organizationId') organizationId: string,
  ) {
    await this.assertSameOrganization(unitId, organizationId);
    return this.units.update(unitId, dto);
  }

  @Delete(':unitId')
  @RequirePermission('org.units:manage')
  async remove(
    @Param('unitId') unitId: string,
    @Query('organizationId') organizationId: string,
  ) {
    await this.assertSameOrganization(unitId, organizationId);
    await this.units.remove(unitId);
    return { ok: true };
  }

  @Get(':unitId/members')
  @RequirePermission('org.units:read')
  async listMembers(
    @Param('unitId') unitId: string,
    @Query('organizationId') organizationId: string,
  ) {
    await this.assertSameOrganization(unitId, organizationId);
    return this.units.listMembers(unitId);
  }

  @Post(':unitId/members')
  @RequirePermission('org.units:manage')
  async addMember(
    @Param('unitId') unitId: string,
    @Body() dto: AddOrgUnitMemberDto,
    @Query('organizationId') organizationId: string,
  ) {
    await this.assertSameOrganization(unitId, organizationId);
    return this.units.addMember(unitId, dto.userId, dto.is_lead ?? false);
  }

  @Delete(':unitId/members/:userId')
  @RequirePermission('org.units:manage')
  async removeMember(
    @Param('unitId') unitId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Query('organizationId') organizationId: string,
  ) {
    await this.assertSameOrganization(unitId, organizationId);
    await this.units.removeMember(unitId, userId);
    return { ok: true };
  }

  private async assertSameOrganization(
    unitId: string,
    organizationId: string,
  ): Promise<void> {
    const unit = await this.units.get(unitId);
    if (!organizationId || unit.organization_id !== organizationId) {
      throw new ForbiddenException('Org unit does not belong to this organization');
    }
  }
}
