import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { OdooService } from './odoo.service.js';
import { OdooQueryDto } from './dto/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CacheTTL } from '../observability/cache-control.interceptor.js';

@ApiTags('Odoo (ERP)')
@ApiBearerAuth()
@Controller('odoo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OdooController {
  constructor(private readonly odooService: OdooService) {}

  @Get('users')
  @Roles('admin')
  @CacheTTL(60)
  async getUsers(@Query() query: OdooQueryDto, @Req() req: Request) {
    const data = await this.odooService.getUsers(
      query.limit, query.offset, query.search, req.traceContext?.traceId,
    );
    return { data, meta: { timestamp: new Date().toISOString() } };
  }

  @Get('partners')
  @CacheTTL(60)
  async getPartners(@Query() query: OdooQueryDto, @Req() req: Request) {
    const data = await this.odooService.getPartners(
      query.limit, query.offset, query.search, req.traceContext?.traceId,
    );
    return { data, meta: { timestamp: new Date().toISOString() } };
  }

  @Get('employees')
  @Roles('admin', 'rh')
  @CacheTTL(60)
  async getEmployees(@Query() query: OdooQueryDto, @Req() req: Request) {
    const data = await this.odooService.getEmployees(
      query.limit, query.offset, query.search, req.traceContext?.traceId,
    );
    return { data, meta: { timestamp: new Date().toISOString() } };
  }

  @Get('invoices')
  @Roles('admin', 'finance')
  @CacheTTL(120)
  async getInvoices(@Query() query: OdooQueryDto, @Req() req: Request) {
    const data = await this.odooService.getInvoices(
      query.limit, query.offset, req.traceContext?.traceId,
    );
    return { data, meta: { timestamp: new Date().toISOString() } };
  }
}
