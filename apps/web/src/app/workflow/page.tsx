'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface WorkflowItem {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  currentStep: string;
  definition: { code: string; name: string };
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}

export default function WorkflowPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ limit: '50' });
    if (filter) params.set('status', filter);
    api.get<WorkflowItem[]>(`/workflow/instances?${params}`).then((r) => {
      setItems(r.data);
      setTotal(r.meta.total ?? 0);
    }).catch(() => { window.location.href = '/login'; });
  }, [filter]);

  const handleAction = async (instanceId: string, action: string) => {
    try {
      await api.post(`/workflow/instances/${instanceId}/actions`, { action });
      // Refresh
      setFilter((f) => f);
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Workflows ({total})</h1>
        <select className="input" style={{ width: '200px' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Approuve</option>
          <option value="REJECTED">Rejete</option>
          <option value="CANCELLED">Annule</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Definition</th>
              <th>Entite</th>
              <th>Statut</th>
              <th>Demandeur</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.definition.name}</td>
                <td>{item.entityType}/{item.entityId}</td>
                <td><span className={`badge badge-${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td>{item.createdBy.firstName} {item.createdBy.lastName}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</td>
                <td>
                  {item.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => handleAction(item.id, 'approve')}>Approuver</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleAction(item.id, 'reject')}>Rejeter</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
