'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface NotifItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetch = () => {
    api.get<NotifItem[]>('/notifications').then((r) => {
      setItems(r.data);
      setUnreadCount((r.meta as any).unreadCount ?? 0);
    }).catch(() => { window.location.href = '/login'; });
  };

  useEffect(() => { fetch(); }, []);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    fetch();
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    fetch();
  };

  return (
    <AppShell
      title={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
      actions={unreadCount > 0 ? <button className="btn btn-sm btn-ghost" onClick={markAllRead}>Tout marquer comme lu</button> : undefined}
    >
      <div className="card" style={{ padding: 0 }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Aucune notification</div>
        )}
        {items.map((n) => (
          <div
            key={n.id}
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-light)',
              background: n.read ? 'transparent' : 'var(--info-bg)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 500, marginBottom: '0.2rem' }}>{n.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{n.message}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {new Date(n.createdAt).toLocaleString('fr-FR')}
              </div>
            </div>
            {!n.read && (
              <button className="btn btn-sm btn-ghost" onClick={() => markRead(n.id)}>Lu</button>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
