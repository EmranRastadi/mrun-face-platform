import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  GrantEffect,
  GrantSubjectType,
  MembershipStatus,
  OrganizationKind,
  OrganizationStatus,
  OrgUnitKind,
  ScopeType,
} from '@mrun/contracts';

const SLUG = /^[a-z0-9]([a-z0-9-]{1,78}[a-z0-9])?$/;
const ROLE_KEY = /^[a-z][a-z0-9_]{2,79}$/;

export class CreateOrganizationDto {
  @IsEnum(OrganizationKind)
  kind: OrganizationKind;

  @IsString()
  @Matches(SLUG, {
    message: 'slug must be lowercase alphanumeric with dashes (3-80 chars)',
  })
  slug: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AddMemberDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  employee_no?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  employee_no?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class CreateOrgUnitDto {
  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsEnum(OrgUnitKind)
  kind: OrgUnitKind;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  manager_user_id?: number | null;
}

export class UpdateOrgUnitDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  manager_user_id?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

export class CreateRoleDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @Matches(ROLE_KEY)
  key: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groups?: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_assignable?: boolean;
}

export class SetRolePermissionsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groups?: string[];
}

export class AssignRoleDto {
  @IsInt()
  @Min(1)
  userId: number;

  @IsUUID()
  roleId: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsEnum(ScopeType)
  scopeType?: ScopeType;

  @IsOptional()
  @IsUUID()
  scopeId?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class CreateGrantDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MaxLength(40)
  resourceType: string;

  @IsString()
  @MaxLength(120)
  resourceId: string;

  @IsEnum(GrantSubjectType)
  subjectType: GrantSubjectType;

  @IsString()
  @MaxLength(120)
  subjectId: string;

  @IsString()
  @MaxLength(96)
  permissionKey: string;

  @IsOptional()
  @IsEnum(GrantEffect)
  effect?: GrantEffect;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class AuthzCheckDto {
  @IsString()
  @MaxLength(96)
  permission: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string | null;

  @IsOptional()
  @IsEnum(ScopeType)
  scopeType?: ScopeType | null;

  @IsOptional()
  @IsUUID()
  scopeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  resourceType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  resourceId?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class AddOrgUnitMemberDto {
  @IsInt()
  @Min(1)
  userId: number;

  @IsOptional()
  @IsBoolean()
  is_lead?: boolean;
}
