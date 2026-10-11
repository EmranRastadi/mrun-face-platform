import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Request, Response } from 'express';

/**
 * Generic reverse proxy: forwards an incoming request to a backend service
 * resolved from an environment variable (e.g. ENROLLMENT_SERVICE_URL).
 *
 * Best-practice hardening:
 * - allowlist of env keys (no arbitrary SSRF target)
 * - upstream timeout (5s) so gateway never hangs
 * - strips hop-by-hop headers, forwards auth/content-type only
 * - never leaks internal target URL to the client on errors
 */
const ALLOWED_PROXY_TARGETS = new Set([
  'USERS_SERVICE_URL',
  'ENROLLMENT_SERVICE_URL',
  'CARDS_SERVICE_URL',
  'AUDIT_SERVICE_URL',
  'NOTIFICATION_SERVICE_URL',
  'ANALYTICS_SERVICE_URL',
  'IDENTITY_SERVICE_URL',
]);
@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly config: ConfigService) {}

  async forward(envKey: string, req: Request, res: Response): Promise<void> {
    if (!ALLOWED_PROXY_TARGETS.has(envKey)) {
      res.status(403).json({ error: `proxy target not allowed` });
      return;
    }
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
        timeout: 5000,
        headers: {
          'content-type': req.headers['content-type'] ?? 'application/json',
          ...(req.headers.authorization
            ? { authorization: req.headers.authorization }
            : {}),
        },
        validateStatus: () => true,
      });
      res.status(response.status).json(response.data);
    } catch (err) {
      this.logger.error(`Proxy to ${envKey} failed: ${(err as Error).message}`);
      res.status(502).json({ error: 'upstream unavailable' });
    }
  }
}
