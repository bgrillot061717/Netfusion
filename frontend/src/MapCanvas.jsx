import { useEffect, useRef, useState } from "react";

export default function MapCanvas(){
  const [status, setStatus] = useState({ exists:false });
  const [busy, setBusy] = useState(false);
  const [blank, setBlank] = useState(false); // user chose to skip
  const fileRef = useRef(null);

  async function refresh(){
    try{
      const r = await fetch('/api/map', { credentials: 'include' });
      const j = await r.json();
      setStatus(j);
    }catch(e){
      setStatus({ exists:false });
    }
  }

  useEffect(()=>{ refresh(); },[]);

  async function onUpload(e){
    const f = e.target.files?.[0];
    if(!f) return;
    if(!['image/png','image/jpeg'].includes(f.type)){
      alert('Please select a PNG or JPG.');
      return;
    }
    const fd = new FormData();
    fd.append('file', f);
    setBusy(true);
    try{
      const r = await fetch('/api/map', { method:'POST', body: fd, credentials:'include' });
      if(!r.ok){ const t = await r.text(); throw new Error(t || 'Upload failed'); }
      setBlank(false);
      await refresh();
    }catch(err){
      alert(err.message || 'Upload failed');
    }finally{
      setBusy(false);
      if(fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeMap(){
    if(!confirm('Remove current map?')) return;
    setBusy(true);
    try{
      await fetch('/api/map', { method:'DELETE', credentials:'include' });
      setStatus({ exists:false });
    }finally{
      setBusy(false);
    }
  }

  // Canvas area
  return (
    <div style={{marginTop:16}}>
      {status.exists ? (
        <div style={{display:'grid', gap:12}}>
          <div style={{
            border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden',
            width:'100%', height:'70vh', background:'#f8fafc', display:'grid', placeItems:'center'
          }}>
            {/* Use max-height/width to fit */ }
            <img
              src={status.url}
              alt="Network map"
              style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}}
            />
          </div>
          <div style={{display:'flex', gap:8}}>
            <label className="btn">
              Replace Map
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={onUpload} style={{display:'none'}} />
            </label>
            <button className="btn" onClick={removeMap} disabled={busy}>Remove</button>
          </div>
        </div>
      ) : (
        blank ? (
          <div style={{
            border:'1px solid #e5e7eb', borderRadius:12, width:'100%', height:'70vh',
            background:'#ffffff', display:'grid', placeItems:'center', color:'#6b7280'
          }}>
            Blank canvas — your topology will render here when discovered.
          </div>
        ) : (
          <div style={{display:'grid', gap:12}}>
            <div className="card" style={{maxWidth:520}}>
              <h3 style={{marginTop:0}}>Upload a background map (optional)</h3>
              <p style={{marginTop:0}}>PNG or JPG recommended. You can replace it anytime.</p>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <label className="btn">
                  Choose Image
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={onUpload} style={{display:'none'}} />
                </label>
                <button className="btn" onClick={()=>setBlank(true)} disabled={busy}>Skip for now</button>
              </div>
            </div>
            <div style={{
              border:'1px dashed #cbd5e1', borderRadius:12, width:'100%', height:'50vh',
              background:'#f8fafc', display:'grid', placeItems:'center', color:'#94a3b8'
            }}>
              No map yet — upload or skip to start with a blank slate.
            </div>
          </div>
        )
      )}
    </div>
  );
}
