import { useEffect, useState } from "react";
import { apiLogin, apiFirstRun } from "./auth";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [firstRun, setFirstRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetToken, setResetToken] = useState(""); // AUTH_RESET_TOKEN from server env

  useEffect(() => {
    fetch('/api/auth/first-run', { credentials: 'include' })
      .then(r => r.json()).then(j => setFirstRun(Boolean(j.needed)))
      .catch(()=>setFirstRun(false));
  }, []);

  async function submit(e){
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (resetMode) {
        const r = await fetch('/api/auth/reset-password', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ email, new_password: pw, token: resetToken })
        });
        const j = await r.json().catch(()=>({detail:'Reset failed'}));
        if (!r.ok) throw new Error(j.detail || 'Reset failed');
        alert('Password reset OK. Please sign in.');
        setResetMode(false);
        setPw("");
        return;
      }
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
      <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:10,border:"1px solid #4444",padding:20,borderRadius:10,width:340,background:"#fff"}}>
        <h2 style={{margin:0}}>
          {resetMode ? "Reset password" : (firstRun ? "Set up admin" : "Sign in")}
        </h2>
        <label>Email
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </label>
        <label>{resetMode ? "New password" : "Password"}
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} required minLength={8} />
        </label>
        {resetMode && (
          <label>Reset token
            <input value={resetToken} onChange={e=>setResetToken(e.target.value)} placeholder="Set on server ENV: AUTH_RESET_TOKEN" required />
          </label>
        )}
        {err && <div style={{color:"#e63946"}}>{err}</div>}
        <button type="submit" disabled={busy}>{busy ? "Working..." : (resetMode ? "Reset" : (firstRun ? "Create Admin" : "Sign In"))}</button>
        {!firstRun && (
          <button type="button" className="btn" onClick={()=>setResetMode(m=>!m)} style={{marginTop:6}}>
            {resetMode ? "Back to sign in" : "Forgot password?"}
          </button>
        )}
      </form>
    </div>
  );
}
