import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Request, Response } from 'express';
import { ConsulService } from '../consul';

/**
 * Generic reverse proxy: forwards an incoming request to a backend service.
 *
 * Target resolution:
 * 1. If CONSUL_ENABLED=true and the service is registered & healthy in Consul,
 *    the address is resolved dynamically from the Consul catalog.
 * 2. Otherwise it falls back to the static *_SERVICE_URL env variable.
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

// Maps a proxy env key to the service name registered in Consul.
const TARGET_SERVICE_NAME: Record<string, string> = {
  USERS_SERVICE_URL: 'users-service',
  ENROLLMENT_SERVICE_URL: 'enrollment-service',
  CARDS_SERVICE_URL: 'mrun-cards',
  AUDIT_SERVICE_URL: 'audit-service',
  NOTIFICATION_SERVICE_URL: 'notification-service',
  ANALYTICS_SERVICE_URL: 'analytics-service',
  IDENTITY_SERVICE_URL: 'identity-service',
};

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly consul: ConsulService,
  ) {}

  private get consulEnabled(): boolean {
    return this.config.get<string>('CONSUL_ENABLED', 'false') === 'true';
  }

  // Resolve the upstream base URL, preferring Consul discovery over static env.
  private async resolveBaseUrl(envKey: string): Promise<string | undefined> {
    const staticUrl = this.config.get<string>(envKey);

    if (this.consulEnabled) {
      const serviceName = TARGET_SERVICE_NAME[envKey];
      if (serviceName) {
        const instance = await this.consul.resolve(serviceName);
        if (instance?.Address && instance?.Port) {
          return `http://${instance.Address}:${instance.Port}`;
        }
        this.logger.warn(
          `Consul could not resolve "${serviceName}"; falling back to ${envKey}`,
        );
      }
    }

    return staticUrl;
  }

  async forward(envKey: string, req: Request, res: Response): Promise<void> {
    if (!ALLOWED_PROXY_TARGETS.has(envKey)) {
      res.status(403).json({ error: `proxy target not allowed` });
      return;
    }
    const baseUrl = await this.resolveBaseUrl(envKey);
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
