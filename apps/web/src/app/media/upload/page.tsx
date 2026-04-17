'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001/api/v1';

export default function UploadMediaPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState('VIDEO');
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
    formData.append('mediaType', mediaType);
    if (description) formData.append('description', description);
    formData.append('file', file);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_URL}/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Erreur ${res.status}`);
      }

      router.push('/media');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Upload media">
      <div className="card card-body" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="input-group">
            <label className="input-label">Titre *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Titre du media" />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description optionnelle" />
          </div>

          <div className="input-group">
            <label className="input-label">Type *</label>
            <select className="input select" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
              <option value="IMAGE">Image</option>
              <option value="DOCUMENT">Document</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Fichier *</label>
            <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>

          {error && <div className="login-error">{error}</div>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Upload en cours...' : 'Uploader'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => router.push('/media')}>Annuler</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
