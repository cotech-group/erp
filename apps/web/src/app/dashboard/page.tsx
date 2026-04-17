'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

interface Stats {
  media: number;
  documents: number;
  workflowPending: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<unknown[]>('/media?limit=1').then((r) => r.meta.total ?? 0),
      api.get<unknown[]>('/documents?limit=1').then((r) => r.meta.total ?? 0),
      api.get<unknown[]>('/workflow/instances?status=PENDING&limit=1').then((r) => r.meta.total ?? 0),
    ]).then(([media, documents, workflowPending]) => {
      setStats({ media, documents, workflowPending });
    }).catch(() => {
      window.location.href = '/login';
    });
  }, []);

  if (!stats) return (
    <AppShell title="Tableau de bord">
      <p style={{ color: 'var(--text-muted)' }}>Chargement...</p>
    </AppShell>
  );

  return (
    <AppShell title="Tableau de bord">
      <div className="stat-grid">
        <a href="/media" className="stat-card">
          <div className="stat-icon violet">{'\u{1F3AC}'}</div>
          <div>
            <div className="stat-label">Media</div>
            <div className="stat-value">{stats.media}</div>
          </div>
        </a>
        <a href="/documents" className="stat-card">
          <div className="stat-icon blue">{'\u{1F4C4}'}</div>
          <div>
            <div className="stat-label">Documents</div>
            <div className="stat-value">{stats.documents}</div>
          </div>
        </a>
        <a href="/workflow" className="stat-card">
          <div className="stat-icon amber">{'\u{23F3}'}</div>
          <div>
            <div className="stat-label">Workflows en attente</div>
            <div className="stat-value">{stats.workflowPending}</div>
          </div>
        </a>
      </div>
    </AppShell>
  );
}
