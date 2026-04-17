import { Global, Module } from '@nestjs/common';
import { OdooClientService } from './odoo-client.service.js';
import { OdooService } from './odoo.service.js';
import { OdooController } from './odoo.controller.js';

@Global()
@Module({
  controllers: [OdooController],
  providers: [OdooClientService, OdooService],
  exports: [OdooClientService, OdooService],
})
export class OdooModule {}
