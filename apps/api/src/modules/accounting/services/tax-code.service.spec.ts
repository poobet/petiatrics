import { TaxCodeService } from './tax-code.service';
import { TaxComputation } from '@prisma/client';

describe('TaxCodeService', () => {
  let service: TaxCodeService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      taxCode: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new TaxCodeService(prismaMock);
  });

  it('should fetch tax codes for clinic', async () => {
    const mockList = [
      { id: 'tc-1', code: 'VAT_7', name: 'VAT 7%', rate: 7.0, computationType: TaxComputation.TAX_INCLUDED },
    ];
    prismaMock.taxCode.findMany.mockResolvedValue(mockList);

    const result = await service.getTaxCodes('clinic-1');
    expect(result).toEqual(mockList);
  });

  it('should create new tax code', async () => {
    const payload = {
      clinicId: 'clinic-1',
      code: 'vat_7',
      name: 'VAT 7%',
      rate: 7,
      glAccountId: 'acc-2130',
    };
    const created = { id: 'tc-1', ...payload, code: 'VAT_7' };
    prismaMock.taxCode.create.mockResolvedValue(created);

    const result = await service.createTaxCode(payload);
    expect(result).toEqual(created);
  });
});
