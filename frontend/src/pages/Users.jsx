import { useEffect, useState } from "react";

const ROLE_OPTIONS = ["owner","admin","user","read_only"];

export default function UsersPage(){
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  // Top form state (used for both Add and Update)
  const [formMode, setFormMode] = useState("add"); // "add" | "edit"
  const [formId, setFormId] = useState(null);      // only in edit
  const [formEmail, setFormEmail] = useState("");
  const [formPw, setFormPw] = useState("");        // optional on edit
  const [formRole, setFormRole] = useState("user");
  const [formEnabled, setFormEnabled] = useState(true);

  const [busy, setBusy] = useState(false);

  async function loadMe(){
    try{
      const r = await fetch("/api/auth/me", { credentials:"include" });
      if(!r.ok) throw new Error("Not logged in");
      setMe(await r.json());
    }catch(e){ setErr(String(e.message||e)); }
  }
  async function loadUsers(){
    try{
      const r = await fetch("/api/users", { credentials:"include" });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.detail || j.error || "Failed to load users");
      setRows(j.users || []);
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
  }

  function startEdit(u){
    setFormMode("edit");
    setFormId(u.id);
    setFormEmail(u.email);
    setFormPw("");
    setFormRole(u.role);
    setFormEnabled(!!u.enabled);
  }

  async function onSubmit(){
    setErr("");
    setBusy(true);
    try{
      if(!isAdmin){
        // Non-admins only have self password change (handled elsewhere),
        // but we shouldn’t even render this form in that case.
        throw new Error("Forbidden");
      }

      if(formMode === "add"){
        if(!formEmail) throw new Error("Email required");
        if(!formPw || formPw.length < 8) throw new Error("Password must be at least 8 characters");
        const r = await fetch("/api/users", {
          method:"POST", credentials:"include",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({
            email: formEmail,
            password: formPw,
            role: formRole,
            enabled: formEnabled
          })
        });
        const j = await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.detail || j.error || "Create failed");
        clearForm();
        await loadUsers();
      } else { // edit
        if(!formId) throw new Error("No user selected");
        const body = {
          email: formEmail,
          role: formRole,
          enabled: formEnabled
        };
        if(formPw && formPw.length >= 8){
          body.new_password = formPw;
        }
        const r = await fetch(`/api/users/${formId}`, {
          method:"PATCH", credentials:"include",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify(body)
        });
        const j = await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.detail || j.error || "Update failed");
        clearForm();
        await loadUsers();
      }
    }catch(e){
      setErr(String(e.message||e));
      // Optionally also alert:
      // alert(String(e.message||e));
    }finally{
      setBusy(false);
    }
  }

  // Self-only password change for non-admins
  const [selfPw, setSelfPw] = useState("");
  async function selfChangePw(){
    try{
      if(selfPw.length < 8) throw new Error("Password must be at least 8 characters");
      const r = await fetch("/api/users/change-password", {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ new_password: selfPw })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.detail || j.error || "Change failed");
      setSelfPw("");
      alert("Password updated.");
    }catch(e){ setErr(String(e.message||e)); }
  }

  return (
    <div className="page">
      <h1 className="h1">User Management</h1>
      {err && <div style={{color:"#e11d48", marginBottom:8}}>{err}</div>}

      {!isAdmin ? (
        <div className="card" style={{maxWidth:520}}>
          {rows[0] && (
            <div style={{display:"grid",gap:8}}>
              <div><b>Email:</b> {rows[0].email}</div>
              <div><b>Role:</b> {rows[0].role}</div>
              <label>New password
                <input type="password" value={selfPw} onChange={e=>setSelfPw(e.target.value)} placeholder="at least 8 chars" />
              </label>
              <button className="btn" onClick={selfChangePw}>Change my password</button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Unified Add / Edit form */}
          <div className="card" style={{marginBottom:12}}>
            <h3 style={{marginTop:0}}>{formMode === "add" ? "Add User" : "Update User"}</h3>
            <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr auto",gap:8,alignItems:"center"}}>
              <input placeholder="email@example.com" value={formEmail} onChange={e=>setFormEmail(e.target.value)} />
              <input type="password" placeholder={formMode==="add" ? "password (≥ 8)" : "(optional) new pw (≥ 8)"} value={formPw} onChange={e=>setFormPw(e.target.value)} />
              <select value={formRole} onChange={e=>setFormRole(e.target.value)}>
                {ROLE_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <label style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="checkbox" checked={formEnabled} onChange={e=>setFormEnabled(e.target.checked)} /> Enabled
              </label>
              <div style={{display:"flex",gap:8}}>
                <button className="btn" onClick={onSubmit} disabled={busy}>{formMode==="add" ? "Add" : "Update"}</button>
                {formMode==="edit" && <button className="btn" onClick={clearForm}>Clear</button>}
              </div>
            </div>
          </div>

          {/* Users table (read-only, with single Edit button) */}
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
                {rows.map(u=>(
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
