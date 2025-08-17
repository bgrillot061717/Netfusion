import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { apiMe, apiLogout } from "./auth";
import Login from "./Login";
import SidebarLayout from "./components/SidebarLayout";
import Home from "./pages/Home";
import Users from "./pages/Users";
import Setup from "./pages/Setup";

export default function App(){
  const [user, setUser] = useState(null);
  useEffect(() => { apiMe().then(setUser).catch(()=>setUser(null)); }, []);
  if (!user) return <Login onLoggedIn={setUser} />;

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #e5e7eb",background:"#fff"}}>
        <h2 style={{margin:0}}>NetFusion</h2>
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
