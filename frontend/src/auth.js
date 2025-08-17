export async function apiMe() {
  const r = await fetch('/api/auth/me', { credentials: 'include' });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error('me failed');
  return r.json();
}
export async function apiLogin(email, password) {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    credentials: 'include', body: JSON.stringify({ email, password })
  });
  if (!r.ok) {
    const j = await r.json().catch(()=>({detail:'Login failed'}));
    throw new Error(j.detail || 'Login failed');
  }
  return r.json();
}
export async function apiFirstRun(email, password) {
  const r = await fetch('/api/auth/first-run', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    credentials: 'include', body: JSON.stringify({ email, password })
  });
  if (!r.ok) {
    const j = await r.json().catch(()=>({detail:'Setup failed'}));
    throw new Error(j.detail || 'Setup failed');
  }
  return r.json();
}
export async function apiLogout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}
