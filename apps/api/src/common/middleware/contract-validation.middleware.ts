import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ContractValidationMiddleware
 *
 * Development-only middleware that validates API response shapes against
 * the OpenAPI contract (contracts/api.openapi.yaml). Logs mismatches as
 * warnings without blocking traffic — validation is advisory.
 *
 * Disabled automatically in production (NODE_ENV === 'production').
 */
@Injectable()
export class ContractValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ContractValidationMiddleware.name);
  private readonly enabled: boolean;
  private contractPaths: Set<string> = new Set();

  constructor() {
    this.enabled = process.env['NODE_ENV'] !== 'production';
    if (this.enabled) {
      this.loadContractPaths();
    }
  }

  private loadContractPaths(): void {
    // Resolve relative to monorepo root — works from apps/api when running
    const candidates = [
      path.resolve(process.cwd(), '../../specs/001-petiatrics-platform-all/contracts/api.openapi.yaml'),
      path.resolve(process.cwd(), 'specs/001-petiatrics-platform-all/contracts/api.openapi.yaml'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const raw = fs.readFileSync(candidate, 'utf-8');
          // Extract path keys from the YAML cheaply without a full parser
          const pathMatches = raw.match(/^  (\/[^\s:]+):/gm) ?? [];
          for (const match of pathMatches) {
            this.contractPaths.add(match.trim().replace(/:$/, ''));
          }
          this.logger.log(
            `Contract validation active — ${this.contractPaths.size} paths loaded from ${path.basename(candidate)}`,
          );
          return;
        } catch {
          this.logger.warn('Could not parse contract file — validation skipped');
        }
      }
    }
    this.logger.warn('OpenAPI contract file not found — contract validation disabled');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.enabled || this.contractPaths.size === 0) {
      return next();
    }

    const originalJson = res.json.bind(res);
    const logger = this.logger;
    const contractPaths = this.contractPaths;

    // Strip /api/v1 prefix to match contract path definitions
    const apiPath = req.path.replace(/^\/api\/v1/, '');

    // Normalize dynamic segments (e.g. /patients/abc-123 → /patients/{id})
    const normalizedPath = apiPath.replace(/\/[0-9a-f-]{8,}/gi, '/{id}');

    res.json = function (body: unknown) {
      // Validate envelope shape for non-error responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (
          body === null ||
          typeof body !== 'object' ||
          !('data' in (body as object))
        ) {
          logger.warn(
            `[Contract] ${req.method} ${apiPath} → response missing envelope { data } wrapper`,
          );
        }

        // Warn if this route is not documented in the contract
        if (
          normalizedPath !== '/' &&
          !contractPaths.has(normalizedPath) &&
          !contractPaths.has(apiPath)
        ) {
          logger.warn(
            `[Contract] ${req.method} ${apiPath} → route not documented in api.openapi.yaml`,
          );
        }
      }
      return originalJson(body);
    };

    next();
  }
}
