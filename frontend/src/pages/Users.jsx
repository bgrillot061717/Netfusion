import { useEffect, useState } from "react";

const ROLE_OPTIONS = ["owner","admin","user","read_only"];

async function request(url, opts = {}) {
  const r = await fetch(url, { credentials:"include", ...opts });
  let text = ""; let body=null;
  try{ text = await r.text(); body = text?JSON.parse(text):null;}catch{}
  let msg = r.statusText||"Request failed";
  if(body){
    if(Array.isArray(body.detail)){
      msg = body.detail.map(e=>{
        const loc=Array.isArray(e.loc)?e.loc[e.loc.length-1]:e.loc;
        return `${loc}: ${e.msg||e.message||e.type||"invalid"}`;
      }).join("; ");
    } else {
      msg = body.detail||body.error||body.message||text||msg;
    }
  } else if(text) msg=text;
  return {ok:r.ok,status:r.status,body,msg};
}

function isValidEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||""); }

export default function UsersPage(){
  const [me,setMe]=useState(null);
  const [rows,setRows]=useState([]);
  const [err,setErr]=useState("");

  const [mode,setMode]=useState("add"); // add or edit
  const [formEmail,setFormEmail]=useState("");
  const [formPw,setFormPw]=useState("");
  const [formRole,setFormRole]=useState("user");
  const [formEnabled,setFormEnabled]=useState(true);
  const [busy,setBusy]=useState(false);
  const [selfPw,setSelfPw]=useState("");

  useEffect(()=>{ loadMe().then(loadUsers); },[]);

  async function loadMe(){
    const {ok,body,msg,status}=await request("/api/auth/me");
    if(!ok){setErr(`${status} ${msg}`);return;}
    setMe(body);
  }
  async function loadUsers(){
    const {ok,body,msg,status}=await request("/api/users");
    if(!ok){setErr(`${status} ${msg}`);return;}
    setRows(body?.users||[]);
  }

  const isAdmin = me && (me.role==="owner"||me.role==="admin");

  function clearForm(){
    setMode("add");
    setFormEmail("");
    setFormPw("");
    setFormRole("user");
    setFormEnabled(true);
    setErr("");
  }

  function startEdit(u){
    setMode("edit");
    setFormEmail(u.email); // immutable
    setFormPw("");
    setFormRole(u.role);
    setFormEnabled(u.enabled);
  }

  async function onSubmit(){
    setErr(""); setBusy(true);
    try{
      if(!isAdmin){setErr("Forbidden");return;}
      if(!formEmail){setErr("Email required");return;}
      if(!isValidEmail(formEmail)){setErr("Invalid email");return;}
      if(!ROLE_OPTIONS.includes(formRole)){setErr("Invalid role");return;}

      if(mode==="add"){
        if(!formPw||formPw.length<8){setErr("Password ≥8 required");return;}
        // check duplicate
        const exists=await request(`/api/users/exists/${encodeURIComponent(formEmail)}`);
        if(exists.ok && exists.body.exists){
          alert("User already exists");
          return;
        }
        const {ok,msg,status}=await request("/api/users",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email:formEmail,password:formPw,role:formRole,enabled:formEnabled})
        });
        if(!ok){setErr(`${status} ${msg}`);return;}
        clearForm(); await loadUsers();
      } else {
        const body={role:formRole,enabled:formEnabled};
        if(formPw && formPw.length>=8) body.new_password=formPw;
        const {ok,msg,status}=await request(`/api/users/by-email/${encodeURIComponent(formEmail)}`,{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(body)
        });
        if(!ok){setErr(`${status} ${msg}`);return;}
        clearForm(); await loadUsers();
      }
    } finally { setBusy(false); }
  }

  async function selfChangePw(){
    if(selfPw.length<8){setErr("Password ≥8 required");return;}
    const {ok,msg,status}=await request("/api/users/change-password",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({new_password:selfPw})
    });
    if(!ok){setErr(`${status} ${msg}`);return;}
    setSelfPw(""); alert("Password updated");
  }

  return (
    <div className="page">
      <h1>User Management</h1>
      {err && <div style={{color:"red"}}>{err}</div>}
      {!isAdmin ? (
        <div className="card">
          {rows[0]&&(<>
            <div><b>Email:</b> {rows[0].email}</div>
            <div><b>Role:</b> {rows[0].role}</div>
            <input type="password" value={selfPw} onChange={e=>setSelfPw(e.target.value)} placeholder="new password ≥8"/>
            <button onClick={selfChangePw}>Change my password</button>
          </>)}
        </div>
      ):(
        <>
          <div className="card">
            <h3>{mode==="add"?"Add User":"Update User"}</h3>
            <input value={formEmail} disabled={mode==="edit"} onChange={e=>setFormEmail(e.target.value)} placeholder="email@example.com"/>
            <input type="password" value={formPw} onChange={e=>setFormPw(e.target.value)} placeholder={mode==="add"?"password ≥8":"(optional) new pw"}/>
            <select value={formRole} onChange={e=>setFormRole(e.target.value)}>
              {ROLE_OPTIONS.map(r=><option key={r}>{r}</option>)}
            </select>
            <label><input type="checkbox" checked={formEnabled} onChange={e=>setFormEnabled(e.target.checked)}/> Enabled</label>
            <button onClick={onSubmit} disabled={busy}>{mode==="add"?"Add":"Update"}</button>
            {mode==="edit"&&<button onClick={clearForm}>Clear</button>}
          </div>
          <div className="card">
            <table>
              <thead><tr><th>Email</th><th>Role</th><th>Enabled</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map(u=><tr key={u.email}>
                  <td>{u.email}</td><td>{u.role}</td><td>{u.enabled?"Yes":"No"}</td>
                  <td><button onClick={()=>startEdit(u)}>Edit</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
