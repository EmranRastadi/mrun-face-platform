import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Request, Response } from 'express';

/**
 * Generic reverse proxy: forwards an incoming request to a backend service
 * resolved from an environment variable (e.g. ENROLLMENT_SERVICE_URL).
 */
@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly config: ConfigService) {}

  async forward(envKey: string, req: Request, res: Response): Promise<void> {
    const baseUrl = this.config.get<string>(envKey);
    if (!baseUrl) {
      res.status(503).json({ error: `${envKey} is not configured` });
      return;
    }
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    const target = `${baseUrl}${req.path}${query}`;

    try {
      const response = await axios({
        url: target,
        method: req.method,
        data: req.body as unknown,
        headers: {
          'content-type': req.headers['content-type'] ?? 'application/json',
        },
        validateStatus: () => true,
      });
      res.status(response.status).json(response.data);
    } catch (err) {
      this.logger.error(`Proxy to ${target} failed: ${(err as Error).message}`);
      res.status(502).json({ error: 'upstream unavailable', target });
    }
  }
}
