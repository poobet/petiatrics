import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class WHTCertificateService {
  constructor(private readonly prisma: PrismaClient) {}

  async generateCertificate(clinicId: string, paymentRunId: string) {
    const run = await this.prisma.dfPaymentRun.findFirst({
      where: { id: paymentRunId, clinicId },
    });
    if (!run) {
      throw new NotFoundException(`Payment run "${paymentRunId}" not found`);
    }

    if (run.totalWhtMinor <= 0) {
      return null; // No WHT deducted for this run
    }

    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
    });
    const bp = await this.prisma.businessPartner.findUnique({
      where: { id: run.businessPartnerId },
    });

    if (!bp || !bp.taxId) {
      throw new UnprocessableEntityException(
        `Business partner "${run.businessPartnerId}" must have a valid Tax ID to generate a WHT certificate`,
      );
    }

    const payerAddressJson = typeof clinic?.address === 'object' ? clinic.address : {};
    const payerAddrStr = Object.values(payerAddressJson || {}).filter(Boolean).join(' ') || 'N/A';

    const payeeAddrStr = [bp.addressLine1, bp.subDistrict, bp.district, bp.province, bp.zipcode]
      .filter(Boolean)
      .join(' ') || 'N/A';

    const paidDate = run.paidAt || new Date();
    const ceYear = paidDate.getFullYear();
    const buddhistYear = ceYear + 543;
    const taxMonth = paidDate.getMonth() + 1;

    const code = `WHT-${buddhistYear}-${run.code.replace(/^[A-Za-z-]+/, '')}`;

    return this.prisma.wHTCertificate.create({
      data: {
        clinicId,
        code,
        businessPartnerId: run.businessPartnerId,
        paymentRunId: run.id,
        payerTaxId: clinic?.taxId || 'N/A',
        payerName: clinic?.name || 'Clinic',
        payerAddress: payerAddrStr,
        payeeTaxId: bp.taxId,
        payeeName: bp.name,
        payeeAddress: payeeAddrStr,
        incomeType: 'ค่าบริการ',
        incomeDescription: 'ค่าธรรมเนียมแพทย์ / ค่าคอมมิชชั่น',
        totalIncomeMinor: run.totalDfMinor,
        whtRateBps: 300, // 3%
        whtAmountMinor: run.totalWhtMinor,
        taxMonth,
        taxYear: buddhistYear,
        issuedAt: paidDate,
      },
    });
  }

  async findAll(clinicId: string, bpId?: string, year?: number, month?: number) {
    return this.prisma.wHTCertificate.findMany({
      where: {
        clinicId,
        businessPartnerId: bpId ? bpId : undefined,
        taxYear: year ? Number(year) : undefined,
        taxMonth: month ? Number(month) : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const cert = await this.prisma.wHTCertificate.findFirst({
      where: { id, clinicId },
    });
    if (!cert) {
      throw new NotFoundException(`WHT Certificate "${id}" not found`);
    }
    return cert;
  }

  async exportPnd3Csv(clinicId: string, year: number, month: number): Promise<string> {
    const certs = await this.prisma.wHTCertificate.findMany({
      where: {
        clinicId,
        taxYear: Number(year),
        taxMonth: Number(month),
      },
      orderBy: { issuedAt: 'asc' },
    });

    const headers = [
      'Seq',
      'PayeeTaxId',
      'PayeeName',
      'PayeeAddress',
      'IssueDate',
      'IncomeType',
      'WhtRate',
      'IncomeAmount',
      'WhtAmount',
      'TaxCondition',
    ];

    const rows = certs.map((c, index) => {
      const incomeBaht = (c.totalIncomeMinor / 100).toFixed(2);
      const whtBaht = (c.whtAmountMinor / 100).toFixed(2);
      const issueDateStr = c.issuedAt.toISOString().split('T')[0];

      return [
        index + 1,
        `="${c.payeeTaxId}"`,
        `"${c.payeeName.replace(/"/g, '""')}"`,
        `"${c.payeeAddress.replace(/"/g, '""')}"`,
        issueDateStr,
        `"${c.incomeType}"`,
        '3.00%',
        incomeBaht,
        whtBaht,
        '1', // 1 = หัก ณ ที่จ่าย
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
