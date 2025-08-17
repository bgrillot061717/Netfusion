import { useEffect, useState } from "react";

const ROLE_OPTIONS = ["owner","admin","user","read_only"];

export default function UsersPage(){
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwById, setPwById] = useState({}); // temp new passwords keyed by user id
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

  async function saveRow(u){
    setBusy(true);
    try{
      const body = { role: u.role, enabled: u.enabled };
      if (pwById[u.id]?.length >= 8) body.new_password = pwById[u.id];
      const r = await fetch(`/api/users/${u.id}`, {
        method:"PATCH", headers:{ "Content-Type":"application/json" },
        credentials:"include", body: JSON.stringify(body)
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.detail||"Update failed");
      if (pwById[u.id]) {
        const next = { ...pwById }; delete next[u.id]; setPwById(next);
      }
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
        <div className="card">
          <table style={{width:"100%", borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>Email</th>
                <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>Role</th>
                <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>Enabled</th>
                <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>New Password</th>
                <th style={{textAlign:"left",borderBottom:"1px solid #e5e7eb",padding:"6px"}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(u=>(
                <tr key={u.id}>
                  <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>{u.email}</td>
                  <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                    <select value={u.role} onChange={e=>setRows(rows.map(x=>x.id===u.id?{...x, role:e.target.value}:x))}>
                      {ROLE_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                    <input type="checkbox" checked={u.enabled} onChange={e=>setRows(rows.map(x=>x.id===u.id?{...x, enabled:e.target.checked}:x))}/>
                  </td>
                  <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                    <input type="password" value={pwById[u.id]||""} onChange={e=>setPwById({...pwById, [u.id]: e.target.value})} placeholder="(optional) new pw" />
                  </td>
                  <td style={{borderBottom:"1px solid #f1f5f9",padding:"6px"}}>
                    <button className="btn" onClick={()=>saveRow(u)} disabled={busy}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
