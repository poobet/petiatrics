import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class InventoryWriteGuardService {
  assertWritable() {
    if (process.env.INVENTORY_WRITE_BLOCKED === 'true') {
      throw new ServiceUnavailableException(
        'Inventory writes are temporarily disabled during maintenance.',
      );
    }
  }
}
