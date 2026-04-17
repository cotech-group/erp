import { Injectable } from '@nestjs/common';
import { OdooClientService } from './odoo-client.service.js';

// DTO mappings — never expose raw Odoo payloads

export interface OdooUserDto {
  id: number;
  login: string;
  name: string;
  active: boolean;
}

export interface OdooPartnerDto {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  isCompany: boolean;
}

export interface OdooEmployeeDto {
  id: number;
  name: string;
  workEmail: string | false;
  department: string | false;
  jobTitle: string | false;
}

export interface OdooInvoiceDto {
  id: number;
  name: string;
  moveType: string;
  state: string;
  invoiceDate: string | false;
  amountTotal: number;
  currencyId: [number, string] | false;
}

@Injectable()
export class OdooService {
  constructor(private readonly odoo: OdooClientService) {}

  async getUsers(limit = 100, offset = 0, search?: string, traceId?: string): Promise<OdooUserDto[]> {
    const domain = search ? [['name', 'ilike', search]] : [];
    const records = await this.odoo.searchRead(
      'res.users',
      domain,
      ['id', 'login', 'name', 'active'],
      { limit, offset },
      traceId,
    );
    return records.map((r: any) => ({
      id: r.id,
      login: r.login,
      name: r.name,
      active: r.active,
    }));
  }

  async getPartners(limit = 100, offset = 0, search?: string, traceId?: string): Promise<OdooPartnerDto[]> {
    const domain = search ? [['name', 'ilike', search]] : [];
    const records = await this.odoo.searchRead(
      'res.partner',
      domain,
      ['id', 'name', 'email', 'phone', 'is_company'],
      { limit, offset },
      traceId,
    );
    return records.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      isCompany: r.is_company,
    }));
  }

  async getEmployees(limit = 100, offset = 0, search?: string, traceId?: string): Promise<OdooEmployeeDto[]> {
    const domain = search ? [['name', 'ilike', search]] : [];
    const records = await this.odoo.searchRead(
      'hr.employee',
      domain,
      ['id', 'name', 'work_email', 'department_id', 'job_title'],
      { limit, offset },
      traceId,
    );
    return records.map((r: any) => ({
      id: r.id,
      name: r.name,
      workEmail: r.work_email,
      department: r.department_id ? r.department_id[1] : false,
      jobTitle: r.job_title,
    }));
  }

  async getInvoices(limit = 100, offset = 0, traceId?: string): Promise<OdooInvoiceDto[]> {
    const records = await this.odoo.searchRead(
      'account.move',
      [['move_type', 'in', ['out_invoice', 'in_invoice']]],
      ['id', 'name', 'move_type', 'state', 'invoice_date', 'amount_total', 'currency_id'],
      { limit, offset, order: 'invoice_date desc' },
      traceId,
    );
    return records.map((r: any) => ({
      id: r.id,
      name: r.name,
      moveType: r.move_type,
      state: r.state,
      invoiceDate: r.invoice_date,
      amountTotal: r.amount_total,
      currencyId: r.currency_id,
    }));
  }
}
