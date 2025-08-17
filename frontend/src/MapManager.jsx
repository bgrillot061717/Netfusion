import { useEffect, useRef, useState } from "react";

export default function MapManager(){
  const [list, setList] = useState([]);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(){
    setErr("");
    try{
      const r = await fetch('/api/maps', { credentials:'include' });
      const j = await r.json();
      setList(j.maps || []);
      setActive(j.active_id || null);
    }catch(e){ setErr('Failed to load maps'); }
  }

  useEffect(()=>{ load(); },[]);

  async function create(){
    if(!name.trim()) return;
    setBusy(true);
    try{
      const r = await fetch('/api/maps', {
        method:'POST', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify({ name })
      });
      if(!r.ok){ throw new Error(await r.text()); }
      setName(""); await load();
    }catch(e){ alert(e.message || 'Create failed'); }
    finally{ setBusy(false); }
  }

  async function makeActive(id){
    setBusy(true);
    try{
      const r = await fetch('/api/maps/active', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify({ id })
      });
      if(!r.ok){ throw new Error(await r.text()); }
      await load();
    }catch(e){ alert(e.message||'Failed'); }
    finally{ setBusy(false); }
  }

  async function uploadTo(id, file){
    const fd = new FormData(); fd.append('file', file);
    setBusy(true);
    try{
      const r = await fetch(`/api/maps/${id}/image`, { method:'POST', body:fd, credentials:'include' });
      if(!r.ok){ throw new Error(await r.text()); }
      await load();
    }catch(e){ alert(e.message||'Upload failed'); }
    finally{
      setBusy(false); if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="card" style={{marginTop:16}}>
      <h3 style={{marginTop:0}}>Maps</h3>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:8}}>
        <input placeholder="New map name" value={name} onChange={e=>setName(e.target.value)} />
        <button className="btn" onClick={create} disabled={busy}>Create</button>
      </div>
      {err && <div style={{color:'#e63946'}}>{err}</div>}
      {list.length===0 ? <div>No maps yet.</div> :
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px">Name</th>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px">Active</th>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(m=>(
              <tr key={m.id}>
                <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{m.name}</td>
                <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{active===m.id?'Yes':'No'}</td>
                <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px',display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button className="btn" onClick={()=>makeActive(m.id)} disabled={busy}>Set active</button>
                  <label className="btn">
                    Upload image
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg"
                           onChange={e=>e.target.files[0] && uploadTo(m.id, e.target.files[0])}
                           style={{display:'none'}} />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </div>
  );
}
