export class MediaQueryDto {
  page?: number;
  limit?: number;
  status?: 'DRAFT' | 'PROCESSING' | 'PUBLISHED' | 'ARCHIVED';
  mediaType?: 'VIDEO' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
}
