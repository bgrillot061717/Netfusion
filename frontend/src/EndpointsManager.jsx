import { useEffect, useState } from "react";

const KINDS = ["unifi","auvik","generic"];
const AUTHS = ["userpass","apikey","token"];

export default function EndpointsManager(){
  const [items,setItems] = useState([]);
  const [err,setErr] = useState("");
  const [busy,setBusy] = useState(false);
  const [form,setForm] = useState({
    name:"", kind:"unifi", address:"", auth_type:"userpass",
    username:"", password:"", api_key:"", site:"", notes:"",
    enabled:true, snmp_version:"2c", snmp_community:""
  });
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState(null);

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
      setForm({name:"",kind:"unifi",address:"",auth_type:"userpass",username:"",password:"",api_key:"",site:"",notes:"",enabled:true,snmp_version:"2c",snmp_community:""});
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

  async function toggle(id, enabled){
    setBusy(true);
    try{
      const r = await fetch(`/api/endpoints/${id}/toggle`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify({ enabled })
      });
      if(!r.ok) throw new Error('Toggle failed');
      await load();
    }catch(e){ alert(e.message); } finally{ setBusy(false); }
  }

  function startEdit(ep){
    setEditId(ep.id);
    setEditData({...ep});
  }

  async function saveEdit(){
    setBusy(true);
    try{
      const r = await fetch(`/api/endpoints/${editId}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify(editData)
      });
      if(!r.ok) throw new Error('Update failed');
      setEditId(null); setEditData(null);
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

        <label>SNMP Version<input value={form.snmp_version} onChange={e=>setForm({...form,snmp_version:e.target.value})} placeholder="e.g., 2c"/></label>
        <label>SNMP Community<input value={form.snmp_community} onChange={e=>setForm({...form,snmp_community:e.target.value})} placeholder="public"/></label>

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
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Enabled</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(ep=>(
                <tr key={ep.id}>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.name}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.kind}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.address}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.auth_type}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{ep.enabled?'Yes':'No'}</td>
                  <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px',display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button className="btn" onClick={()=>toggle(ep.id, !ep.enabled)} disabled={busy}>{ep.enabled?'Disable':'Enable'}</button>
                    <button className="btn" onClick={()=>startEdit(ep)} disabled={busy}>Edit</button>
                    <button className="btn" onClick={()=>remove(ep.id)} disabled={busy}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>

      {editId && editData &&
        <div className="card" style={{marginTop:12}}>
          <h3 style={{marginTop:0}}>Edit endpoint</h3>
          <div style={{display:'grid',gap:8,gridTemplateColumns:'repeat(2, minmax(220px, 1fr))'}}>
            <label>Name<input value={editData.name||""} onChange={e=>setEditData({...editData, name:e.target.value})}/></label>
            <label>Kind
              <select value={editData.kind||"generic"} onChange={e=>setEditData({...editData, kind:e.target.value})}>
                {KINDS.map(k=><option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label>Address / Base URL<input value={editData.address||""} onChange={e=>setEditData({...editData,address:e.target.value})}/></label>
            <label>Auth Type
              <select value={editData.auth_type||"userpass"} onChange={e=>setEditData({...editData,auth_type:e.target.value})}>
                {AUTHS.map(a=><option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            {editData.auth_type==="userpass" && <>
              <label>Username<input value={editData.username||""} onChange={e=>setEditData({...editData,username:e.target.value})}/></label>
              <label>Password<input type="password" value={editData.password||""} onChange={e=>setEditData({...editData,password:e.target.value})}/></label>
            </>}
            {editData.auth_type!=="userpass" && <>
              <label>API Key / Token<input value={editData.api_key||""} onChange={e=>setEditData({...editData,api_key:e.target.value})}/></label>
              <div />
            </>}
            <label>SNMP Version<input value={editData.snmp_version||""} onChange={e=>setEditData({...editData,snmp_version:e.target.value})}/></label>
            <label>SNMP Community<input value={editData.snmp_community||""} onChange={e=>setEditData({...editData,snmp_community:e.target.value})}/></label>
            <label>Site<input value={editData.site||""} onChange={e=>setEditData({...editData,site:e.target.value})}/></label>
            <label>Notes<input value={editData.notes||""} onChange={e=>setEditData({...editData,notes:e.target.value})}/></label>
            <div style={{gridColumn:'1 / -1', display:'flex', gap:8}}>
              <button className="btn" onClick={saveEdit} disabled={busy}>Save</button>
              <button className="btn" onClick={()=>{setEditId(null); setEditData(null);}}>Cancel</button>
            </div>
          </div>
        </div>
      }
    </div>
  );
}
