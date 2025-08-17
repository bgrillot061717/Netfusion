import { useEffect, useState } from "react";
import { apiUsersList, apiUsersCreate } from "../usersApi";

const ROLES = [
  {value:"owner", label:"Owner"},
  {value:"admin", label:"Admin"},
  {value:"user", label:"User"},
  {value:"read_only", label:"Read only"},
];

export default function Users(){
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({email:"", password:"", role:"user"});
  const [busy, setBusy] = useState(false);

  async function load(){
    setLoading(true); setErr("");
    try {
      const j = await apiUsersList();
      setItems(j.users || []);
    } catch(e) {
      setErr(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  async function onCreate(e){
    e.preventDefault();
    setBusy(true); setErr("");
    try{
      await apiUsersCreate(form);
      setForm({email:"", password:"", role:"user"});
      await load();
    }catch(e){
      setErr(e.message);
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1 className="h1">User Management</h1>

      <div className="card" style={{maxWidth:560, marginBottom:12}}>
        <h3 style={{marginTop:0}}>Add user</h3>
        <form onSubmit={onCreate} style={{display:"grid", gap:8}}>
          <label>Email
            <input type="email" required value={form.email}
                   onChange={e=>setForm({...form, email:e.target.value})}/>
          </label>
          <label>Password
            <input type="password" required minLength={8} value={form.password}
                   onChange={e=>setForm({...form, password:e.target.value})}/>
          </label>
          <label>Role
            <select value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
              {ROLES.map(r=> <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {err && <div style={{color:"#e63946"}}>{err}</div>}
          <div>
            <button className="btn" type="submit" disabled={busy}>{busy?"Creating…":"Create user"}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{marginTop:0}}>All users</h3>
        {loading ? <div>Loading…</div> :
         items.length === 0 ? <div>No users yet.</div> :
         <table style={{width:"100%", borderCollapse:"collapse"}}>
           <thead>
             <tr>
               <th style={{textAlign:"left", borderBottom:"1px solid #e5e7eb", padding:"6px"}}>Email</th>
               <th style={{textAlign:"left", borderBottom:"1px solid #e5e7eb", padding:"6px"}}>Role</th>
             </tr>
           </thead>
           <tbody>
             {items.map(u=>(
               <tr key={u.email}>
                 <td style={{borderBottom:"1px solid #f1f5f9", padding:"6px"}}>{u.email}</td>
                 <td style={{borderBottom:"1px solid #f1f5f9", padding:"6px"}}>{u.role}</td>
               </tr>
             ))}
           </tbody>
         </table>
        }
      </div>
    </div>
  );
}
