'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface MediaItem {
  id: string;
  title: string;
  mediaType: string;
  status: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Media ({total})</h1>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
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
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.title}</td>
                <td><span className="badge badge-draft">{item.mediaType}</span></td>
                <td><span className={`badge badge-${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td>{formatSize(item.size)}</td>
                <td>{item.uploadedBy.firstName} {item.uploadedBy.lastName}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</td>
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
