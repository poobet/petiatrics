import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DocumentSequenceService } from './services/document-sequence.service';
import { DocumentTypeService } from './services/document-type.service';
import { SequenceConfigService } from './services/sequence-config.service';
import { DocumentTypeController } from './controllers/document-type.controller';
import { SequenceConfigController } from './controllers/sequence-config.controller';
import { DocumentSequenceController } from './controllers/document-sequence.controller';

@Module({
  controllers: [
    DocumentTypeController,
    SequenceConfigController,
    DocumentSequenceController,
  ],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        return new PrismaClient();
      },
    },
    DocumentSequenceService,
    DocumentTypeService,
    SequenceConfigService,
  ],
  exports: [
    DocumentSequenceService,
    DocumentTypeService,
    SequenceConfigService,
  ],
})
export class DocumentSequenceModule {}
