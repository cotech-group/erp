export class StartWorkflowDto {
  definitionCode!: string;
  entityType!: string; // media, documents, forms...
  entityId!: string;
}
