import React from "react";
import "../styles/sidebar.css";
import SideLink from "./SideLink";
import { MapPinned, Users, Settings, Menu } from "lucide-react";

export default function SidebarLayout({ children }){
  const [open,setOpen]=React.useState(true);
  return (
    <div className="app">
      <aside className="aside" style={{width:open?240:64}}>
        <div className="aside-inner">
          <div className="aside-header">
            <button className="toggle" title="Toggle sidebar" onClick={()=>setOpen(o=>!o)}>
              <Menu size={18}/>
            </button>
            {open && <span className="aside-title">NetFusion</span>}
          </div>
          <nav className="aside-nav">
            <SideLink to="/" icon={<MapPinned size={16}/>} label="Home" />
            <SideLink to="/users" icon={<Users size={16}/>} label="Users" />
            <SideLink to="/setup" icon={<Settings size={16}/>} label="Setup" />
          </nav>
          <div className="aside-footer">v0.1</div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
