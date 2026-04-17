import { IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadMediaDto {
  @ApiProperty({ example: 'Interview archive 2026' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT'] })
  @IsEnum(['VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT'] as const, {
    message: 'mediaType must be VIDEO, AUDIO, IMAGE or DOCUMENT',
  })
  mediaType!: 'VIDEO' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
}
