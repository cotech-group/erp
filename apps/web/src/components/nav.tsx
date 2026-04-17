'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const mainNav = [
  { href: '/dashboard', emoji: '\u{1F4CA}', label: 'Tableau de bord' },
  { href: '/media', emoji: '\u{1F3AC}', label: 'Media' },
  { href: '/documents', emoji: '\u{1F4C4}', label: 'Documents' },
  { href: '/workflow', emoji: '\u{2705}', label: 'Workflows' },
];

const toolsNav = [
  { href: '/search', emoji: '\u{1F50D}', label: 'Recherche' },
  { href: '/notifications', emoji: '\u{1F514}', label: 'Notifications' },
  { href: '/audit', emoji: '\u{1F4DD}', label: 'Journal d\'audit' },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-icon">IN</div>
        <span className="sidebar-brand">INA ERP</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-label">Principal</div>
        {mainNav.map((item) => (
          <Link key={item.href} href={item.href} className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}>
            <span className="sidebar-link-emoji">{item.emoji}</span>
            {item.label}
          </Link>
        ))}

        <div className="sidebar-label">Outils</div>
        {toolsNav.map((item) => (
          <Link key={item.href} href={item.href} className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}>
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
