import { useEffect, useState } from "react";
import { apiMe, apiLogout } from "./auth";
import Login from "./Login";
import MapCanvas from "./MapCanvas";

export default function App(){
  const [user, setUser] = useState(null);
  useEffect(() => { apiMe().then(setUser).catch(()=>setUser(null)); }, []);
  if (!user) return <Login onLoggedIn={setUser} />;
  return (
    <div style={{padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{margin:0}}>NetFusion</h2>
        <div>
          <span style={{opacity:.7, marginRight:12}}>{user.email} ({user.role})</span>
          <button onClick={async()=>{ await apiLogout(); setUser(null); }}>Logout</button>
        </div>
      </div>
      <MapCanvas />
    </div>
  );
}
