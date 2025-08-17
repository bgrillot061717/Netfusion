import MapManager from "../MapManager";
import MapCanvas from "../MapCanvas";

export default function Home(){
  return (
    <div className="page">
      <h1 className="h1">Home</h1>
      <MapManager onChange={()=>{ /* canvas will refetch via user action */ }} />
      <MapCanvas />
    </div>
  );
}
