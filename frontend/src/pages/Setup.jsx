export default function Setup(){
  return (
    <div className="page">
      <h1 className="h1">Setup</h1>
      <div className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0}}>Collectors</h3>
        <ul style={{marginTop:8}}>
          <li>UniFi (controller URL, token or user/pass, site)</li>
          <li>Auvik (API base URL, API key)</li>
          <li>More providers coming soon…</li>
        </ul>
      </div>
      <div className="card">
        <p>We’ll add forms here to save credentials (env/secret) and test connectivity.</p>
      </div>
    </div>
  );
}
