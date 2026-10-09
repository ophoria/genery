import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { accessRequest, useAccess, type Grant, type User } from './AccessProvider';
interface NetworkSettings { lanEnabled: boolean; lanPassword: boolean; internetEnabled: boolean; publicOrigin: string; guestRole: 'normal' | 'moderator'; guestGrants: Grant[] }
interface Connections { lan: string[]; internet: string | null }
function ConnectionAddresses({ addresses, emptyText }: { addresses: string[]; emptyText?: string }) {
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  async function copy(address: string) {
    setCopied(''); setCopyError('');
    try {
      let success = false;
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(address); success = true; } catch { /* Try the browser's copy command below. */ }
      }
      if (!success) {
        // Password-free LAN pages can be HTTP, where Clipboard API is unavailable.
        const previousFocus = document.activeElement as HTMLElement | null;
        const field = document.createElement('textarea');
        field.value = address; field.readOnly = true; field.setAttribute('aria-hidden', 'true');
        field.style.position = 'fixed'; field.style.left = '-9999px';
        document.body.append(field); field.select();
        try { success = document.execCommand('copy'); }
        finally { field.remove(); previousFocus?.focus(); }
      }
      if (!success) throw new Error('Could not access the clipboard. Select the address and copy it manually.');
      setCopied(address);
    } catch (error) { setCopyError(error instanceof Error ? error.message : 'Could not copy. Select the address and copy it manually.'); }
  }
  return <div className="access-connections">
    {addresses.map(address => <div className="access-connection" key={address}>
      <code>{address}</code><button className="toolbar-button" type="button" onClick={() => void copy(address)} aria-label={`Copy connection address ${address}`}><Copy aria-hidden="true" /><span>{copied === address ? 'Copied' : 'Copy'}</span></button>
    </div>)}
    {!addresses.length && emptyText && <p className="settings-hint">{emptyText}</p>}
    {copied && <span className="access-copy-status" role="status">Connection address copied.</span>}
    {copyError && <p className="settings-error" role="alert">{copyError}</p>}
  </div>;
}
function GrantEditor({ grants, onChange }: { grants: Grant[]; onChange: (grants: Grant[]) => void }) {
  return <fieldset className="access-grants"><legend>Allowed image directories</legend>
    <p className="settings-hint">Access stays inside these folders. Choose whether each grant includes subfolders.</p>
    {grants.map((grant, index) => <div className="access-grant" key={index}>
      <label>Directory {index + 1}<input value={grant.path} placeholder="Absolute directory path" onChange={event => onChange(grants.map((item, i) => i === index ? { ...item, path: event.target.value } : item))} required /></label>
      <label className="access-check"><input type="checkbox" checked={grant.recursive} onChange={event => onChange(grants.map((item, i) => i === index ? { ...item, recursive: event.target.checked } : item))} />Include subfolders</label>
      <button className="ai-text-button" type="button" onClick={() => onChange(grants.filter((_, i) => i !== index))}>Remove directory {index + 1}</button>
    </div>)}
    <button className="toolbar-button" type="button" onClick={() => onChange([...grants, { path: '', recursive: false }])}>Add directory</button>
  </fieldset>;
}
export function AccessSettings() {
  const session = useAccess();
  const [settings, setSettings] = useState<NetworkSettings | null>(null);
  const [connections, setConnections] = useState<Connections>({ lan: [], internet: null });
  const [lanHosts, setLanHosts] = useState<string[]>([]);
  const [tlsConfigured, setTLSConfigured] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<User['role']>('normal');
  const [grants, setGrants] = useState<Grant[]>([{ path: '', recursive: false }]);
  async function load() {
    const work = [];
    if (session.canManageNetwork) work.push(accessRequest('settings').then(data => { setSettings(data.settings); setConnections(data.connections); setLanHosts(data.lanHosts || []); setTLSConfigured(data.tlsConfigured); }));
    if (session.canManageUsers) work.push(accessRequest('users').then(data => setUsers(data.users)));
    await Promise.all(work);
  }
  useEffect(() => { void load().catch(error => setError(error.message)); }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  function clearForm() { setEditing(null); setUsername(''); setPassword(''); setRole('normal'); setGrants([{ path: '', recursive: false }]); }
  return <section className="settings-body access-settings" aria-label="Access settings">
    <h2>Access</h2>
    <p>Signed in as <strong>{session.user.username}</strong> · {session.user.role}. {session.channel === 'local' ? 'Local machine' : session.channel === 'lan' ? 'Local network' : 'Internet'} connection.</p>
    {session.user.id !== 'local-owner' && session.user.id !== 'lan-guest' && <button className="toolbar-button" type="button" disabled={busy} onClick={() => void run(async () => { await accessRequest('logout', 'POST', {}); window.dispatchEvent(new Event('genery-session-expired')); })}>Sign out</button>}
    {!session.canManageNetwork && <ConnectionAddresses addresses={[...session.connections.lan, ...(session.connections.internet ? [session.connections.internet] : [])]} />}
    {session.canManageNetwork && settings && <form className="access-form access-section" onSubmit={event => { event.preventDefault(); void run(async () => { const data = await accessRequest('settings', 'POST', settings); setSettings(data.settings); setConnections(data.connections); setLanHosts(data.lanHosts || []); setNotice('Network settings saved. Remote sessions have been signed out.'); }); }}>
      <fieldset disabled={busy}>
        <legend>Local network</legend>
        <label className="access-check"><input type="checkbox" checked={settings.lanEnabled} onChange={event => setSettings({ ...settings, lanEnabled: event.target.checked })} />Allow access on the local network</label>
        <label>Access mode<select value={settings.lanPassword ? 'password' : 'guest'} onChange={event => setSettings({ ...settings, lanPassword: event.target.value === 'password' })}><option value="password">Username and password (HTTPS)</option><option value="guest">No password</option></select></label>
        <p className="settings-hint">Share the connection address shown below. Disable LAN access and save before changing its access mode.</p>
        <ConnectionAddresses addresses={lanHosts.map(host => `${settings.lanPassword ? 'https' : 'http'}://${host}`)} emptyText="No local network address found. Connect this machine to a local network to show its address." />
        {lanHosts.length > 0 && !connections.lan.length && <p className="settings-hint">These addresses work once local network access is enabled and saved.</p>}
        {!settings.lanPassword && <><label>Guest permissions<select value={settings.guestRole} onChange={event => setSettings({ ...settings, guestRole: event.target.value as NetworkSettings['guestRole'] })}><option value="normal">Read only</option><option value="moderator">Moderator (cannot delete files)</option></select></label><GrantEditor grants={settings.guestGrants} onChange={guestGrants => setSettings({ ...settings, guestGrants })} /></>}
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Internet</legend>
        <label className="access-check"><input type="checkbox" checked={settings.internetEnabled} onChange={event => setSettings({ ...settings, internetEnabled: event.target.checked })} />Allow access from the internet</label>
        <label>Public HTTPS address<input type="url" placeholder="https://gallery.example.com:3443" value={settings.publicOrigin} onChange={event => setSettings({ ...settings, publicOrigin: event.target.value })} /></label>
        {connections.internet && <ConnectionAddresses addresses={[connections.internet]} />}
        <p className="settings-hint">Username and password are always required. Accounts can only be managed from the local machine or local network.</p>
      </fieldset>
      <p className="settings-hint">{tlsConfigured ? 'TLS certificate and key are configured.' : 'HTTPS requires a certificate and key configured on the local server.'} Set GENERY_TLS_CERT and GENERY_TLS_KEY before starting the server. Internet access also needs a reachable public address and router/firewall configuration.</p>
      <button className="toolbar-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save network settings'}</button>
    </form>}
    {session.canManageUsers && <div className="access-section">
      <h2>Users</h2>
      <p>Admins have full gallery access. Moderators can organize authorized images but cannot delete files. Normal users can browse, search, filter, and read.</p>
      {!users.length && <p>Create an administrator first to enable password access.</p>}
      <ul className="access-user-list">{users.map(user => <li key={user.id}><div><strong>{user.username}</strong><span>{user.role}</span>{user.role !== 'admin' && <small>{user.grants.map(grant => `${grant.path}${grant.recursive ? ' (includes subfolders)' : ''}`).join(', ')}</small>}</div>
        <button type="button" className="ai-text-button" disabled={busy} onClick={() => { setEditing(user.id); setUsername(user.username); setRole(user.role); setGrants(user.grants); setPassword(''); }}>Edit</button>
        <button type="button" className="ai-text-button" disabled={busy} onClick={() => { if (window.confirm(`Remove account ${user.username}? This signs out active sessions.`)) void run(async () => { await accessRequest(`users/${user.id}`, 'DELETE', {}); await load(); setNotice('Account removed.'); }); }}>Remove</button>
      </li>)}</ul>
      <form className="access-form" onSubmit={event => { event.preventDefault(); void run(async () => { await accessRequest(editing ? `users/${editing}` : 'users', editing ? 'PATCH' : 'POST', { username, role, grants, ...(password ? { password } : {}) }); clearForm(); await load(); setNotice(editing ? 'Account updated. Existing sessions have been signed out.' : 'Account created.'); }); }}>
        <h3>{editing ? `Edit ${username}` : 'Create a user'}</h3>
        <fieldset disabled={busy}>
          {!editing && <label>Username<input autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{2,63}" /></label>}
          <label>{editing ? 'New password (leave blank to keep current)' : 'Password'}<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required={!editing} minLength={15} maxLength={128} /></label>
          <p className="settings-hint">Use a unique password or passphrase of at least 15 characters.</p>
          <label>Role<select value={role} onChange={event => setRole(event.target.value as User['role'])}><option value="admin">Administrator</option><option value="moderator">Moderator</option><option value="normal">Normal (read only)</option></select></label>
          {role !== 'admin' && <GrantEditor grants={grants} onChange={setGrants} />}
        </fieldset>
        <div className="access-actions"><button className="toolbar-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save user' : 'Create user'}</button>{editing && <button className="toolbar-button" type="button" disabled={busy} onClick={clearForm}>Cancel edit</button>}</div>
      </form>
    </div>}
    {!session.canManageUsers && <p className="settings-hint">User management is available to administrators connecting locally or over the local network.</p>}
    {error && <p className="settings-error" role="alert">{error}</p>}
    {notice && <p className="settings-status" role="status">{notice}</p>}
  </section>;
}
