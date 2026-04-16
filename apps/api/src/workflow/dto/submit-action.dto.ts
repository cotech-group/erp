export class SubmitActionDto {
  action!: 'approve' | 'reject' | 'cancel' | 'request_changes';
  comment?: string;
}
