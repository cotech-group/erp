export class CreateDocumentDto {
  title!: string;
  description?: string;
  classification?: string;
  tags?: string[];
  isPublic?: boolean;
}
