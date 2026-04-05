import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { UserContext } from '@petiatrics/types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis;
  private readonly ttlSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.ttlSeconds = this.config.get<number>('SESSION_TTL_SECONDS') ?? 86400;
  }

  onModuleInit() {
    this.redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async createSession(context: UserContext): Promise<string> {
    const sessionId = uuidv4();
    const key = `session:${sessionId}`;
    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(context));
    return sessionId;
  }

  async getSession(sessionId: string): Promise<UserContext | null> {
    const key = `session:${sessionId}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserContext;
    // Backfill fields added in later migrations so old sessions degrade gracefully
    if (!Array.isArray(parsed.authorizedBranches)) {
      parsed.authorizedBranches = [];
    }
    if (parsed.clinicName === undefined) {
      parsed.clinicName = null;
    }
    if (parsed.clinicSlug === undefined) {
      parsed.clinicSlug = null;
    }
    if (parsed.mustChangePassword === undefined) {
      parsed.mustChangePassword = false;
    }
    return parsed;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  async refreshSession(sessionId: string): Promise<void> {
    await this.redis.expire(`session:${sessionId}`, this.ttlSeconds);
  }
}
