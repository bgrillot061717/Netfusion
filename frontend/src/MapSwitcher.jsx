import { useEffect, useState } from "react";

export default function MapSwitcher({ onChanged }){
  const [maps,setMaps] = useState([]);
  const [active,setActive] = useState(null);
  const [err,setErr] = useState("");

  async function load(){
    try{
      const r = await fetch('/api/maps', { credentials:'include' });
      const j = await r.json();
      setMaps(j.maps||[]);
      setActive(j.active_id||null);
    }catch(e){ setErr("Failed to load maps"); }
  }

  useEffect(()=>{ load(); },[]);

  async function setActiveMap(id){
    const r = await fetch('/api/maps/active', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      credentials:'include', body: JSON.stringify({ id })
    });
    if(!r.ok){
      alert('Failed to set active map'); return;
    }
    setActive(id);
    onChanged && onChanged(id);
  }

  return (
    <div className="card" style={{marginTop:16, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
      <strong>Map:</strong>
      <select value={active||""} onChange={e=>setActiveMap(e.target.value)} style={{minWidth:220}}>
        <option value="" disabled>Select a map…</option>
        {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {err && <span style={{color:'#e63946'}}>{err}</span>}
    </div>
  );
}
