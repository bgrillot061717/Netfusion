import { useEffect, useState } from "react";

const ROLE_OPTIONS = ["owner","admin","user","read_only"];

/** Request helper that formats Pydantic's detail array into a readable string */
async function request(url, opts = {}) {
  const r = await fetch(url, { credentials: "include", ...opts });
  let text = "";
  let body = null;
  try { text = await r.text(); body = text ? JSON.parse(text) : null; } catch {}
  let msg = r.statusText || "Request failed";
  if (body) {
    if (Array.isArray(body.detail)) {
      msg = body.detail.map(e => {
        const loc = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : e.loc;
        return `${loc}: ${e.msg || e.message || e.type || "invalid"}`;
      }).join("; ");
    } else {
      msg = body.detail || body.error || body.message || text || msg;
    }
  } else if (text) {
    msg = text;
  }
  return { ok: r.ok, status: r.status, body, msg };
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
}

export default function UsersPage(){
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  // unified form state (add OR edit)
  const [formMode, setFormMode] = useState("add"); // "add" | "edit"
  const [formId, setFormId] = useState(null);
  const [formOrigEmail, setFormOrigEmail] = useState(""); // for 404 fallback
  const [formEmail, setFormEmail] = useState("");
  const [formPw, setFormPw] = useState(""); // optional in edit
  const [formRole, setFormRole] = useState("user");
  const [formEnabled, setFormEnabled] = useState(true);

  const [busy, setBusy] = useState(false);
  const [selfPw, setSelfPw] = useState("");

  async function loadMe(){
    setErr("");
    const { ok, body, msg, status } = await request("/api/auth/me");
    if(!ok){ setErr(`${status} ${msg}`); return; }
    setMe(body);
  }

  async function loadUsers(){
    setErr("");
    const { ok, body, msg, status } = await request("/api/users");
    if(!ok){ setErr(`${status} ${msg}`); return; }
    setRows(body?.users || []);
  }

  useEffect(()=>{ loadMe().then(loadUsers); },[]);

  const isAdmin = me && (me.role === "owner" || me.role === "admin");

  function clearForm(){
    setFormMode("add");
    setFormId(null);
    setFormOrigEmail("");
    setFormEmail("");
    setFormPw("");
    setFormRole("user");
    setFormEnabled(true);
    setErr("");
  }

  function startEdit(u){
    const uid = typeof u.id === "string" ? parseInt(u.id, 10) : u.id;
    setFormMode("edit");
    setFormId(Number.isFinite(uid) ? uid : u.id);
    setFormOrigEmail((u.email || "").toLowerCase());
    setFormEmail(u.email || "");
    setFormPw("");
    setFormRole(u.role || "user");
    setFormEnabled(!!u.enabled);
    setErr("");
  }

  async function onSubmit(){
    setErr("");
    setBusy(true);
    try{
      if(!isAdmin){ setErr("Forbidden"); return; }

      // Common validation
      if(!formEmail) { setErr("Email required"); return; }
      if(!isValidEmail(formEmail)) { setErr("Email is not valid"); return; }
      if(!ROLE_OPTIONS.includes(formRole)) { setErr("Invalid role"); return; }

      if(formMode === "add"){
        if(!formPw || formPw.length < 8) { setErr("Password must be at least 8 characters"); return; }
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
      } else {
        if(formId == null && !formOrigEmail){ setErr("No user selected"); return; }

        const body = { email: formEmail, role: formRole, enabled: formEnabled };
        if(formPw && formPw.length >= 8) body.new_password = formPw;

        // Try PATCH by numeric id first (if we have one)
        let triedById = false;
        if(formId != null){
          const uid = typeof formId === "string" ? parseInt(formId, 10) : formId;
          if(Number.isFinite(uid)){
            triedById = true;
            const r1 = await request(`/api/users/${uid}`, {
              method:"PATCH",
              headers:{ "Content-Type":"application/json" },
              body: JSON.stringify(body)
            });
            if(r1.ok){
              clearForm();
              await loadUsers();
              return;
            }
            // If the only failure is 404 (id mismatch), we will try by-email fallback below
            if(r1.status !== 404){
              setErr(`${r1.status} ${r1.msg}`);
              return;
            }
          }
        }

        // Fallback: PATCH by email (use original email captured on edit start)
        const targetEmail = (formOrigEmail || formEmail).toLowerCase();
        const r2 = await request(`/api/users/by-email/${encodeURIComponent(targetEmail)}`, {
          method:"PATCH",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify(body)
        });
        if(!r2.ok){
          const note = triedById ? " (id and email fallback both failed)" : "";
          setErr(`${r2.status} ${r2.msg}${note}`);
          return;
        }
        clearForm();
        await loadUsers();
      }
    } finally {
      setBusy(false);
    }
  }

  async function selfChangePw(){
    setErr("");
    if(selfPw.length < 8){ setErr("Password must be at least 8 characters"); return; }
    const { ok, msg, status } = await request("/api/users/change-password", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ new_password: selfPw })
    });
    if(!ok){ setErr(`${status} ${msg}`); return; }
    setSelfPw("");
    alert("Password updated.");
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
