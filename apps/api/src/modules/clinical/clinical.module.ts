import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MODEL_NAMES,
  PetProfileSchema,
  VisitRecordSchema,
  VaccinationRecordSchema,
} from '@petiatrics/database';
import { EventsModule } from '../../common/events/events.module';
import { PatientService } from './services/patient.service';
import { VisitService } from './services/visit.service';
import { VaccinationService } from './services/vaccination.service';
import { PatientController } from './controllers/patient.controller';
import { VisitController } from './controllers/visit.controller';
import { VaccinationController } from './controllers/vaccination.controller';
import { OwnerController } from './controllers/owner.controller';

/**
 * ClinicalModule — US2: Electronic Medical Records
 *
 * Handles: patient profiles (MongoDB PetProfile), visit records (SOAP notes),
 * vaccination records, visit lifecycle (draft → finalized → amended),
 * prescription attachments, VisitFinalizedEvent emission.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MODEL_NAMES.PET_PROFILE, schema: PetProfileSchema },
      { name: MODEL_NAMES.VISIT_RECORD, schema: VisitRecordSchema },
      { name: MODEL_NAMES.VACCINATION_RECORD, schema: VaccinationRecordSchema },
    ]),
    EventsModule,
  ],
  controllers: [PatientController, VisitController, VaccinationController, OwnerController],
  providers: [PatientService, VisitService, VaccinationService],
  exports: [PatientService, VisitService, VaccinationService],
})
export class ClinicalModule {}

