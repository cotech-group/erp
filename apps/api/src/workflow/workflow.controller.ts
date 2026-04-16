import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service.js';
import {
  CreateDefinitionDto,
  StartWorkflowDto,
  SubmitActionDto,
  WorkflowQueryDto,
} from './dto/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';

@Controller('workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // ── Definitions ──────────────────────

  @Post('definitions')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createDefinition(@Body() dto: CreateDefinitionDto) {
    const def = await this.workflowService.createDefinition(dto);
    return {
      data: def,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('definitions')
  async listDefinitions() {
    const definitions = await this.workflowService.listDefinitions();
    return {
      data: definitions,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  // ── Instances ────────────────────────

  @Post('instances')
  @HttpCode(HttpStatus.CREATED)
  async startWorkflow(@Body() dto: StartWorkflowDto, @CurrentUser() user: JwtPayload) {
    const instance = await this.workflowService.startWorkflow(dto, user.sub);
    return {
      data: instance,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('instances')
  async findAllInstances(@Query() query: WorkflowQueryDto) {
    const { data, total } = await this.workflowService.findAllInstances(query);
    return {
      data,
      meta: {
        total,
        page: Number(query.page) || 1,
        limit: Math.min(Number(query.limit) || 20, 100),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('instances/:id')
  async findOneInstance(@Param('id') id: string) {
    const instance = await this.workflowService.findOneInstance(id);
    return {
      data: instance,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  // ── Actions ──────────────────────────

  @Post('instances/:id/actions')
  @HttpCode(HttpStatus.CREATED)
  async submitAction(
    @Param('id') id: string,
    @Body() dto: SubmitActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const action = await this.workflowService.submitAction(id, dto, user.sub);
    return {
      data: action,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('instances/:id/actions')
  async getActions(@Param('id') id: string) {
    const actions = await this.workflowService.getActions(id);
    return {
      data: actions,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
