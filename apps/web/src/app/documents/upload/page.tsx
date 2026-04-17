'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001/api/v1';

export default function UploadDocumentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Selectionnez un fichier'); return; }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (classification) formData.append('classification', classification);
    if (tags) {
      tags.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => formData.append('tags', t));
    }
    formData.append('file', file);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Erreur ${res.status}`);
      }

      router.push('/documents');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Deposer un document">
      <div className="card card-body" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="input-group">
            <label className="input-label">Titre *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Titre du document" />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description optionnelle" />
          </div>

          <div className="input-group">
            <label className="input-label">Classification</label>
            <select className="input select" value={classification} onChange={(e) => setClassification(e.target.value)}>
              <option value="">Aucune</option>
              <option value="finance">Finance</option>
              <option value="rh">Ressources Humaines</option>
              <option value="technique">Technique</option>
              <option value="juridique">Juridique</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Tags (separes par des virgules)</label>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rapport, annuel, 2026" />
          </div>

          <div className="input-group">
            <label className="input-label">Fichier *</label>
            <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>

          {error && <div className="login-error">{error}</div>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Depot en cours...' : 'Deposer'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => router.push('/documents')}>Annuler</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
