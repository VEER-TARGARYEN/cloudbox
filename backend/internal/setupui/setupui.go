// Package setupui serves a small local web page (loopback only) where the user
// signs in / registers and then sees a live pairing QR for the phone app.
package setupui

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/brokerlink"
)

type Server struct {
	linker *brokerlink.Linker
}

func New(linker *brokerlink.Linker) *Server { return &Server{linker: linker} }

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", s.page)
	r.Get("/setup/status", s.status)
	r.Post("/setup/connect", s.connect)
	r.Get("/setup/qr.png", s.qr)
	return r
}

func (s *Server) page(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(pageHTML))
}

func (s *Server) status(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.linker.Status())
}

func (s *Server) connect(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Mode     string `json:"mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if err := s.linker.Connect(body.Email, body.Password, body.Mode == "register"); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) qr(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, s.linker.QRPath())
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

const pageHTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CloudBox</title>
<style>
  :root{ --bg:#0b1220; --card:#111a2e; --tint:#1b2540; --primary:#4f8cff; --text:#e6eaf2; --muted:#8a95a8; --border:#22304a; --danger:#ff5c7a; }
  *{ box-sizing:border-box; font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif; }
  body{ margin:0; min-height:100vh; background:radial-gradient(1200px 600px at 50% -10%, #16213f, var(--bg)); color:var(--text); display:flex; align-items:center; justify-content:center; padding:24px; }
  .card{ width:100%; max-width:440px; background:var(--card); border:1px solid var(--border); border-radius:20px; padding:32px; box-shadow:0 20px 60px rgba(0,0,0,.4); }
  .brand{ display:flex; align-items:center; gap:10px; font-weight:800; font-size:22px; color:var(--primary); margin-bottom:20px; }
  h2{ margin:0 0 6px; font-size:24px; }
  .muted{ color:var(--muted); font-size:14px; line-height:1.5; margin:0 0 18px; }
  .small{ font-size:12px; }
  label{ display:block; font-size:13px; font-weight:600; color:var(--muted); margin:14px 0 6px; }
  input{ width:100%; height:48px; border-radius:12px; border:1px solid var(--border); background:#0d1526; color:var(--text); padding:0 14px; font-size:16px; outline:none; }
  input:focus{ border-color:var(--primary); }
  .btn{ width:100%; height:50px; border-radius:999px; border:none; font-size:15px; font-weight:700; cursor:pointer; margin-top:14px; }
  .btn:disabled{ opacity:.5; cursor:default; }
  .btn.primary{ background:var(--primary); color:#fff; }
  .btn.ghost{ background:var(--tint); color:var(--primary); }
  .err{ color:var(--danger); font-size:13px; min-height:18px; margin-top:10px; }
  .qrwrap{ display:flex; justify-content:center; margin:18px 0; }
  .qrwrap img{ width:260px; height:260px; background:#fff; border-radius:16px; padding:12px; }
  .dot{ display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; margin-right:6px; }
</style></head>
<body>
  <div class="card">
    <div class="brand">☁ CloudBox</div>
    <div id="view"><p class="muted">Loading…</p></div>
  </div>
<script>
async function getStatus(){ const r = await fetch('/setup/status'); return r.json(); }

function render(s){
  const v = document.getElementById('view');
  if(s.connected){
    v.innerHTML =
      '<h2><span class="dot"></span>Ready to pair</h2>'+
      '<p class="muted">On your phone, open the CloudBox app, tap <b>Scan QR code</b>, and point it at this screen.</p>'+
      '<div class="qrwrap"><img src="/setup/qr.png?t='+Date.now()+'"/></div>'+
      '<p class="muted small">Signed in as <b>'+(s.email||'—')+'</b>.<br>Keep this window open while you use the app — close it to stop CloudBox.</p>';
  } else {
    v.innerHTML =
      '<h2>Connect this laptop</h2>'+
      '<p class="muted">Sign in, or create a CloudBox account, to link your phone.</p>'+
      '<label>Email</label><input id="email" type="email" placeholder="you@example.com"/>'+
      '<label>Password</label><input id="password" type="password" placeholder="At least 8 characters"/>'+
      '<div class="err" id="err"></div>'+
      '<button class="btn primary" onclick="submit(\'login\')">Sign in</button>'+
      '<button class="btn ghost" onclick="submit(\'register\')">Create account</button>'+
      (s.public_url ? '' : '<p class="muted small" style="margin-top:14px">Setting up the secure tunnel… give it a few seconds.</p>');
  }
}

async function submit(mode){
  const email = (document.getElementById('email').value||'').trim();
  const password = document.getElementById('password').value||'';
  const err = document.getElementById('err');
  err.textContent='';
  document.querySelectorAll('.btn').forEach(b=>b.disabled=true);
  try{
    const r = await fetch('/setup/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,mode})});
    const j = await r.json();
    if(!r.ok){ err.textContent=j.error||'Something went wrong'; document.querySelectorAll('.btn').forEach(b=>b.disabled=false); return; }
    lastConnected=true; render(await getStatus());
  }catch(e){ err.textContent='Could not reach the server'; document.querySelectorAll('.btn').forEach(b=>b.disabled=false); }
}

// Re-render only when the connected state changes, so typing isn't interrupted.
let lastConnected=null;
async function tick(){
  let s; try{ s=await getStatus(); }catch(e){ return; }
  if(s.connected!==lastConnected){ lastConnected=s.connected; render(s); }
}
tick(); setInterval(tick, 4000);
</script>
</body></html>`
