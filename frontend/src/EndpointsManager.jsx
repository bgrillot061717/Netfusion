import { useEffect, useState } from "react";

const KINDS = ["unifi","auvik","generic"];
const AUTHS = ["userpass","apikey","token"];

export default function EndpointsManager(){
  const [items,setItems] = useState([]);
  const [err,setErr] = useState("");
  const [busy,setBusy] = useState(false);
  const [form,setForm] = useState({
    name:"", kind:"unifi", address:"", auth_type:"userpass",
    username:"", password:"", api_key:"", site:"", notes:""
  });

  async function load(){
    setErr("");
    try{
      const r = await fetch('/api/endpoints', { credentials:'include' });
      if(!r.ok) throw new Error('Failed to fetch');
      const j = await r.json();
      setItems(j.endpoints||[]);
    }catch(e){ setErr(e.message); setItems([]); }
  }
  useEffect(()=>{ load(); },[]);

  async function create(e){
    e.preventDefault();
    setBusy(true); setErr("");
    try{
      const r = await fetch('/api/endpoints', {
        method:'POST', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify(form)
      });
      if(!r.ok){ const t = await r.text(); throw new Error(t||'Create failed'); }
      setForm({name:"",kind:"unifi",address:"",auth_type:"userpass",username:"",password:"",api_key:"",site:"",notes:""});
      await load();
    }catch(e){ setErr(e.message); } finally{ setBusy(false); }
  }

  async function remove(id){
    if(!confirm('Delete this endpoint?')) return;
    setBusy(true);
    try{
      const r = await fetch(`/api/endpoints/${id}`, { method:'DELETE', credentials:'include' });
      if(!r.ok) throw new Error('Delete failed');
      await load();
    }catch(e){ alert(e.message); } finally{ setBusy(false); }
  }

  return (
    <div className="card" style={{marginTop:16}}>
      <h3 style={{marginTop:0}}>Endpoints</h3>
      <form onSubmit={create} style={{display:'grid',gap:8,gridTemplateColumns:'repeat(2, minmax(220px, 1fr))'}}>
        <label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
        <label>Kind
          <select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}>
            {KINDS.map(k=><option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label>Address / Base URL<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} required/></label>
        <label>Auth Type
          <select value={form.auth_type} onChange={e=>setForm({...form,auth_type:e.target.value})}>
            {AUTHS.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        {form.auth_type==="userpass" && <>
          <label>Username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label>
          <label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
        </>}
        {form.auth_type!=="userpass" && <>
          <label>API Key / Token<input value={form.api_key} onChange={e=>setForm({...form,api_key:e.target.value})}/></label>
          <div />
        </>}
        <label>Site (optional)<input value={form.site} onChange={e=>setForm({...form,site:e.target.value})}/></label>
        <label>Notes<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <div style={{gridColumn:'1 / -1'}}>
          {err && <div style={{color:'#e63946',marginBottom:8}}>{err}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy?'Saving…':'Add endpoint'}</button>
        </div>
      </form>

      <div style={{marginTop:12}}>
        {items.length===0 ? <div>No endpoints yet.</div> :
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Name</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Kind</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Address</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Auth</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Site</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length>0 && items.map(ep=>(
                <tr key={ep.id}>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.name}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.kind}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.address}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.auth_type}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.site||""}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>
                    <button className="btn" onClick={()=>remove(ep.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>
  );
}
