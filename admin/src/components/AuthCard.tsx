import type { ReactNode } from 'react';

// Centered card used by the pages shown outside the main layout (login and
// the forced password change).
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/favicon.png" alt="" width={56} height={56} />
          <h1>{title}</h1>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </main>
  );
}
