'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/media', label: 'Media' },
  { href: '/documents', label: 'Documents' },
  { href: '/workflow', label: 'Workflow' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav style={{
      background: '#1a1a2e', padding: '0 1rem', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between', height: '56px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link href="/dashboard" style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none' }}>
          INA ERP
        </Link>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: pathname === link.href ? '#fff' : '#94a3b8',
                padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem',
                background: pathname === link.href ? 'rgba(255,255,255,0.1)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={() => { api.logout(); window.location.href = '/login'; }}
        style={{
          background: 'transparent', border: '1px solid #475569', color: '#94a3b8',
          padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
        }}
      >
        Deconnexion
      </button>
    </nav>
  );
}
