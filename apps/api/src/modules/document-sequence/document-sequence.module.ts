import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DocumentSequenceService } from './services/document-sequence.service';

@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        return new PrismaClient();
      },
    },
    DocumentSequenceService,
  ],
  exports: [DocumentSequenceService],
})
export class DocumentSequenceModule {}
