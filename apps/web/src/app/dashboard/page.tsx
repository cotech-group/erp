'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

  if (!stats) return <p>Chargement...</p>;

  const cards = [
    { label: 'Media', value: stats.media, href: '/media', color: '#2563eb' },
    { label: 'Documents', value: stats.documents, href: '/documents', color: '#16a34a' },
    { label: 'Workflows en attente', value: stats.workflowPending, href: '/workflow', color: '#d97706' },
  ];

  return (
    <>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Tableau de bord</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {cards.map((card) => (
          <a key={card.label} href={card.href} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{card.label}</p>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: card.color }}>{card.value}</p>
          </a>
        ))}
      </div>
    </>
  );
}
