import { useEffect, useState } from "react";

export default function MapCanvas(){
  const [active, setActive] = useState({ id:null, url:null });

  async function load(){
    try{
      const r = await fetch('/api/maps/active', { credentials:'include' });
      const j = await r.json();
      setActive(j);
    }catch{ setActive({id:null,url:null}); }
  }
  useEffect(()=>{ load(); },[]);

  return (
    <div style={{marginTop:16}}>
      <div style={{
        border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden',
        width:'100%', height:'70vh', background:'#ffffff', display:'grid', placeItems:'center'
      }}>
        {active.url
          ? <img src={active.url} alt="Map" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
          : <div style={{color:'#6b7280'}}>No map selected — use the Maps panel to create/select one, or continue with a blank canvas.</div>
        }
      </div>
    </div>
  );
}
