'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface MediaItem {
  id: string;
  title: string;
  mediaType: string;
  status: string;
  size: number;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<MediaItem[]>(`/media?page=${page}&limit=20`).then((r) => {
      setItems(r.data);
      setTotal(r.meta.total ?? 0);
    }).catch(() => { window.location.href = '/login'; });
  }, [page]);

  return (
    <AppShell title="Media" actions={<span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{total} elements</span>}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Taille</th>
              <th>Auteur</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun media</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.title}</td>
                <td><span className={`badge badge-${item.mediaType.toLowerCase()}`}>{item.mediaType}</span></td>
                <td><span className={`badge badge-${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td style={{ color: 'var(--text-secondary)' }}>{formatSize(item.size)}</td>
                <td>{item.uploadedBy.firstName} {item.uploadedBy.lastName}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</td>
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
