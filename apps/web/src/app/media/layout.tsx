import { Nav } from '@/components/nav';

export default function MediaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="container" style={{ padding: '1.5rem 1rem' }}>{children}</main>
    </>
  );
}
