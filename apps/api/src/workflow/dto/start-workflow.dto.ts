import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartWorkflowDto {
  @ApiProperty({ example: 'MEDIA_PUBLISH' })
  @IsString()
  @MinLength(1)
  definitionCode!: string;

  @ApiProperty({ example: 'media' })
  @IsString()
  @MinLength(1)
  entityType!: string;

  @ApiProperty({ example: 'seed-media-1' })
  @IsString()
  @MinLength(1)
  entityId!: string;
}
