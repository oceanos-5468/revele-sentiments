import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, update, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDc7ZzRhrwYexTcSlhQV73vzbaQm8HbWNU",
  authDomain: "revealidentity-59dc5.firebaseapp.com",
  databaseURL: "https://revealidentity-59dc5-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "revealidentity-59dc5",
  storageBucket: "revealidentity-59dc5.firebasestorage.app",
  messagingSenderId: "971970272182",
  appId: "1:971970272182:web:ba12876f7c5e1185d3bf17"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function genId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "maintenant";
  if (d < 3600) return `${Math.floor(d / 60)}min`;
  return `${Math.floor(d / 3600)}h`;
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; background: #07060f; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100%{opacity:.55} 50%{opacity:1} }
  @keyframes heartbeat { 0%,100%{transform:scale(1)} 40%{transform:scale(1.18)} 70%{transform:scale(.94)} }
  @keyframes reveal { 0%{opacity:0;transform:scale(.8)} 60%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
  @keyframes orbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-22px)} }
  .fade { animation: fadeUp .45s ease both; }
  .pulse { animation: pulse 2s ease-in-out infinite; }
  .hb { animation: heartbeat 2.8s ease-in-out infinite; }
  .reveal { animation: reveal .6s cubic-bezier(.34,1.56,.64,1) both; }
  input, textarea {
    width:100%; padding:13px 16px;
    background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.1);
    border-radius:12px; color:#f0eaf8;
    font-family:'Inter',sans-serif; font-size:15px;
    outline:none; transition:border-color .2s;
  }
  input:focus, textarea:focus { border-color:rgba(167,139,250,.6); }
  input::placeholder, textarea::placeholder { color:rgba(240,234,248,.3); }
  textarea { resize:none; line-height:1.6; }
  .btn { padding:13px 28px; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:all .2s; letter-spacing:.03em; }
  .btn-primary { background:linear-gradient(135deg,#7c3aed,#db2777); color:#fff; box-shadow:0 4px 20px rgba(124,58,237,.3); }
  .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(124,58,237,.45); }
  .btn-primary:disabled { opacity:.35; cursor:default; transform:none; }
  .btn-ghost { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:rgba(240,234,248,.65); }
  .btn-ghost:hover { background:rgba(255,255,255,.09); color:#f0eaf8; }
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-thumb { background:rgba(124,58,237,.4); border-radius:2px; }
`;

export default function App() {
  const [screen, setScreen] = useState("home");
  const [myName, setMyName] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [side, setSide] = useState(null);
  const [session, setSession] = useState(null);
  const [input, setInput] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    const r = ref(db, `sessions/${sessionId}`);
    const unsub = onValue(r, snap => { if (snap.exists()) setSession(snap.val()); });
    return () => unsub();
  }, [sessionId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [session?.messages]);

  useEffect(() => {
    const m = window.location.hash.match(/join=([A-Z0-9]+)/);
    if (m) { setJoinCode(m[1]); setScreen("joinName"); }
  }, []);

  async function createSession() {
    if (!myName.trim()) return;
    const id = genId();
    await set(ref(db, `sessions/${id}`), {
      id, senderName: myName, receiverName: null, messages: {},
      createdAt: Date.now(), senderRequestedReveal: false,
      receiverRequestedReveal: false, bothRevealed: false, bothJoined: false
    });
    setSessionId(id); setSide("sender"); setScreen("invite");
  }

  async function joinSession() {
    const id = joinCode.trim().toUpperCase();
    if (!myName.trim() || !id) return;
    const snap = await get(ref(db, `sessions/${id}`));
    if (!snap.exists()) return alert("Session introuvable.");
    await update(ref(db, `sessions/${id}`), { receiverName: myName, bothJoined: true });
    setSessionId(id); setSide("receiver"); setScreen("chat");
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionId) return;
    await push(ref(db, `sessions/${sessionId}/messages`), { text, side, ts: Date.now() });
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function requestReveal() {
    if (!sessionId) return;
    const field = side === "sender" ? "senderRequestedReveal" : "receiverRequestedReveal";
    const snap = await get(ref(db, `sessions/${sessionId}`));
    const s = snap.val();
    const otherField = side === "sender" ? "receiverRequestedReveal" : "senderRequestedReveal";
    const updates = { [field]: true };
    if (s[otherField]) updates.bothRevealed = true;
    await update(ref(db, `sessions/${sessionId}`), updates);
  }

  const msgs = session?.messages ? Object.values(session.messages).sort((a, b) => a.ts - b.ts) : [];
  const iRequested = session && (side === "sender" ? session.senderRequestedReveal : session.receiverRequestedReveal);
  const theyRequested = session && (side === "sender" ? session.receiverRequestedReveal : session.senderRequestedReveal);
  const bothRevealed = session?.bothRevealed;
  const theirName = side === "sender" ? session?.receiverName : session?.senderName;
  const inviteLink = `${window.location.href.split("#")[0]}#join=${sessionId}`;

  return (
    <div style={{ minHeight:"100vh", background:"#07060f", fontFamily:"'Inter',sans-serif", color:"#f0eaf8", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
      <style>{css}</style>

      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", width:420, height:420, borderRadius:"50%", background:"rgba(124,58,237,.07)", top:"5%", left:"8%", filter:"blur(90px)", animation:"orbFloat 7s ease-in-out infinite" }} />
        <div style={{ position:"absolute", width:340, height:340, borderRadius:"50%", background:"rgba(219,39,119,.06)", bottom:"8%", right:"6%", filter:"blur(90px)", animation:"orbFloat 9s ease-in-out infinite reverse" }} />
      </div>

      <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:480 }}>

        {/* HOME */}
        {screen === "home" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div className="hb" style={{ fontSize:54, marginBottom:20 }}>🌒</div>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:400, lineHeight:1.2, marginBottom:12 }}>
              Révèle tes<br/><em style={{ color:"#c084fc" }}>Sentiments</em>
            </h1>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.9, marginBottom:40 }}>
              Dis ce que tu ressens vraiment.<br/>Anonymement. Révèle-toi quand tu es prêt·e.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:28 }}>
              <input placeholder="Ton prénom (restera secret)" value={myName} onChange={e => setMyName(e.target.value)} onKeyDown={e => e.key === "Enter" && myName.trim() && createSession()} autoFocus />
              <button className="btn btn-primary" onClick={createSession} disabled={!myName.trim()}>Créer une session anonyme →</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
              <div style={{ flex:1, height:"0.5px", background:"rgba(255,255,255,.08)" }} />
              <span style={{ fontSize:12, color:"rgba(240,234,248,.25)" }}>ou</span>
              <div style={{ flex:1, height:"0.5px", background:"rgba(255,255,255,.08)" }} />
            </div>
            <button className="btn btn-ghost" style={{ width:"100%" }} onClick={() => setScreen("joinName")}>J'ai reçu un lien · Rejoindre</button>
          </div>
        )}

        {/* INVITE */}
        {screen === "invite" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div className="pulse" style={{ fontSize:46, marginBottom:20 }}>📨</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:400, marginBottom:10 }}>Ta session est prête</h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.8, marginBottom:32 }}>
              Partage ce lien avec la personne à qui tu veux parler.<br/>Elle ne saura pas que c'est toi.
            </p>
            <div style={{ background:"rgba(124,58,237,.1)", border:"1px solid rgba(124,58,237,.22)", borderRadius:14, padding:"14px 18px", marginBottom:14, textAlign:"left" }}>
              <div style={{ fontSize:11, color:"rgba(240,234,248,.3)", marginBottom:6, letterSpacing:".06em" }}>LIEN DE SESSION</div>
              <div style={{ fontFamily:"monospace", fontSize:12, color:"#c084fc", wordBreak:"break-all" }}>{inviteLink}</div>
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { navigator.clipboard?.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "✓ Copié !" : "📋 Copier"}</button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { const msg = "Quelqu'un a quelque chose à te dire 🌒\n" + inviteLink; window.open("https://wa.me/?text=" + encodeURIComponent(msg)); }}>💬 WhatsApp</button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { const msg = "Quelqu'un a quelque chose à te dire 🌒\n" + inviteLink; window.open("sms:?body=" + encodeURIComponent(msg)); }}>📱 SMS</button>
            </div>
            <div style={{ fontSize:12, color:"rgba(240,234,248,.28)", marginBottom:28, fontStyle:"italic" }}>
              Code : <span style={{ fontFamily:"monospace", color:"rgba(192,132,252,.7)", letterSpacing:".12em" }}>{sessionId}</span>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={() => setScreen("chat")}>Ouvrir le chat et attendre →</button>
          </div>
        )}

        {/* JOIN NAME */}
        {screen === "joinName" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:46, marginBottom:20 }}>🦋</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:400, marginBottom:10 }}>Quelqu'un te parle</h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.8, marginBottom:32 }}>
              Entre ton prénom. L'autre ne saura pas qui tu es<br/>jusqu'à ce que vous décidiez de vous révéler.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <input placeholder="Ton prénom" value={myName} onChange={e => setMyName(e.target.value)} autoFocus />
              <input placeholder="Code de session (ex: AB12CD)" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} style={{ letterSpacing:".1em", fontFamily:"monospace" }} />
              <button className="btn btn-primary" onClick={joinSession} disabled={!myName.trim() || !joinCode.trim()}>Rejoindre la session →</button>
            </div>
          </div>
        )}

        {/* CHAT */}
        {screen === "chat" && session && (
          <div style={{ height:"100vh", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"16px 20px", background:"rgba(7,6,15,.92)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17 }}>🌒 <em style={{ color:"#c084fc" }}>Session privée</em></div>
                <div style={{ fontSize:11, color:"rgba(240,234,248,.3)", marginTop:3 }}>{session.bothJoined ? "✓ Vous êtes tous les deux présents" : "⏳ En attente de l'autre personne…"}</div>
              </div>
              <div style={{ fontFamily:"monospace", fontSize:12, color:"rgba(124,58,237,.8)", background:"rgba(124,58,237,.1)", border:"1px solid rgba(124,58,237,.2)", padding:"4px 10px", borderRadius:8, letterSpacing:".1em" }}>{sessionId}</div>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"20px 16px" }}>
              {!session.bothJoined && (
                <div className="pulse" style={{ textAlign:"center", padding:"60px 20px", fontSize:14, color:"rgba(240,234,248,.3)", lineHeight:2 }}>🌑<br/>En attente que la personne rejoigne…</div>
              )}
              {msgs.map((msg, i) => {
                const isMe = msg.side === side;
                return (
                  <div key={msg.id || i} className="fade" style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", marginBottom:14, animationDelay:`${i*.02}s` }}>
                    <div style={{ maxWidth:"76%" }}>
                      <div style={{ padding:"11px 16px", background:isMe?"linear-gradient(135deg,rgba(124,58,237,.32),rgba(219,39,119,.22))":"rgba(255,255,255,.05)", border:`1px solid ${isMe?"rgba(124,58,237,.28)":"rgba(255,255,255,.08)"}`, borderRadius:isMe?"18px 4px 18px 18px":"4px 18px 18px 18px", fontSize:15, lineHeight:1.65, color:"#f0eaf8" }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize:10, color:"rgba(240,234,248,.22)", marginTop:4, textAlign:isMe?"right":"left" }}>{isMe?"Toi":"Anonyme"} · {timeAgo(msg.ts)}</div>
                    </div>
                  </div>
                );
              })}
              {theyRequested && !iRequested && !bothRevealed && (
                <div style={{ textAlign:"center", margin:"16px 0", fontSize:13, color:"#c084fc", fontStyle:"italic", animation:"pulse 1.5s ease-in-out infinite" }}>💜 L'autre personne souhaite se révéler à toi…</div>
              )}
              {iRequested && !bothRevealed && (
                <div style={{ textAlign:"center", margin:"16px 0", fontSize:13, color:"rgba(251,191,36,.8)", fontStyle:"italic" }}>✨ Tu as demandé la révélation — en attente de l'autre…</div>
              )}
              <div ref={bottomRef} />
            </div>

            {!bothRevealed && session.bothJoined && (
              <div style={{ padding:"12px 16px", background:"rgba(124,58,237,.07)", borderTop:"1px solid rgba(124,58,237,.12)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexShrink:0 }}>
                <div style={{ fontSize:12, color:"rgba(240,234,248,.4)", lineHeight:1.6 }}>
                  Vous vous comprenez ?<br/><span style={{ color:"rgba(192,132,252,.6)" }}>Les deux doivent accepter pour se révéler.</span>
                </div>
                <button onClick={requestReveal} disabled={iRequested} style={{ padding:"10px 18px", background:iRequested?"rgba(251,191,36,.1)":"linear-gradient(135deg,rgba(124,58,237,.4),rgba(219,39,119,.3))", border:`1px solid ${iRequested?"rgba(251,191,36,.3)":"rgba(124,58,237,.35)"}`, borderRadius:50, color:iRequested?"#fbbf24":"#f0eaf8", fontFamily:"'Inter',sans-serif", fontSize:13, cursor:iRequested?"default":"pointer", whiteSpace:"nowrap", transition:"all .2s", flexShrink:0 }}>
                  {iRequested ? "⏳ En attente…" : "✨ Me révéler"}
                </button>
              </div>
            )}

            {bothRevealed && (
              <div className="reveal" style={{ padding:"22px", background:"linear-gradient(135deg,rgba(124,58,237,.18),rgba(219,39,119,.14))", borderTop:"1px solid rgba(124,58,237,.28)", textAlign:"center", flexShrink:0 }}>
                <div style={{ fontSize:30, marginBottom:8, animation:"heartbeat 2s infinite" }}>🌟</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, marginBottom:6 }}>
                  <em style={{ color:"#c084fc" }}>{side==="sender"?myName:theirName}</em> & <em style={{ color:"#f472b6" }}>{side==="sender"?theirName:myName}</em>
                </div>
                <div style={{ fontSize:13, color:"rgba(240,234,248,.45)" }}>Vous vous êtes révélé·e·s 💜</div>
              </div>
            )}

            <div style={{ padding:"12px 16px 24px", background:"rgba(7,6,15,.95)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,.06)", display:"flex", gap:10, alignItems:"flex-end", flexShrink:0 }}>
              <textarea ref={inputRef} rows={1} placeholder={session.bothJoined?"Exprime-toi librement…":"En attente de l'autre personne…"} value={input} disabled={!session.bothJoined} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }} style={{ flex:1, borderRadius:14, minHeight:48 }} />
              <button onClick={sendMessage} disabled={!input.trim()||!session.bothJoined} style={{ width:46, height:46, borderRadius:"50%", background:input.trim()&&session.bothJoined?"linear-gradient(135deg,#7c3aed,#db2777)":"rgba(255,255,255,.05)", border:"none", color:input.trim()&&session.bothJoined?"#fff":"rgba(255,255,255,.2)", fontSize:18, cursor:input.trim()&&session.bothJoined?"pointer":"default", transition:"all .2s", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>↑</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
