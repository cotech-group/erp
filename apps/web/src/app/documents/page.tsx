'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Documents ({total})</h1>
        <input
          className="input" placeholder="Rechercher..."
          style={{ width: '250px' }}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Classification</th>
              <th>Statut</th>
              <th>Version</th>
              <th>Auteur</th>
              <th>Modifie</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.title}</td>
                <td>{item.classification || '-'}</td>
                <td><span className={`badge badge-${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td>v{item.currentVersion?.versionNumber ?? '-'}</td>
                <td>{item.createdBy.firstName} {item.createdBy.lastName}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(item.updatedAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
          <button className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Precedent</button>
          <span style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>Page {page}</span>
          <button className="btn btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total}>Suivant</button>
        </div>
      )}
    </>
  );
}
