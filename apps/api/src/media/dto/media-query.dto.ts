import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MediaQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PROCESSING', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'PROCESSING', 'PUBLISHED', 'ARCHIVED'] as const)
  status?: 'DRAFT' | 'PROCESSING' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ enum: ['VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT'] })
  @IsOptional()
  @IsEnum(['VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT'] as const)
  mediaType?: 'VIDEO' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
}
