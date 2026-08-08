import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface RuleAction {
  debitAccountCode: string;
  creditAccountCode: string;
}

export interface EvaluationResult {
  matched: boolean;
  ruleName: string | null;
  action: RuleAction | null;
}

/**
 * Evaluates event payloads against JSON-configured SystemRule conditions.
 *
 * Rules are fetched from the database, ordered by priority DESC.
 * The first matching rule's action is returned. If no rules match, returns null.
 *
 * Supported condition operators:
 * - Plain equality: { "reasonCode": "EXPIRED" }
 * - $eq:   { "reasonCode": { "$eq": "EXPIRED" } }
 * - $ne:   { "reasonCode": { "$ne": "STANDARD" } }
 * - $in:   { "reasonCode": { "$in": ["EXPIRED", "DAMAGED"] } }
 * - $gt:   { "quantity": { "$gt": 100 } }
 * - $lt:   { "quantity": { "$lt": 10 } }
 * - $gte:  { "quantity": { "$gte": 50 } }
 * - $lte:  { "quantity": { "$lte": 5 } }
 *
 * Multiple condition keys use AND logic (all must match).
 */
@Injectable()
export class RuleEvaluatorService {
  private readonly logger = new Logger(RuleEvaluatorService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Evaluate all active rules for a given event type against the payload.
   * Returns the action from the first matching rule (highest priority), or a non-matched result.
   */
  async evaluate(
    eventType: string,
    payload: Record<string, unknown>,
    clinicId?: string,
  ): Promise<EvaluationResult> {
    // Fetch rules: clinic-specific + global, ordered by priority DESC
    const rules = await this.prisma.systemRule.findMany({
      where: {
        eventType,
        isActive: true,
        OR: [
          { clinicId: clinicId ?? null },
          { clinicId: null },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      const conditions = rule.conditions as Record<string, unknown>;

      if (this.matchesConditions(conditions, payload)) {
        const action = rule.action as unknown as RuleAction;
        this.logger.log(
          `Rule matched: "${rule.name}" (id=${rule.id}) for event ${eventType}`,
        );
        return {
          matched: true,
          ruleName: rule.name,
          action,
        };
      }
    }

    return { matched: false, ruleName: null, action: null };
  }

  /**
   * Check if all conditions match the payload (AND logic).
   */
  matchesConditions(
    conditions: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
      const payloadValue = payload[key];

      if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
        // Operator-based condition: { "$eq": "EXPIRED" }
        const operators = condition as Record<string, unknown>;
        if (!this.matchesOperators(operators, payloadValue)) {
          return false;
        }
      } else {
        // Simple equality: { "reasonCode": "EXPIRED" }
        if (payloadValue !== condition) {
          return false;
        }
      }
    }
    return true;
  }

  private matchesOperators(
    operators: Record<string, unknown>,
    value: unknown,
  ): boolean {
    for (const [op, expected] of Object.entries(operators)) {
      switch (op) {
        case '$eq':
          if (value !== expected) return false;
          break;
        case '$ne':
          if (value === expected) return false;
          break;
        case '$in':
          if (!Array.isArray(expected) || !expected.includes(value)) return false;
          break;
        case '$gt':
          if (typeof value !== 'number' || typeof expected !== 'number' || value <= expected) return false;
          break;
        case '$lt':
          if (typeof value !== 'number' || typeof expected !== 'number' || value >= expected) return false;
          break;
        case '$gte':
          if (typeof value !== 'number' || typeof expected !== 'number' || value < expected) return false;
          break;
        case '$lte':
          if (typeof value !== 'number' || typeof expected !== 'number' || value > expected) return false;
          break;
        default:
          this.logger.warn(`Unknown operator: ${op}`);
          return false;
      }
    }
    return true;
  }
}
