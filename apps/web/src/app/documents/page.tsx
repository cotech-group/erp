'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface DocItem {
  id: string;
  title: string;
  classification: string | null;
  status: string;
  tags: string[];
  currentVersion: { versionNumber: number; originalName: string; size: number } | null;
  createdBy: { firstName: string; lastName: string };
  updatedAt: string;
}

export default function DocumentsPage() {
  const [items, setItems] = useState<DocItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    api.get<DocItem[]>(`/documents?${params}`).then((r) => {
      setItems(r.data);
      setTotal(r.meta.total ?? 0);
    }).catch(() => { window.location.href = '/login'; });
  }, [page, search]);

  return (
    <AppShell
      title="Documents"
      actions={
        <>
          <input
            className="input" placeholder="Rechercher..."
            style={{ width: '220px' }}
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <a href="/documents/upload" className="btn btn-primary btn-sm">Deposer</a>
        </>
      }
    >
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Classification</th>
              <th>Statut</th>
              <th>Version</th>
              <th>Auteur</th>
              <th>Modifie le</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun document</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.title}</td>
                <td>
                  {item.classification ? (
                    <span className="badge badge-document">{item.classification}</span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                </td>
                <td><span className={`badge badge-${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td style={{ color: 'var(--text-secondary)' }}>v{item.currentVersion?.versionNumber ?? '-'}</td>
                <td>{item.createdBy.firstName} {item.createdBy.lastName}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{new Date(item.updatedAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="pagination">
          <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Precedent</button>
          <span className="pagination-info">Page {page} sur {Math.ceil(total / 20)}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total}>Suivant</button>
        </div>
      )}
    </AppShell>
  );
}
