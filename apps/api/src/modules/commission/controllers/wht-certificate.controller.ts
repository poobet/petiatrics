import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { WHTCertificateService } from '../services/wht-certificate.service';

@Controller('commission/wht')
export class WHTCertificateController {
  constructor(private readonly whtService: WHTCertificateService) {}

  @Get('certificates')
  @Permissions('COMMISSION:VIEW')
  findAll(
    @TenantId() clinicId: string,
    @Query('bpId') bpId?: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.whtService.findAll(clinicId, bpId, year, month);
  }

  @Get('certificates/:id')
  @Permissions('COMMISSION:VIEW')
  findOne(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.whtService.findOne(clinicId, id);
  }

  @Get('export')
  @Permissions('COMMISSION:EXPORT_WHT')
  async exportPnd3(
    @TenantId() clinicId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @Res() res: Response,
  ) {
    const csvContent = await this.whtService.exportPnd3Csv(clinicId, year, month);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="PND3_${year}_${month}.csv"`,
    );
    return res.send(csvContent);
  }
}
