import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { UserContext } from '@petiatrics/types';
import { v4 as uuidv4 } from 'uuid';

/** 1-hour idle timeout in seconds */
const IDLE_TTL_SECONDS = 3600;
/** 12-hour absolute session lifetime in ms */
const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis;

  constructor(private readonly config: ConfigService) {}

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
    const payload: UserContext = { ...context, issuedAt: Date.now() };
    await this.redis.setex(key, IDLE_TTL_SECONDS, JSON.stringify(payload));
    return sessionId;
  }

  async getSession(sessionId: string): Promise<UserContext | null> {
    const key = `session:${sessionId}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserContext;

    // Enforce 12-hour absolute expiry
    if (parsed.issuedAt && Date.now() - parsed.issuedAt > ABSOLUTE_TTL_MS) {
      await this.redis.del(key);
      return null;
    }

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

  /** Refresh only the idle TTL — never extends beyond the 12h absolute limit */
  async refreshSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    const raw = await this.redis.get(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as UserContext;

    if (!parsed.issuedAt) return;

    const remainingAbsoluteMs = ABSOLUTE_TTL_MS - (Date.now() - parsed.issuedAt);
    if (remainingAbsoluteMs <= 0) {
      await this.redis.del(key);
      return;
    }

    // Use the smaller of the idle TTL and remaining absolute lifetime
    const newTtl = Math.min(IDLE_TTL_SECONDS, Math.floor(remainingAbsoluteMs / 1000));
    await this.redis.expire(key, newTtl);
  }
}

