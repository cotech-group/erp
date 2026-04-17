import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export interface SearchResult {
  id: string;
  type: 'media' | 'document' | 'workflow';
  title: string;
  description: string | null;
  status: string;
  highlight: string | null;
  updatedAt: Date;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, limit = 20, types?: string[]): Promise<SearchResponse> {
    if (!query || query.trim().length < 2) {
      return { results: [], total: 0, query };
    }

    const searchTerm = `%${query.trim()}%`;
    const results: SearchResult[] = [];

    const shouldSearch = (type: string) => !types || types.length === 0 || types.includes(type);

    // Search media
    if (shouldSearch('media')) {
      const media = await this.prisma.mediaFile.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { originalName: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, description: true, status: true, updatedAt: true },
      });

      results.push(
        ...media.map((m) => ({
          id: m.id,
          type: 'media' as const,
          title: m.title,
          description: m.description,
          status: m.status,
          highlight: this.extractHighlight(m.title, m.description, query),
          updatedAt: m.updatedAt,
        })),
      );
    }

    // Search documents
    if (shouldSearch('document')) {
      const docs = await this.prisma.document.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { classification: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, description: true, status: true, updatedAt: true },
      });

      results.push(
        ...docs.map((d) => ({
          id: d.id,
          type: 'document' as const,
          title: d.title,
          description: d.description,
          status: d.status,
          highlight: this.extractHighlight(d.title, d.description, query),
          updatedAt: d.updatedAt,
        })),
      );
    }

    // Search workflow definitions
    if (shouldSearch('workflow')) {
      const wfs = await this.prisma.workflowInstance.findMany({
        where: {
          OR: [
            { entityId: { contains: query, mode: 'insensitive' } },
            { definition: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { definition: { select: { name: true } } },
      });

      results.push(
        ...wfs.map((w) => ({
          id: w.id,
          type: 'workflow' as const,
          title: `${w.definition.name} — ${w.entityType}/${w.entityId}`,
          description: null,
          status: w.status,
          highlight: null,
          updatedAt: w.updatedAt,
        })),
      );
    }

    // Sort all results by updatedAt desc
    results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return {
      results: results.slice(0, limit),
      total: results.length,
      query,
    };
  }

  private extractHighlight(title: string, description: string | null, query: string): string | null {
    const lowerQuery = query.toLowerCase();
    const text = description || title;
    const idx = text.toLowerCase().indexOf(lowerQuery);
    if (idx === -1) return null;

    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 40);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  }
}
