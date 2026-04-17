'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface WorkflowItem {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  definition: { code: string; name: string };
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}

export default function WorkflowPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (filter) params.set('status', filter);
    api.get<WorkflowItem[]>(`/workflow/instances?${params}`).then((r) => {
      setItems(r.data);
      setTotal(r.meta.total ?? 0);
    }).catch(() => { window.location.href = '/login'; })
    .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleAction = async (instanceId: string, action: string) => {
    const comment = action === 'approve' ? 'Approuve' : 'Rejete';
    try {
      await api.post(`/workflow/instances/${instanceId}/actions`, { action, comment });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <AppShell
      title="Workflows"
      actions={
        <select className="input select" style={{ width: '200px' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Approuves</option>
          <option value="REJECTED">Rejetes</option>
          <option value="CANCELLED">Annules</option>
        </select>
      }
    >
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Definition</th>
              <th>Entite</th>
              <th>Statut</th>
              <th>Demandeur</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun workflow</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.definition.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{item.entityType}/{item.entityId}</td>
                <td><span className={`badge badge-${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td>{item.createdBy.firstName} {item.createdBy.lastName}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</td>
                <td style={{ textAlign: 'right' }}>
                  {item.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-success" onClick={() => handleAction(item.id, 'approve')}>Approuver</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleAction(item.id, 'reject')}>Rejeter</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
