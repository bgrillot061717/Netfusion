export async function apiUsersList() {
  const r = await fetch('/api/users', { credentials: 'include' });
  if (r.status === 403) throw new Error('Forbidden (admin/owner only)');
  if (!r.ok) throw new Error('Failed to fetch users');
  return r.json();
}
export async function apiUsersCreate({email,password,role}) {
  const r = await fetch('/api/users', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'include',
    body: JSON.stringify({ email, password, role })
  });
  if (!r.ok) {
    const j = await r.json().catch(()=>({detail:'Create failed'}));
    throw new Error(j.detail || 'Create failed');
  }
  return r.json();
}
