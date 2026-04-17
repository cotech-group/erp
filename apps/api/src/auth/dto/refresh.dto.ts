import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ example: 'd9e5bb9d-409c-4264-9bb5-10a063fd1230' })
  @IsString()
  @IsUUID()
  refreshToken!: string;
}
