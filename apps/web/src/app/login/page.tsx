'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div className="sidebar-icon" style={{ width: 40, height: 40, fontSize: 16 }}>IN</div>
          <span className="login-title">INA ERP</span>
        </div>
        <p className="login-subtitle">Connectez-vous a votre espace de travail</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label className="input-label">Adresse email</label>
            <input
              type="email" className="input" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ina.local" required autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label">Mot de passe</label>
            <input
              type="password" className="input" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe" required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
