import { useEffect, useState } from "react";
import { apiLogin, apiFirstRun } from "./auth";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [firstRun, setFirstRun] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/first-run', { credentials: 'include' })
      .then(r => r.json()).then(j => setFirstRun(Boolean(j.needed)))
      .catch(()=>setFirstRun(false));
  }, []);

  async function submit(e){
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const action = firstRun ? apiFirstRun : apiLogin;
      const j = await action(email, pw);
      onLoggedIn({ email: j.email, role: j.role });
    } catch (e) {
      setErr(e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:10,border:"1px solid #4444",padding:20,borderRadius:10,width:320,background:"#fff"}}>
        <h2 style={{margin:0}}>{firstRun ? "Set up admin" : "Sign in"}</h2>
        <label>Email
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} required minLength={8} />
        </label>
        {err && <div style={{color:"#e63946"}}>{err}</div>}
        <button type="submit" disabled={busy}>{busy ? "Working..." : (firstRun ? "Create Admin" : "Sign In")}</button>
      </form>
    </div>
  );
}
