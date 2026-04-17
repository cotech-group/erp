'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const navItems = [
  { href: '/dashboard', emoji: '\u{1F4CA}', label: 'Tableau de bord' },
  { href: '/media', emoji: '\u{1F3AC}', label: 'Media' },
  { href: '/documents', emoji: '\u{1F4C4}', label: 'Documents' },
  { href: '/workflow', emoji: '\u{2705}', label: 'Workflows' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-icon">IN</div>
        <span className="sidebar-brand">INA ERP</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-label">Navigation</div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
          >
            <span className="sidebar-link-emoji">{item.emoji}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          onClick={() => { api.logout(); window.location.href = '/login'; }}
          className="sidebar-link"
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <span className="sidebar-link-emoji">{'\u{1F6AA}'}</span>
          Deconnexion
        </button>
      </div>
    </aside>
  );
}
