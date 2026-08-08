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
   - Check if all conditions match the payload (AND logic).
   - Supports both:
   - 1) Key-object style: { "varianceAmountMinor": { "$lte": 10000 } } or { "reasonCode": "EXPIRED" }
   - 2) Standard Rule Engine spec: { "fact": "varianceAmountMinor", "operator": "lessThanInclusive", "value": 10000 }
   - 3) Array of conditions: [{ "fact": "varianceAmountMinor", "operator": "lessThanInclusive", "value": 10000 }]
   */
  matchesConditions(
    conditions: Record<string, unknown> | Array<Record<string, unknown>>,
    payload: Record<string, unknown>,
  ): boolean {
    if (!conditions) return true;

    // Handle Array format: [{ fact, operator, value }]
    if (Array.isArray(conditions)) {
      return conditions.every((cond) => this.matchesSingleConditionSpec(cond, payload));
    }

    // Handle single object standard Rule Engine spec: { fact, operator, value }
    if ('fact' in conditions && 'operator' in conditions) {
      return this.matchesSingleConditionSpec(conditions, payload);
    }

    // Handle key-value / operator dictionary format: { reasonCode: "EXPIRED", quantity: { $gt: 10 } }
    for (const [key, condition] of Object.entries(conditions)) {
      const payloadValue = payload[key];

      if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
        const operators = condition as Record<string, unknown>;
        if (!this.matchesOperators(operators, payloadValue)) {
          return false;
        }
      } else {
        if (payloadValue !== condition) {
          return false;
        }
      }
    }
    return true;
  }

  private matchesSingleConditionSpec(
    cond: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): boolean {
    const factKey = String(cond.fact);
    const operator = String(cond.operator).toLowerCase();
    const expectedValue = cond.value;
    const actualValue = payload[factKey];

    switch (operator) {
      case 'equal':
      case 'equals':
      case 'eq':
      case '$eq':
        return actualValue === expectedValue;
      case 'notequal':
      case 'notequals':
      case 'ne':
      case '$ne':
        return actualValue !== expectedValue;
      case 'in':
      case '$in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      case 'lessthaninclusive':
      case 'lte':
      case '$lte':
        return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue <= expectedValue;
      case 'lessthan':
      case 'lt':
      case '$lt':
        return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue < expectedValue;
      case 'greaterthaninclusive':
      case 'gte':
      case '$gte':
        return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue >= expectedValue;
      case 'greaterthan':
      case 'gt':
      case '$gt':
        return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue > expectedValue;
      default:
        this.logger.warn(`Unknown rule engine spec operator: ${operator}`);
        return false;
    }
  }

  private matchesOperators(
    operators: Record<string, unknown>,
    value: unknown,
  ): boolean {
    for (const [op, expected] of Object.entries(operators)) {
      switch (op.toLowerCase()) {
        case '$eq':
        case 'eq':
        case 'equal':
          if (value !== expected) return false;
          break;
        case '$ne':
        case 'ne':
        case 'notequal':
          if (value === expected) return false;
          break;
        case '$in':
        case 'in':
          if (!Array.isArray(expected) || !expected.includes(value)) return false;
          break;
        case '$gt':
        case 'gt':
        case 'greaterthan':
          if (typeof value !== 'number' || typeof expected !== 'number' || value <= expected) return false;
          break;
        case '$lt':
        case 'lt':
        case 'lessthan':
          if (typeof value !== 'number' || typeof expected !== 'number' || value >= expected) return false;
          break;
        case '$gte':
        case 'gte':
        case 'greaterthaninclusive':
          if (typeof value !== 'number' || typeof expected !== 'number' || value < expected) return false;
          break;
        case '$lte':
        case 'lte':
        case 'lessthaninclusive':
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
