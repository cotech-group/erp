import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SearchService } from './search.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CacheTTL } from '../observability/cache-control.interceptor.js';

class SearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  types?: string[];
}

@ApiTags('Recherche')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @CacheTTL(10)
  @ApiQuery({ name: 'q', type: String, description: 'Terme de recherche' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'types', type: String, required: false, description: 'media,document,workflow' })
  async search(@Query() query: SearchQueryDto) {
    const result = await this.searchService.search(query.q, query.limit, query.types);
    return {
      data: result.results,
      meta: {
        total: result.total,
        query: result.query,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
