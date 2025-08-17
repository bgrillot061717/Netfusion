import MapManager from "../MapManager";
import EndpointsManager from "../EndpointsManager";
import SnmpScanner from "../SnmpScanner";

export default function Setup(){
  return (
    <div className="page">
      <h1 className="h1">Setup</h1>
      <MapManager />
      <EndpointsManager />
      <SnmpScanner />
    </div>
  );
}
