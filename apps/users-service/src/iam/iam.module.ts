import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { SecurityModule } from '../auth/security.module';
import { User } from '../users/users.entity';
import { Organization } from './entities/organization.entity';
import { OrgMembership } from './entities/org-membership.entity';
import { OrgUnit } from './entities/org-unit.entity';
import { OrgUnitMember } from './entities/org-unit-member.entity';
import { Permission } from './entities/permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { PermissionGroupItem } from './entities/permission-group-item.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { RolePermissionGroup } from './entities/role-permission-group.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { ResourceGrant } from './entities/resource-grant.entity';
import { AuthorizationPolicy } from './entities/authorization-policy.entity';
import { ResourceRegistryEntry } from './entities/resource-registry.entity';
import { PrincipalVersion } from './entities/principal-version.entity';
import { OutboxEvent } from './entities/outbox-event.entity';

import { AuthzService } from './authz/authz.service';
import { AuthzController } from './authz/authz.controller';
import { PermissionsGuard } from './authz/guards/permissions.guard';

import { PermissionsService } from './rbac/permissions.service';
import { RolesService } from './rbac/roles.service';
import { AssignmentsService } from './rbac/assignments.service';
import { GrantsService } from './rbac/grants.service';
import {
  PermissionsController,
  RolesController,
} from './rbac/roles.controller';
import {
  AssignmentsController,
  GrantsController,
} from './rbac/assignments.controller';

import { OrganizationsService } from './organizations/organizations.service';
import { OrganizationsController } from './organizations/organizations.controller';
import { OrgUnitsService } from './org-units/org-units.service';
import {
  OrganizationUnitsController,
  OrgUnitsController,
} from './org-units/org-units.controller';
import { IamSeedService } from './seed/iam-seed.service';

const ENTITIES = [
  User,
  Organization,
  OrgMembership,
  OrgUnit,
  OrgUnitMember,
  Permission,
  PermissionGroup,
  PermissionGroupItem,
  Role,
  RolePermission,
  RolePermissionGroup,
  RoleAssignment,
  ResourceGrant,
  AuthorizationPolicy,
  ResourceRegistryEntry,
  PrincipalVersion,
  OutboxEvent,
];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES), UsersModule, SecurityModule],
  controllers: [
    AuthzController,
    OrganizationsController,
    OrganizationUnitsController,
    OrgUnitsController,
    RolesController,
    PermissionsController,
    AssignmentsController,
    GrantsController,
  ],
  providers: [
    AuthzService,
    PermissionsGuard,
    PermissionsService,
    RolesService,
    AssignmentsService,
    GrantsService,
    OrganizationsService,
    OrgUnitsService,
    IamSeedService,
  ],
  exports: [
    AuthzService,
    PermissionsService,
    RolesService,
    AssignmentsService,
    GrantsService,
    OrganizationsService,
    IamSeedService,
  ],
})
export class IamModule {}
