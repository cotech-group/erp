import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadVersionDto {
  @ApiPropertyOptional({ example: 'Correction coquilles page 3' })
  @IsOptional()
  @IsString()
  comment?: string;
}
