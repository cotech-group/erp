export class DocumentQueryDto {
  page?: number;
  limit?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  classification?: string;
  search?: string;
}
