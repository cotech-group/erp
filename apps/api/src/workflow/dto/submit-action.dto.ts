import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitActionDto {
  @ApiProperty({ enum: ['approve', 'reject', 'cancel', 'request_changes'] })
  @IsEnum(['approve', 'reject', 'cancel', 'request_changes'] as const, {
    message: 'action must be approve, reject, cancel or request_changes',
  })
  action!: 'approve' | 'reject' | 'cancel' | 'request_changes';

  @ApiPropertyOptional({ example: 'Contenu valide' })
  @IsOptional()
  @IsString()
  comment?: string;
}
