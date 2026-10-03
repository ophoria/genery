import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export interface Grant { path: string; recursive: boolean }
export interface User { id: string; username: string; role: 'admin' | 'moderator' | 'normal'; grants: Grant[] }
export interface Session { channel: 'local' | 'lan' | 'internet'; user: User | null; canManageUsers: boolean; canManageNetwork: boolean; loginRequired: boolean; connections: { lan: string[]; internet: string | null } }
export async function accessRequest(route: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api/access/${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not complete request. Try again.');
  return data;
}
const Context = createContext<Session | null>(null);
export function useAccess() {
  const session = useContext(Context);
  if (!session?.user) throw new Error('Authenticated session required.');
  return { ...session, user: session.user, canWrite: session.user.role !== 'normal', canDelete: session.user.role === 'admin' };
}
export function AccessProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  async function refresh() {
    try { setSession(await accessRequest('session')); setError(''); }
    catch (error) { setSession(null); setError((error as Error).message); }
  }
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    const expired = () => { setSession(null); void refresh(); };
    window.addEventListener('genery-session-expired', expired);
    return () => { window.clearInterval(timer); window.removeEventListener('genery-session-expired', expired); };
  }, []);
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await accessRequest('login', 'POST', { username, password }); setPassword(''); await refresh(); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  if (session?.user) return <Context.Provider key={`${session.user.id}:${session.user.role}:${JSON.stringify(session.user.grants)}`} value={session}>{children}</Context.Provider>;
  return <main className="access-login"><div className="color-sheet access-login-sheet">
    <h1>Genery</h1>
    {!session && !error ? <p role="status">Connecting…</p> : <>
      <p>{session?.channel === 'internet' ? 'Sign in to browse your image collection.' : 'Sign in to access this gallery.'}</p>
      <form onSubmit={event => void signIn(event)} className="access-form">
        <label>Username<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required maxLength={64} disabled={busy} autoFocus /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={128} disabled={busy} /></label>
        {error && <p className="settings-error" role="alert">{error}</p>}
        <button className="toolbar-button" type="submit" disabled={busy || !session}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {!session && <button className="toolbar-button" type="button" onClick={() => void refresh()}>Retry connection</button>}
      </form>
    </>}
  </div></main>;
}
