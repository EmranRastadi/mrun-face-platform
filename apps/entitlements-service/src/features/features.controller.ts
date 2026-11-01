import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/permissions.decorator';
import { FeaturesService } from './features.service';
import { CreateFeatureDto, UpdateFeatureDto } from '../dto/entitlements.dto';

@ApiTags('features')
@ApiBearerAuth('access-token')
@Controller('features')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get()
  @RequirePermission('plans:read')
  list(@Query('category') category?: string) {
    return this.features.list(category);
  }

  @Get(':key')
  @RequirePermission('plans:read')
  get(@Param('key') key: string) {
    return this.features.get(key);
  }

  @Post()
  @RequirePermission('plans:manage')
  create(@Body() dto: CreateFeatureDto) {
    return this.features.create(dto);
  }

  @Patch(':key')
  @RequirePermission('plans:manage')
  update(@Param('key') key: string, @Body() dto: UpdateFeatureDto) {
    return this.features.update(key, dto);
  }
}
