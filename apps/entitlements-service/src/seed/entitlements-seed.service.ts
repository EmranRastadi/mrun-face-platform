import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { FeaturesService } from '../features/features.service';

/**
 * Keeps the built-in feature catalog in sync with the deployed code. Plans are
 * commercial data and are never seeded automatically.
 */
@Injectable()
export class EntitlementsSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EntitlementsSeedService.name);

  constructor(private readonly features: FeaturesService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.features.seedCatalog();
      this.logger.log('Feature catalog is ready');
    } catch (error) {
      this.logger.error(
        `Feature catalog seed failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
