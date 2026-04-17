'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface AuditItem {
  id: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<AuditItem[]>(`/audit?page=${page}&limit=30`).then((r) => {
      setItems(r.data);
      setTotal(r.meta.total ?? 0);
    }).catch(() => { window.location.href = '/login'; });
  }, [page]);

  const actionColors: Record<string, string> = {
    login: 'badge-pending',
    logout: 'badge-draft',
    create: 'badge-published',
    update: 'badge-processing',
    validate: 'badge-approved',
    delete: 'badge-rejected',
  };

  return (
    <AppShell title="Journal d'audit" actions={<span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{total} evenements</span>}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Ressource</th>
              <th>Utilisateur</th>
              <th>IP</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun evenement</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td><span className={`badge ${actionColors[item.action] ?? 'badge-draft'}`}>{item.action}</span></td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {item.resource ? `${item.resource}${item.resourceId ? `/${item.resourceId.slice(0, 8)}...` : ''}` : '-'}
                </td>
                <td>{item.user ? `${item.user.firstName} ${item.user.lastName}` : '-'}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.ipAddress ?? '-'}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(item.createdAt).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 30 && (
        <div className="pagination">
          <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Precedent</button>
          <span className="pagination-info">Page {page}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => p + 1)} disabled={page * 30 >= total}>Suivant</button>
        </div>
      )}
    </AppShell>
  );
}
