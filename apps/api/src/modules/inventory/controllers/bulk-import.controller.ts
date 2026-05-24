import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { BulkImportService } from '../services/bulk-import.service';

// Import multer types so Express.Multer.File is available globally
import type { Multer } from 'multer';
// Suppress unused import warning (multer is only needed for side-effect type augmentation)
void (undefined as unknown as Multer);

const ACCEPTED_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

@Controller('inventory/bulk-import')
@Roles(Role.CLINIC_OWNER)
export class BulkImportController {
  constructor(private readonly bulkImport: BulkImportService) {}

  /**
   * POST /api/v1/inventory/bulk-import/items
   *
   * Accepts a CSV or XLSX file as `file` in a multipart/form-data body.
   * Returns a summary of rows created, skipped, and any row-level errors.
   */
  @Post('items')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_BYTES },
    }),
  )
  async importItems(
    @TenantId() clinicId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required. Upload a CSV or XLSX file as "file".');
    }
    if (!ACCEPTED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Upload a .csv or .xlsx file.`,
      );
    }

    return this.bulkImport.importFile(clinicId, file.buffer, file.mimetype);
  }
}
