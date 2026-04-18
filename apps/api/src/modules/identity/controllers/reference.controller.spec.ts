import { Test } from '@nestjs/testing';
import { ReferenceController } from './reference.controller';
import { BusinessPartnerService } from '../services/business-partner.service';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';

const allowGuard = { canActivate: () => true };

const mockTaxCodes = [
  { id: 'tc-1', code: 'V7', name: 'VAT 7%', rate: 7, isVatType: true, description: 'Standard VAT' },
];

const mockContactPositions = [
  { id: 'cp-1', name: 'ผู้จัดการ / Manager' },
  { id: 'cp-2', name: 'ฝ่ายจัดซื้อ / Purchasing' },
];

function makeBpServiceMock() {
  return {
    listTaxCodes: jest.fn().mockResolvedValue(mockTaxCodes),
    listContactPositions: jest.fn().mockResolvedValue(mockContactPositions),
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

  describe('listContactPositions', () => {
    it('delegates to bpService.listContactPositions and returns result', async () => {
      const result = await controller.listContactPositions();
      expect(bpService.listContactPositions).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockContactPositions);
    });

    it('returns empty array when service returns none', async () => {
      bpService.listContactPositions.mockResolvedValueOnce([]);
      const result = await controller.listContactPositions();
      expect(result).toEqual([]);
    });
  });
});
