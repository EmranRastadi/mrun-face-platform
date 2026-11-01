import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureValueType } from '@mrun/contracts';
import { Feature } from './feature.entity';
import { CreateFeatureDto, UpdateFeatureDto } from '../dto/entitlements.dto';
import { FEATURE_CATALOG } from '../constants/feature-catalog';

@Injectable()
export class FeaturesService {
  constructor(
    @InjectRepository(Feature)
    private readonly features: Repository<Feature>,
  ) {}

  list(category?: string): Promise<Feature[]> {
    return this.features.find({
      where: category ? { category } : {},
      order: { category: 'ASC', key: 'ASC' },
    });
  }

  async get(key: string): Promise<Feature> {
    const feature = await this.getOptional(key);
    if (!feature) throw new NotFoundException(`Feature ${key} not found`);
    return feature;
  }

  getOptional(key: string): Promise<Feature | null> {
    return this.features.findOne({ where: { key } });
  }

  async create(dto: CreateFeatureDto): Promise<Feature> {
    const existing = await this.features.findOne({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException(`Feature ${dto.key} already exists`);
    }
    return this.features.save(
      this.features.create({
        key: dto.key,
        name: dto.name,
        description: dto.description ?? '',
        value_type: dto.valueType ?? FeatureValueType.BOOLEAN,
        unit: dto.unit ?? null,
        category: dto.category ?? 'general',
        is_system: false,
      }),
    );
  }

  async update(key: string, dto: UpdateFeatureDto): Promise<Feature> {
    const feature = await this.get(key);
    if (dto.name !== undefined) feature.name = dto.name;
    if (dto.description !== undefined) feature.description = dto.description;
    if (dto.valueType !== undefined) feature.value_type = dto.valueType;
    if (dto.unit !== undefined) feature.unit = dto.unit;
    if (dto.category !== undefined) feature.category = dto.category;
    return this.features.save(feature);
  }

  /** Upsert the built-in catalog so new features appear after a deploy. */
  async seedCatalog(): Promise<void> {
    const existing = await this.features.find();
    const byKey = new Map(existing.map((row) => [row.key, row]));
    const toSave: Feature[] = [];

    for (const definition of FEATURE_CATALOG) {
      const row = byKey.get(definition.key);
      if (row) {
        row.name = definition.name;
        row.description = definition.description;
        row.value_type = definition.value_type;
        row.unit = definition.unit;
        row.category = definition.category;
        row.is_system = true;
        toSave.push(row);
      } else {
        toSave.push(
          this.features.create({
            ...definition,
            is_system: true,
          }),
        );
      }
    }
    if (toSave.length) await this.features.save(toSave);
  }
}
