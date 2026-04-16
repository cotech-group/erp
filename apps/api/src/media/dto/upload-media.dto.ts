export class UploadMediaDto {
  title!: string;
  description?: string;
  mediaType!: 'VIDEO' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
}
