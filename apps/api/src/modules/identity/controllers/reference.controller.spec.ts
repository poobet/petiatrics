import { Test } from '@nestjs/testing';
import { ReferenceController } from './reference.controller';
import { BusinessPartnerService } from '../services/business-partner.service';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';

const allowGuard = { canActivate: () => true };

const CLINIC_ID = 'clinic-1';

const mockTaxCodes = [
  { id: 'tc-1', code: 'V7', name: 'VAT 7%', rate: 7, isVatType: true, description: 'Standard VAT' },
];

const mockBpGroups = [
  { id: 'grp-1', name: 'Customers', prefix: 'C-', currentSequence: 0, isActive: true },
  { id: 'grp-2', name: 'Vets',      prefix: 'V-', currentSequence: 0, isActive: true },
];

function makeBpServiceMock() {
  return {
    listTaxCodes: jest.fn().mockResolvedValue(mockTaxCodes),
    listBpGroups: jest.fn().mockResolvedValue(mockBpGroups),
  };
}

describe('ReferenceController', () => {
  let controller: ReferenceController;
  let bpService: ReturnType<typeof makeBpServiceMock>;

  beforeEach(async () => {
    bpService = makeBpServiceMock();
    const module = await Test.createTestingModule({
      controllers: [ReferenceController],
      providers: [{ provide: BusinessPartnerService, useValue: bpService }],
    })
      .overrideGuard(BranchContextGuard)
      .useValue(allowGuard)
      .compile();

    controller = module.get(ReferenceController);
  });

  describe('listTaxCodes', () => {
    it('delegates to bpService.listTaxCodes and returns result', async () => {
      const result = await controller.listTaxCodes();
      expect(bpService.listTaxCodes).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTaxCodes);
    });
  });

  describe('listBpGroups', () => {
    it('delegates to bpService.listBpGroups with clinicId and returns result', async () => {
      const result = await controller.listBpGroups(CLINIC_ID);
      expect(bpService.listBpGroups).toHaveBeenCalledWith(CLINIC_ID);
      expect(result).toEqual(mockBpGroups);
    });

    it('returns empty array when service returns none', async () => {
      bpService.listBpGroups.mockResolvedValueOnce([]);
      const result = await controller.listBpGroups(CLINIC_ID);
      expect(result).toEqual([]);
    });
  });
});
