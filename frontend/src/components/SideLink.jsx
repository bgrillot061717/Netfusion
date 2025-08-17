import { NavLink } from "react-router-dom";
export default function SideLink({ to, icon, label }) {
  return (
    <NavLink to={to} className={({isActive})=>"sidelink"+(isActive?" active":"")}>
      {icon}<span>{label}</span>
    </NavLink>
  );
}
