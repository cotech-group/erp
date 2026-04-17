'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface SearchResult {
  id: string;
  type: 'media' | 'document' | 'workflow';
  title: string;
  status: string;
  highlight: string | null;
}

const typeLabels: Record<string, string> = { media: 'Media', document: 'Document', workflow: 'Workflow' };
const typeLinks: Record<string, string> = { media: '/media', document: '/documents', workflow: '/workflow' };

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.length < 2) return;
    try {
      const res = await api.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}&limit=30`);
      setResults(res.data);
      setTotal(res.meta.total ?? 0);
      setSearched(true);
    } catch { window.location.href = '/login'; }
  }

  return (
    <AppShell title="Recherche globale">
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          className="input" placeholder="Rechercher dans media, documents, workflows..."
          value={query} onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }} autoFocus
        />
        <button type="submit" className="btn btn-primary">Rechercher</button>
      </form>

      {searched && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Titre</th>
                <th>Statut</th>
                <th>Extrait</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun resultat pour "{query}"</td></tr>
              )}
              {results.map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td><span className={`badge badge-${r.type}`}>{typeLabels[r.type]}</span></td>
                  <td style={{ fontWeight: 500 }}>
                    <a href={typeLinks[r.type]} style={{ color: 'inherit' }}>{r.title}</a>
                  </td>
                  <td><span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.highlight ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 0 && (
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-light)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {total} resultat{total > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
