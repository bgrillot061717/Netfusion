import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { apiMe, apiLogout } from "./auth";
import Login from "./Login";
import SidebarLayout from "./components/SidebarLayout";
import Home from "./pages/Home";
import Users from "./pages/Users";
import Setup from "./pages/Setup";

function LogoMark(){
  // Try to show /logo.png if present, otherwise fallback text
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <img src="/logo.png" alt="logo" onError={(e)=>{e.currentTarget.style.display='none';}}
           style={{height:28, width:'auto'}} />
      <span style={{fontWeight:600}}>NetFusion</span>
    </div>
  );
}

export default function App(){
  const [user, setUser] = useState(null);
  useEffect(() => { apiMe().then(setUser).catch(()=>setUser(null)); }, []);
  if (!user) return <Login onLoggedIn={setUser} />;

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #e5e7eb",background:"#fff"}}>
        <LogoMark />
        <div>
          <span style={{opacity:.7, marginRight:12}}>{user.email} ({user.role})</span>
          <button onClick={async()=>{ await apiLogout(); setUser(null); }}>Logout</button>
        </div>
      </div>

      <BrowserRouter>
        <SidebarLayout>
          <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/users" element={<Users/>} />
            <Route path="/setup" element={<Setup/>} />
          </Routes>
        </SidebarLayout>
      </BrowserRouter>
    </div>
  );
}
