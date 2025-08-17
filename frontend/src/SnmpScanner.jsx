import { useState } from "react";

export default function SnmpScanner(){
  const [cidr,setCidr] = useState("");
  const [community,setCommunity] = useState("public");
  const [timeout,setTimeoutMs] = useState(500);
  const [res,setRes] = useState(null);
  const [busy,setBusy] = useState(false);
  const [selected, setSelected] = useState({});

  async function scan(){
    setBusy(true); setRes(null);
    try{
      const r = await fetch('/api/snmp/scan', {
        method:'POST', headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ cidr, community, timeout_ms: Number(timeout)||500 })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j.detail || 'Scan failed');
      setRes(j);
      setSelected({});
    }catch(e){ alert(e.message||'Scan failed'); }
    finally{ setBusy(false); }
  }

  async function importSelected(){
    const picks = (res?.results||[]).filter(x=>selected[x.ip]);
    if (picks.length===0) return;
    setBusy(true);
    try{
      for (const x of picks) {
        const name = x.values?.["1.3.6.1.2.1.1.5.0"] || x.ip;
        await fetch('/api/endpoints', {
          method:'POST', headers:{'Content-Type':'application/json'},
          credentials:'include',
          body: JSON.stringify({
            name, kind:'generic', address:x.ip,
            auth_type:'token', api_key:'', // not used for SNMP
            snmp_version:'2c', snmp_community: community,
            enabled: true, notes:'Imported from SNMP scan'
          })
        });
      }
      alert('Imported selected hosts');
    }catch(e){ alert(e.message||'Import failed'); }
    finally{ setBusy(false); }
  }

  return (
    <div className="card" style={{marginTop:16}}>
      <h3 style={{marginTop:0}}>SNMP Subnet Scan (v2c)</h3>
      <div style={{display:'grid',gap:8,gridTemplateColumns:'repeat(3, minmax(180px, 1fr))', alignItems:'end'}}>
        <label>CIDR<input placeholder="192.168.1.0/24" value={cidr} onChange={e=>setCidr(e.target.value)}/></label>
        <label>Community<input value={community} onChange={e=>setCommunity(e.target.value)} /></label>
        <label>Timeout (ms)<input type="number" min="200" value={timeout} onChange={e=>setTimeoutMs(e.target.value)} /></label>
      </div>
      <div style={{marginTop:8, display:'flex', gap:8}}>
        <button className="btn" onClick={scan} disabled={busy || !cidr.trim()}>{busy?'Scanning…':'Scan'}</button>
        {!!(res?.results?.length) && <button className="btn" onClick={importSelected} disabled={busy}>Add selected as endpoints</button>}
      </div>

      {!res ? null :
        <div style={{marginTop:12}}>
          <div style={{marginBottom:6}}>{res.count} hosts responded</div>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>Add</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>IP</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>sysName</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #e5e7eb',padding:'6px'}}>sysDescr</th>
              </tr>
            </thead>
            <tbody>
              {res.results.map(r=>{
                const name = r.values?.["1.3.6.1.2.1.1.5.0"] || "";
                const descr = r.values?.["1.3.6.1.2.1.1.1.0"] || "";
                return (
                  <tr key={r.ip}>
                    <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>
                      <input type="checkbox" checked={!!selected[r.ip]} onChange={e=>setSelected(s=>({...s, [r.ip]: e.target.checked}))}/>
                    </td>
                    <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{r.ip}</td>
                    <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px'}}>{name}</td>
                    <td style={{borderBottom:'1px solid #f1f5f9',padding:'6px', whiteSpace:'pre-wrap'}}>{descr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}
