import { useEffect, useState } from "react";

const ROLE_OPTIONS = ["owner","admin","user","read_only"];

/** small helper so errors show real messages instead of [object Object] */
async function request(url, opts = {}) {
  const r = await fetch(url, { credentials: "include", ...opts });
  let text = "";
  let body = null;
  try { text = await r.text(); body = text ? JSON.parse(text) : null; } catch {}
  const msg = (body && (body.detail || body.error || body.message)) || (text || r.statusText || "Request failed");
  return { ok: r.ok, status: r.status, body, msg };
}

export default function UsersPage(){
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  // unified form state (add OR edit)
  const [formMode, setFormMode] = useState("add"); // "add" | "edit"
  const [formId, setFormId] = useState(null);
  const [formEmail, setFormEmail] = useState("");
  const [formPw, setFormPw] = useState(""); // optional in edit
  const [formRole, setFormRole] = useState("user");
  const [formEnabled, setFormEnabled] = useState(true);

  const [busy, setBusy] = useState(false);
  const [selfPw, setSelfPw] = useState("");

  async function loadMe(){
    try{
      const { ok, body, msg, status } = await request("/api/auth/me");
      if(!ok) throw new Error(`${status} ${msg}`);
      setMe(body);
    }catch(e){ setErr(String(e.message||e)); }
  }

  async function loadUsers(){
    try{
      const { ok, body, msg, status } = await request("/api/users");
      if(!ok) throw new Error(`${status} ${msg}`);
      setRows(body?.users || []);
    }catch(e){ setErr(String(e.message||e)); }
  }

  useEffect(()=>{ loadMe().then(loadUsers); },[]);

  const isAdmin = me && (me.role === "owner" || me.role === "admin");

  function clearForm(){
    setFormMode("add");
    setFormId(null);
    setFormEmail("");
    setFormPw("");
    setFormRole("user");
    setFormEnabled(true);
    setErr("");
  }

  function startEdit(u){
    setFormMode("edit");
    setFormId(u.id);
    setFormEmail(u.email);
    setFormPw("");
    setFormRole(u.role);
    setFormEnabled(!!u.enabled);
    setErr("");
  }

  async function onSubmit(){
    setErr("");
    setBusy(true);
    try{
      if(!isAdmin){
        setErr("Forbidden"); return;
      }

      if(formMode === "add"){
        if(!formEmail) throw new Error("Email required");
        if(!formPw || formPw.length < 8) throw new Error("Password must be at least 8 characters");

        const { ok, msg, status } = await request("/api/users", {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({
            email: formEmail,
            password: formPw,
            role: formRole,
            enabled: formEnabled
          })
        });
        if(!ok){ setErr(`${status} ${msg}`); return; }
        clearForm();
        await loadUsers();

      } else { // edit
        if(!formId){ setErr("No user selected"); return; }

        const body = {
          email: formEmail,
          role: formRole,
          enabled: formEnabled
        };
        if(formPw && formPw.length >= 8){
          body.new_password = formPw;
        }

        const { ok, msg, status } = await request(`/api/users/${formId}`, {
          method:"PATCH",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify(body)
        });
        if(!ok){ setErr(`${status} ${msg}`); return; }
        clearForm();
        await loadUsers();
      }
    }catch(e){
      setErr(String(e?.message ?? e ?? "Submit failed"));
    }finally{
      setBusy(false);
    }
  }

  async function selfChangePw(){
    try{
      if(selfPw.length < 8) throw new Error("Password must be at least 8 characters");
      const { ok, msg, status } = await request("/api/users/change-password", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ new_password: selfPw })
      });
      if(!ok) throw new Error(`${status} ${msg}`);
      setSelfPw("");
      alert("Password updated.");
    }catch(e){ setErr(String(e.message||e)); }
  }

  return (
    <div className="page">
      <h1 className="h1">User Management</h1>
      {err && <div style={{color:"#e11d48", marginBottom:8}}>{err}</div>}

      {!isAdmin ? (
        // Non-admins: self-only password change
        <div className="card" style={{maxWidth:520}}>
          {rows[0] && (
            <div style={{display:"grid",gap:8}}>
              <div><b>Email:</b> {rows[0].email}</div>
              <div><b>Role:</b> {rows[0].role}</div>
              <label>New password
                <input
                  type="password"
                  value={selfPw}
                  onChange={e=>setSelfPw(e.target.value)}
                  placeholder="at least 8 chars"
                />
              </label>
              <button className="btn" onClick={selfChangePw}>Change my password</button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Top form: Add or Update */}
          <div className="card" style={{marginBottom:12}}>
            <h3 style={{marginTop:0}}>{formMode === "add" ? "Add User" : "Update User"}</h3>
            <div style={{
              display:"grid",
              gridTemplateColumns:"1.5fr 1fr 1fr 1fr auto",
              gap:8, alignItems:"center"
            }}>
              <input
                placeholder="email@example.com"
                value={formEmail}
                onChange={e=>setFormEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder={formMode==="add" ? "password (≥ 8)" : "(optional) new pw (≥ 8)"}
                value={formPw}
                onChange={e=>setFormPw(e.target.value)}
              />
              <select value={formRole} onChange={e=>setFormRole(e.target.value)}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label style={{display:"flex",gap:6,alignItems:"center"}}>
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={e=>setFormEnabled(e.target.checked)}
                /> Enabled
              </label>
              <div style={{display:"flex",gap:8}}>
                <button className="btn" onClick={onSubmit} disabled={busy}>
                  {formMode==="add" ? "Add" : "Update"}
                </button>
                {formMode==="edit" && (
                  <button className="btn" onClick={clearForm} disabled={busy}>Clear</button>
                )}
              </div>
            </div>
          </div>

          {/* Users table: read-only with Edit button */}
          <div className="card">
            <table style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>Email</th>
                  <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>Role</th>
                  <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>Enabled</th>
                  <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id}>
                    <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>{u.email}</td>
                    <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>{u.role}</td>
                    <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>{u.enabled ? "Enabled" : "Disabled"}</td>
                    <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                      <button className="btn" onClick={()=>startEdit(u)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
