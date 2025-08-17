import { useEffect, useState } from "react";

const ROLE_OPTIONS = ["owner","admin","user","read_only"];

export default function UsersPage(){
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // add user form (admin only)
  const [addEmail, setAddEmail] = useState("");
  const [addPw, setAddPw] = useState("");
  const [addRole, setAddRole] = useState("user");
  const [addEnabled, setAddEnabled] = useState(true);

  // per-row edit state
  const [editingId, setEditingId] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPw, setEditPw] = useState("");

  // self change password
  const [selfPw, setSelfPw] = useState("");

  async function loadMe(){
    try{
      const r = await fetch("/api/auth/me", { credentials:"include" });
      if(!r.ok) throw new Error("Not logged in");
      setMe(await r.json());
    }catch(e){ setErr(e.message); }
  }
  async function load(){
    try{
      const r = await fetch("/api/users", { credentials:"include" });
      const j = await r.json();
      if(!r.ok) throw new Error(j.detail||"Failed to load users");
      setRows(j.users||[]);
    }catch(e){ setErr(e.message); }
  }
  useEffect(()=>{ loadMe().then(load); },[]);

  const isAdmin = me && (me.role === "owner" || me.role === "admin");

  async function addUser(){
    if(!addEmail || addPw.length < 8) { alert("Provide email and a password (≥ 8 chars)"); return; }
    setBusy(true);
    try{
      const r = await fetch("/api/users", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        credentials:"include",
        body: JSON.stringify({ email:addEmail, password:addPw, role:addRole, enabled:addEnabled })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.detail||"Create failed");
      setAddEmail(""); setAddPw(""); setAddRole("user"); setAddEnabled(true);
      await load();
    }catch(e){ alert(e.message); } finally{ setBusy(false); }
  }

  function startEdit(u){
    setEditingId(u.id);
    setEditEmail(u.email);
    setEditPw("");
  }
  function cancelEdit(){
    setEditingId(null);
    setEditEmail("");
    setEditPw("");
  }

  async function saveRow(u){
    setBusy(true);
    try{
      const body = {
        email: editEmail !== u.email ? editEmail : undefined,
        role: u.role,
        enabled: u.enabled,
        new_password: editPw.length >= 8 ? editPw : undefined
      };
      const r = await fetch(`/api/users/${u.id}`, {
        method:"PATCH", headers:{ "Content-Type":"application/json" },
        credentials:"include", body: JSON.stringify(body)
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.detail||"Update failed");
      cancelEdit();
      await load();
    }catch(e){ alert(e.message); } finally{ setBusy(false); }
  }

  async function selfChangePw(){
    if (selfPw.length < 8) { alert("Password must be at least 8 characters"); return; }
    setBusy(true);
    try{
      const r = await fetch(`/api/users/change-password`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        credentials:"include", body: JSON.stringify({ new_password: selfPw })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.detail||"Change failed");
      setSelfPw("");
      alert("Password updated.");
    }catch(e){ alert(e.message); } finally{ setBusy(false); }
  }

  return (
    <div className="page">
      <h1 className="h1">User Management</h1>
      {err && <div style={{color:"#e11d48", marginBottom:8}}>{err}</div>}

      {!isAdmin ? (
        <div className="card" style={{maxWidth:520}}>
          {rows[0] &&
          <div style={{display:"grid",gap:8}}>
            <div><b>Email:</b> {rows[0].email}</div>
            <div><b>Role:</b> {rows[0].role}</div>
            <label>New password
              <input type="password" value={selfPw} onChange={e=>setSelfPw(e.target.value)} placeholder="at least 8 chars" />
            </label>
            <button className="btn" onClick={selfChangePw} disabled={busy}>Change my password</button>
          </div>}
        </div>
      ) : (
        <>
          {/* Add user form */}
          <div className="card" style={{marginBottom:12}}>
            <h3 style={{marginTop:0}}>Add User</h3>
            <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr auto",gap:8,alignItems:"center"}}>
              <input placeholder="email@example.com" value={addEmail} onChange={e=>setAddEmail(e.target.value)} />
              <input type="password" placeholder="password (≥ 8)" value={addPw} onChange={e=>setAddPw(e.target.value)} />
              <select value={addRole} onChange={e=>setAddRole(e.target.value)}>
                {ROLE_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <label style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="checkbox" checked={addEnabled} onChange={e=>setAddEnabled(e.target.checked)} /> Enabled
              </label>
              <button className="btn" onClick={addUser} disabled={busy}>Add</button>
            </div>
          </div>

          {/* Users table */}
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
                {rows.map(u=>{
                  const editing = editingId === u.id;
                  return (
                    <tr key={u.id}>
                      <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                        {!editing ? (
                          u.email
                        ) : (
                          <input value={editEmail} onChange={e=>setEditEmail(e.target.value)} />
                        )}
                      </td>
                      <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                        <select
                          value={u.role}
                          onChange={e=>setRows(rows.map(x=>x.id===u.id?{...x, role:e.target.value}:x))}
                          disabled={!isAdmin}
                        >
                          {ROLE_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                        <input
                          type="checkbox"
                          checked={u.enabled}
                          onChange={e=>setRows(rows.map(x=>x.id===u.id?{...x, enabled:e.target.checked}:x))}
                        />
                      </td>
                      <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                        {!editing ? (
                          <div style={{display:"flex",gap:8}}>
                            <button className="btn" onClick={()=>startEdit(u)}>Edit</button>
                            <button className="btn" onClick={()=>saveRow(u)} disabled={busy}>Save</button>
                          </div>
                        ) : (
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <input type="password" placeholder="(optional) new password (≥8)" value={editPw} onChange={e=>setEditPw(e.target.value)} />
                            <button className="btn" onClick={()=>saveRow(u)} disabled={busy}>Save</button>
                            <button className="btn" onClick={cancelEdit}>Cancel</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
