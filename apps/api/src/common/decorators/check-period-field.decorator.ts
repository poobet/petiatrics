import { SetMetadata } from '@nestjs/common';

export const CHECK_PERIOD_FIELD_KEY = 'checkPeriodField';

/**
 * Decorator to specify body field(s) containing transaction date to check against closed accounting periods.
 * Example: @CheckPeriodField('adjustmentDate')
 */
export const CheckPeriodField = (fieldName: string) =>
  SetMetadata(CHECK_PERIOD_FIELD_KEY, fieldName);
