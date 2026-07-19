import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface SupplierScorecard {
  supplierId: string;
  supplierName: string;
  totalPOs: number;
  totalGRs: number;
  totalInvoices: number;
  totalSpendMinor: number;
  otifRate: number; // percentage
  defectRate: number; // percentage
  averageLeadTimeDays: number;
}

export interface OtifDetail {
  purchaseOrderId: string;
  poCode: string;
  expectedDeliveryDate: string | null;
  actualReceiptDate: string | null;
  isOnTime: boolean;
  isInFull: boolean;
  isOtif: boolean;
}

@Injectable()
export class VendorAnalyticsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get supplier scorecard with aggregated KPIs
   */
  async getSupplierScorecard(
    clinicId: string,
    supplierId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<SupplierScorecard> {
    const supplier = await this.prisma.businessPartner.findFirst({
      where: { id: supplierId, clinicId },
      select: { name: true },
    });

    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    // Count POs
    const totalPOs = await this.prisma.purchaseOrder.count({
      where: { clinicId, supplierId, deletedAt: null, ...dateFilter },
    });

    // Count GRs linked to this supplier's POs
    const totalGRs = await this.prisma.goodsReceipt.count({
      where: {
        clinicId,
        purchaseOrder: { supplierId },
        ...(dateFrom || dateTo ? { receivedDate: dateFilter.createdAt } : {}),
      },
    });

    // Count Purchase Invoices
    const totalInvoices = await this.prisma.purchaseInvoice.count({
      where: { clinicId, supplierId, ...dateFilter },
    });

    // Total spend
    const spendAgg = await this.prisma.supplierPayment.aggregate({
      where: { clinicId, supplierId, ...dateFilter },
      _sum: { amountMinor: true },
    });
    const totalSpendMinor = spendAgg._sum.amountMinor || 0;

    // OTIF calculation
    const otifRate = await this.calculateOtifRate(clinicId, supplierId, dateFrom, dateTo);

    // Defect rate
    const defectRate = await this.calculateDefectRate(clinicId, supplierId, dateFrom, dateTo);

    // Average lead time
    const averageLeadTimeDays = await this.calculateAverageLeadTime(clinicId, supplierId, dateFrom, dateTo);

    return {
      supplierId,
      supplierName: supplier?.name ?? 'Unknown',
      totalPOs,
      totalGRs,
      totalInvoices,
      totalSpendMinor,
      otifRate: Math.round(otifRate * 100) / 100,
      defectRate: Math.round(defectRate * 100) / 100,
      averageLeadTimeDays: Math.round(averageLeadTimeDays * 10) / 10,
    };
  }

  /**
   * Get all suppliers with summary KPIs for a clinic
   */
  async getAllSupplierScorecards(clinicId: string): Promise<SupplierScorecard[]> {
    const suppliers = await this.prisma.businessPartner.findMany({
      where: { clinicId, type: 'SUPPLIER', isActive: true },
      select: { id: true },
    });

    const scorecards: SupplierScorecard[] = [];
    for (const supplier of suppliers) {
      const scorecard = await this.getSupplierScorecard(clinicId, supplier.id);
      // Only include suppliers with transaction history
      if (scorecard.totalPOs > 0) {
        scorecards.push(scorecard);
      }
    }

    return scorecards;
  }

  /**
   * On-Time In-Full (OTIF) delivery rate.
   * Compares GR receivedDate vs PO expectedDeliveryDate and GR qty vs PO qty.
   */
  async calculateOtifRate(
    clinicId: string,
    supplierId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        clinicId,
        supplierId,
        deletedAt: null,
        expectedDeliveryDate: { not: null },
        ...dateFilter,
      },
      include: {
        lines: true,
        goodsReceipts: {
          where: { status: 'COMMITTED' },
          include: { lines: true },
          orderBy: { receivedDate: 'asc' },
        },
      },
    });

    if (pos.length === 0) return 0;

    let otifCount = 0;

    for (const po of pos) {
      if (!po.expectedDeliveryDate || po.goodsReceipts.length === 0) continue;

      // On-Time: first receipt before or on expected delivery date
      const firstReceipt = po.goodsReceipts[0];
      const isOnTime = firstReceipt.receivedDate <= po.expectedDeliveryDate;

      // In-Full: all PO line quantities met or exceeded across all GRs
      const isInFull = po.lines.every(poLine => {
        return Number(poLine.quantityReceived) >= Number(poLine.quantityOrdered);
      });

      if (isOnTime && isInFull) otifCount++;
    }

    return (otifCount / pos.length) * 100;
  }

  /**
   * Supplier defect rate from GR data.
   * Measures the ratio of under-received items (quantity shortfall) to total ordered.
   */
  async calculateDefectRate(
    clinicId: string,
    supplierId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        clinicId,
        supplierId,
        deletedAt: null,
        status: { in: ['FULLY_RECEIVED', 'CLOSED'] },
        ...dateFilter,
      },
      include: { lines: true },
    });

    if (pos.length === 0) return 0;

    let totalOrdered = 0;
    let totalShortfall = 0;

    for (const po of pos) {
      for (const line of po.lines) {
        const ordered = Number(line.quantityOrdered);
        const received = Number(line.quantityReceived);
        totalOrdered += ordered;
        if (received < ordered) {
          totalShortfall += (ordered - received);
        }
      }
    }

    if (totalOrdered === 0) return 0;
    return (totalShortfall / totalOrdered) * 100;
  }

  /**
   * Average lead time (days between PO order date and first GR receipt date)
   */
  async calculateAverageLeadTime(
    clinicId: string,
    supplierId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        clinicId,
        supplierId,
        deletedAt: null,
        ...dateFilter,
      },
      include: {
        goodsReceipts: {
          where: { status: 'COMMITTED' },
          orderBy: { receivedDate: 'asc' },
          take: 1,
        },
      },
    });

    const leadTimes: number[] = [];
    for (const po of pos) {
      if (po.goodsReceipts.length > 0) {
        const diffMs = po.goodsReceipts[0].receivedDate.getTime() - po.orderDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        leadTimes.push(Math.max(0, diffDays));
      }
    }

    if (leadTimes.length === 0) return 0;
    return leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
  }

  /**
   * Get OTIF detail per PO for a supplier
   */
  async getOtifDetails(
    clinicId: string,
    supplierId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<OtifDetail[]> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        clinicId,
        supplierId,
        deletedAt: null,
        ...dateFilter,
      },
      include: {
        lines: true,
        goodsReceipts: {
          where: { status: 'COMMITTED' },
          orderBy: { receivedDate: 'asc' },
          take: 1,
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    return pos.map(po => {
      const firstGr = po.goodsReceipts[0] ?? null;
      const isOnTime = po.expectedDeliveryDate && firstGr
        ? firstGr.receivedDate <= po.expectedDeliveryDate
        : false;
      const isInFull = po.lines.every(
        line => Number(line.quantityReceived) >= Number(line.quantityOrdered),
      );

      return {
        purchaseOrderId: po.id,
        poCode: po.code,
        expectedDeliveryDate: po.expectedDeliveryDate?.toISOString() ?? null,
        actualReceiptDate: firstGr?.receivedDate.toISOString() ?? null,
        isOnTime,
        isInFull,
        isOtif: isOnTime && isInFull,
      };
    });
  }

  private buildDateFilter(dateFrom?: Date, dateTo?: Date) {
    if (!dateFrom && !dateTo) return {};
    const filter: any = { createdAt: {} };
    if (dateFrom) filter.createdAt.gte = dateFrom;
    if (dateTo) filter.createdAt.lte = dateTo;
    return filter;
  }
}
