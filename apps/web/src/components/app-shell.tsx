'use client';

import { Sidebar } from './nav';

export function AppShell({ title, actions, children }: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div className="main-content">
        <header className="page-header">
          <h1>{title}</h1>
          {actions && <div style={{ display: 'flex', gap: '0.5rem' }}>{actions}</div>}
        </header>
        <div className="page-body">
          {children}
        </div>
      </div>
    </div>
  );
}
