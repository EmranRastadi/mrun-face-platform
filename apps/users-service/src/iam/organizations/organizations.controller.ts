import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '@mrun/contracts';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../authz/guards/permissions.guard';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { OrganizationsService } from './organizations.service';
import {
  AddMemberDto,
  CreateOrganizationDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
} from '../dto/iam.dto';

@ApiTags('organizations')
@ApiBearerAuth('access-token')
@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.organizations.listForUser(user.sub);
  }

  @Post()
  @RequirePermission('organizations:manage')
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: JwtPayload) {
    return this.organizations.create(dto, user.sub);
  }

  @Get(':organizationId')
  @RequirePermission('org.profile:read')
  get(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.organizations.get(organizationId, user.sub);
  }

  @Patch(':organizationId')
  @RequirePermission('org.profile:manage')
  update(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(organizationId, dto);
  }

  @Get(':organizationId/members')
  @RequirePermission('org.members:read')
  listMembers(@Param('organizationId') organizationId: string) {
    return this.organizations.listMembers(organizationId);
  }

  @Post(':organizationId/members')
  @RequirePermission('org.members:manage')
  addMember(
    @Param('organizationId') organizationId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.organizations.addMember(organizationId, dto, user.sub);
  }

  @Patch(':organizationId/members/:userId')
  @RequirePermission('org.members:manage')
  updateMember(
    @Param('organizationId') organizationId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.organizations.updateMember(organizationId, userId, dto);
  }

  @Delete(':organizationId/members/:userId')
  @RequirePermission('org.members:manage')
  async removeMember(
    @Param('organizationId') organizationId: string,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.organizations.removeMember(organizationId, userId);
    return { ok: true };
  }
}
