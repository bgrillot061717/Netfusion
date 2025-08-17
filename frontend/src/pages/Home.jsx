import MapSwitcher from "../MapSwitcher";
import MapCanvas from "../MapCanvas";

export default function Home(){
  return (
    <div className="page">
      <h1 className="h1">Home</h1>
      <MapSwitcher onChanged={()=>{ /* canvas will refresh via URL cache-bust on src */ }} />
      <MapCanvas />
    </div>
  );
}
