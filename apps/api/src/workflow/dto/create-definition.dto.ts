import { IsString, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDefinitionDto {
  @ApiProperty({ example: 'MEDIA_PUBLISH' })
  @IsString()
  @MinLength(1)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'code must be UPPER_SNAKE_CASE' })
  code!: string;

  @ApiProperty({ example: 'Publication media' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
