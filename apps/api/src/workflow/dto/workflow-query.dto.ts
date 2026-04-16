export class WorkflowQueryDto {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  entityType?: string;
  definitionCode?: string;
}
