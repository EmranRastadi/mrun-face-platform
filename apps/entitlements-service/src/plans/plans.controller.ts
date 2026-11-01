import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '@mrun/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/permissions.decorator';
import { PlansService } from './plans.service';
import {
  CreatePlanDto,
  SetPlanFeaturesDto,
  UpdatePlanDto,
} from '../dto/entitlements.dto';

@ApiTags('plans')
@ApiBearerAuth('access-token')
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @RequirePermission('plans:read')
  list(@Query('includeRetired') includeRetired?: string) {
    return this.plans.list(includeRetired === 'true');
  }

  @Get(':id')
  @RequirePermission('plans:read')
  get(@Param('id') id: string) {
    return this.plans.get(id);
  }

  @Post()
  @RequirePermission('plans:manage')
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: JwtPayload) {
    return this.plans.create(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermission('plans:manage')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  @Put(':id/features')
  @RequirePermission('plans:manage')
  setFeatures(@Param('id') id: string, @Body() dto: SetPlanFeaturesDto) {
    return this.plans.setFeatures(id, dto);
  }
}
