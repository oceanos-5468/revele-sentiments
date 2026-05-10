import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase, ref, set, push, onValue, update, get
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDc7ZzRhrwYexTcSlhQV73vzbaQm8HbWNU",
  authDomain: "revealidentity-59dc5.firebaseapp.com",
  databaseURL: "https://revealidentity-59dc5-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "revealidentity-59dc5",
  storageBucket: "revealidentity-59dc5.firebasestorage.app",
  messagingSenderId: "971970272182",
  appId: "1:971970272182:web:ba12876f7c5e1185d3bf17"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const INACTIVITY_MS = 48 * 60 * 60 * 1000;

function genId(len) {
  return Math.random().toString(36).slice(2, 2 + (len || 6)).toUpperCase();
}
function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "maintenant";
  if (d < 3600) return Math.floor(d / 60) + "min";
  if (d < 86400) return Math.floor(d / 3600) + "h";
  return Math.floor(d / 86400) + "j";
}
function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function loadLocal(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function clearLocal(key) {
  try { localStorage.removeItem(key); } catch(e) {}
}
function sendLocalNotif(title, body) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body: body });
  }
}
async function askNotifications() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Inter:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; background: #07060f; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
  @keyframes hb { 0%,100%{transform:scale(1)} 40%{transform:scale(1.18)} 70%{transform:scale(.94)} }
  @keyframes revealAnim { 0%{opacity:0;transform:scale(.8)} 60%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
  @keyframes orbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
  @keyframes badgePop { 0%{transform:scale(0)} 70%{transform:scale(1.3)} 100%{transform:scale(1)} }
  .fade { animation: fadeUp .4s ease both; }
  .pulse-anim { animation: pulse 2s ease-in-out infinite; }
  .hb-anim { animation: hb 2.8s ease-in-out infinite; }
  .reveal-anim { animation: revealAnim .6s cubic-bezier(.34,1.56,.64,1) both; }
  input, textarea {
    width:100%; padding:12px 16px;
    background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.1);
    border-radius:12px; color:#f0eaf8;
    font-family:'Inter',sans-serif; font-size:15px;
    outline:none; transition:border-color .2s;
  }
  input:focus, textarea:focus { border-color:rgba(167,139,250,.6); }
  input::placeholder, textarea::placeholder { color:rgba(240,234,248,.28); }
  textarea { resize:none; line-height:1.6; }
  .btn { padding:12px 24px; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:all .2s; }
  .btn-primary { background:linear-gradient(135deg,#7c3aed,#db2777); color:#fff; box-shadow:0 4px 20px rgba(124,58,237,.3); }
  .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(124,58,237,.45); }
  .btn-primary:disabled { opacity:.3; cursor:default; transform:none; }
  .btn-ghost { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:rgba(240,234,248,.65); }
  .btn-ghost:hover { background:rgba(255,255,255,.09); color:#f0eaf8; }
  .btn-danger { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.2); color:rgba(239,68,68,.8); font-family:'Inter',sans-serif; font-size:13px; cursor:pointer; transition:all .2s; padding:7px 14px; border-radius:20px; }
  .btn-danger:hover { background:rgba(239,68,68,.2); }
  .convo-card { padding:14px 16px; border-radius:14px; border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.03); cursor:pointer; transition:all .2s; display:flex; align-items:center; gap:12px; margin-bottom:10px; }
  .convo-card:hover { border-color:rgba(124,58,237,.3); background:rgba(124,58,237,.05); }
  .nav-btn { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 0; background:none; border:none; cursor:pointer; transition:all .2s; font-family:'Inter',sans-serif; font-size:10px; letter-spacing:.04em; }
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-thumb { background:rgba(124,58,237,.4); border-radius:2px; }
`;

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({ tab, setTab, unread, hasProfile }) {
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, background:"rgba(7,6,15,.95)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,.07)", display:"flex", maxWidth:480, margin:"0 auto" }}>
      <button className="nav-btn" onClick={function(){ setTab("home"); }} style={{ color: tab==="home" ? "#c084fc" : "rgba(240,234,248,.35)" }}>
        <span style={{ fontSize:20 }}>✨</span>
        <span>Nouveau</span>
      </button>
      {hasProfile && (
        <button className="nav-btn" onClick={function(){ setTab("messages"); }} style={{ color: tab==="messages" ? "#c084fc" : "rgba(240,234,248,.35)", position:"relative" }}>
          <span style={{ fontSize:20 }}>💬</span>
          <span>Messages</span>
          {unread > 0 && (
            <span style={{ position:"absolute", top:6, right:"calc(50% - 14px)", background:"#db2777", color:"#fff", borderRadius:50, padding:"1px 6px", fontSize:10, animation:"badgePop .3s ease" }}>
              {unread}
            </span>
          )}
        </button>
      )}
      {hasProfile && (
        <button className="nav-btn" onClick={function(){ setTab("mylink"); }} style={{ color: tab==="mylink" ? "#c084fc" : "rgba(240,234,248,.35)" }}>
          <span style={{ fontSize:20 }}>🔗</span>
          <span>Mon lien</span>
        </button>
      )}
    </div>
  );
}

// ─── CHAT SCREEN ──────────────────────────────────────────────────────────────
function ChatScreen({ sessionId, side, myName, onBack, onQuit }) {
  const [session, setSession] = useState(null);
  const [input, setInput] = useState("");
  const [expired, setExpired] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const prevLen = useRef(0);

  useEffect(function() {
    if (!sessionId) return;
    const unsub = onValue(ref(db, "sessions/" + sessionId), function(snap) {
      if (!snap.exists()) return;
      const s = snap.val();
      const msgs = s.messages ? Object.values(s.messages) : [];
      const lastActivity = msgs.length ? Math.max.apply(null, msgs.map(function(m){return m.ts;})) : s.createdAt;
      if (Date.now() - lastActivity > INACTIVITY_MS) { setExpired(true); clearLocal("rs_chat"); }
      else setExpired(false);
      if (msgs.length > prevLen.current) {
        const last = msgs.sort(function(a,b){return b.ts-a.ts;})[0];
        if (last && last.side !== side) sendLocalNotif("Nouveau message", "Quelqu un t a ecrit");
      }
      prevLen.current = msgs.length;
      setSession(s);
    });
    return function() { unsub(); };
  }, [sessionId, side]);

  useEffect(function() {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior:"smooth" });
  }, [session]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionId) return;
    await push(ref(db, "sessions/" + sessionId + "/messages"), { text:text, side:side, ts:Date.now() });
    await update(ref(db, "sessions/" + sessionId), { lastActivity:Date.now() });
    setInput("");
    setTimeout(function() { if (inputRef.current) inputRef.current.focus(); }, 30);
  }

  async function requestReveal() {
    if (!sessionId || !session) return;
    const field = side === "profile" ? "profileRequestedReveal" : side === "sender" ? "senderRequestedReveal" : side === "receiver" ? "receiverRequestedReveal" : "visitorRequestedReveal";
    const otherField = side === "profile" ? "visitorRequestedReveal" : side === "sender" ? "receiverRequestedReveal" : side === "receiver" ? "senderRequestedReveal" : "profileRequestedReveal";
    const updates = {};
    updates[field] = true;
    if (session[otherField]) updates.bothRevealed = true;
    await update(ref(db, "sessions/" + sessionId), updates);
  }

  if (!session) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div className="pulse-anim" style={{ fontSize:32 }}>🌒</div>
    </div>
  );

  const msgs = session.messages ? Object.values(session.messages).sort(function(a,b){return a.ts-b.ts;}) : [];
  const iRequested = side === "sender" ? session.senderRequestedReveal : side === "receiver" ? session.receiverRequestedReveal : side === "profile" ? session.profileRequestedReveal : session.visitorRequestedReveal;
  const theyRequested = side === "sender" ? session.receiverRequestedReveal : side === "receiver" ? session.senderRequestedReveal : side === "profile" ? session.visitorRequestedReveal : session.profileRequestedReveal;
  const bothRevealed = session.bothRevealed;
  const theirName = side === "sender" ? session.receiverName : side === "receiver" ? session.senderName : side === "profile" ? session.visitorName : session.profileName;

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", paddingBottom: onBack ? 0 : 0 }}>
      {/* Header */}
      <div style={{ padding:"14px 20px", background:"rgba(7,6,15,.95)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {onBack && (
            <button onClick={onBack} style={{ background:"none", border:"none", color:"rgba(240,234,248,.6)", fontSize:20, cursor:"pointer", padding:"0 4px" }}>←</button>
          )}
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16 }}>
              🌒 <em style={{ color:"#c084fc" }}>Session privee</em>
            </div>
            <div style={{ fontSize:11, color:"rgba(240,234,248,.3)", marginTop:2 }}>
              {bothRevealed ? (myName + " & " + (theirName || "Anonyme")) : session.bothJoined ? "Connectes" : "En attente..."}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:"rgba(124,58,237,.7)", background:"rgba(124,58,237,.1)", border:"1px solid rgba(124,58,237,.18)", padding:"3px 8px", borderRadius:6 }}>
            {sessionId}
          </div>
          {onQuit && <button className="btn-danger" onClick={onQuit}>Quitter</button>}
        </div>
      </div>

      {/* Session expiree */}
      {expired && (
        <div style={{ padding:"24px", textAlign:"center", background:"rgba(239,68,68,.07)", borderBottom:"1px solid rgba(239,68,68,.15)" }}>
          <div style={{ fontSize:26, marginBottom:8 }}>⌛</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:"rgba(239,68,68,.85)", marginBottom:6 }}>Session expiree</div>
          <div style={{ fontSize:13, color:"rgba(240,234,248,.35)", marginBottom:16 }}>48h sans message.</div>
          {onBack && <button className="btn btn-ghost" onClick={onBack}>Retour</button>}
        </div>
      )}

      {/* Messages */}
      {!expired && (
        <div style={{ flex:1, overflowY:"auto", padding:"16px 16px", paddingBottom:8 }}>
          {!session.bothJoined && (
            <div className="pulse-anim" style={{ textAlign:"center", padding:"50px 20px", fontSize:14, color:"rgba(240,234,248,.28)", lineHeight:2 }}>
              🌑<br />En attente que la personne rejoigne...
            </div>
          )}

          {msgs.map(function(msg, i) {
            const isMe = msg.side === side;
            return (
              <div key={i} className="fade" style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", marginBottom:12 }}>
                <div style={{ maxWidth:"78%" }}>
                  <div style={{ padding:"10px 15px", background:isMe?"linear-gradient(135deg,rgba(124,58,237,.32),rgba(219,39,119,.22))":"rgba(255,255,255,.05)", border:"1px solid "+(isMe?"rgba(124,58,237,.28)":"rgba(255,255,255,.08)"), borderRadius:isMe?"18px 4px 18px 18px":"4px 18px 18px 18px", fontSize:15, lineHeight:1.65, color:"#f0eaf8" }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize:10, color:"rgba(240,234,248,.2)", marginTop:3, textAlign:isMe?"right":"left" }}>
                    {isMe ? "Toi" : "Anonyme"} · {timeAgo(msg.ts)}
                  </div>
                </div>
              </div>
            );
          })}

          {theyRequested && !iRequested && !bothRevealed && (
            <div className="pulse-anim" style={{ textAlign:"center", margin:"14px 0", fontSize:13, color:"#c084fc", fontStyle:"italic" }}>
              L autre souhaite se reveler...
            </div>
          )}
          {iRequested && !bothRevealed && (
            <div style={{ textAlign:"center", margin:"14px 0", fontSize:13, color:"rgba(251,191,36,.75)", fontStyle:"italic" }}>
              En attente de l autre...
            </div>
          )}
          {bothRevealed && (
            <div className="reveal-anim" style={{ margin:"16px 0", padding:"20px", background:"linear-gradient(135deg,rgba(124,58,237,.16),rgba(219,39,119,.12))", border:"1px solid rgba(124,58,237,.25)", borderRadius:16, textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:8, animation:"hb 2s infinite" }}>🌟</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, marginBottom:6 }}>
                <em style={{ color:"#c084fc" }}>{myName}</em> {" & "} <em style={{ color:"#f472b6" }}>{theirName || "Anonyme"}</em>
              </div>
              <div style={{ fontSize:12, color:"rgba(240,234,248,.4)" }}>La magie a opere. Continuez ailleurs 💜</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Reveal banner */}
      {!bothRevealed && !expired && session.bothJoined && (
        <div style={{ padding:"10px 16px", background:"rgba(124,58,237,.06)", borderTop:"1px solid rgba(124,58,237,.1)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexShrink:0 }}>
          <div style={{ fontSize:11, color:"rgba(240,234,248,.38)", lineHeight:1.6 }}>
            Vous vous comprenez ?<br />
            <span style={{ color:"rgba(192,132,252,.55)" }}>Les deux doivent accepter.</span>
          </div>
          <button onClick={requestReveal} disabled={iRequested} style={{ padding:"9px 16px", background:iRequested?"rgba(251,191,36,.1)":"linear-gradient(135deg,rgba(124,58,237,.4),rgba(219,39,119,.3))", border:"1px solid "+(iRequested?"rgba(251,191,36,.3)":"rgba(124,58,237,.3)"), borderRadius:50, color:iRequested?"#fbbf24":"#f0eaf8", fontFamily:"'Inter',sans-serif", fontSize:12, cursor:iRequested?"default":"pointer", whiteSpace:"nowrap", transition:"all .2s", flexShrink:0 }}>
            {iRequested ? "En attente..." : "Me reveler"}
          </button>
        </div>
      )}

      {/* Input */}
      {!expired && (
        <div style={{ padding:"10px 14px 20px", background:"rgba(7,6,15,.95)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,.05)", display:"flex", gap:8, alignItems:"flex-end", flexShrink:0 }}>
          <textarea ref={inputRef} rows={1} placeholder={session.bothJoined?"Exprime-toi librement...":"En attente..."} value={input} disabled={!session.bothJoined} onChange={function(e){setInput(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} onInput={function(e){e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}} style={{ flex:1, borderRadius:14, minHeight:46 }} />
          <button onClick={sendMessage} disabled={!input.trim()||!session.bothJoined} style={{ width:44, height:44, borderRadius:"50%", background:input.trim()&&session.bothJoined?"linear-gradient(135deg,#7c3aed,#db2777)":"rgba(255,255,255,.05)", border:"none", color:input.trim()&&session.bothJoined?"#fff":"rgba(255,255,255,.18)", fontSize:18, cursor:input.trim()&&session.bothJoined?"pointer":"default", transition:"all .2s", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>↑</button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [ready, setReady]               = useState(false);
  const [tab, setTab]                   = useState("home");
  const [profile, setProfile]           = useState(null); // { profileId, myName }
  const [conversations, setConversations] = useState([]);
  const [unread, setUnread]             = useState(0);
  const [activeChat, setActiveChat]     = useState(null); // { sessionId, side, myName }

  // Modals / sub-screens
  const [modal, setModal]               = useState(null); // "newA" | "newB" | "joinA" | "visitorEntry"
  const [inputName, setInputName]       = useState("");
  const [inputCode, setInputCode]       = useState("");
  const [inviteData, setInviteData]     = useState(null); // { sessionId, link }
  const [copied, setCopied]             = useState(false);

  const inviteLink = profile ? (window.location.href.split("#")[0] + "#p=" + profile.profileId) : "";
  const base = window.location.href.split("#")[0];

  // ── INIT ──────────────────────────────────────────────────────────────────
  useEffect(function() {
    const hash = window.location.hash;

    async function init() {
      // Lien visiteur Mode B
      const mB = hash.match(/p=([A-Z0-9]+)/);
      if (mB) {
        saveLocal("rs_pending_profile", mB[1]);
        window.location.hash = "";
        setModal("visitorEntry");
        setReady(true);
        return;
      }

      // Lien Mode A
      const mA = hash.match(/join=([A-Z0-9]+)/);
      if (mA) {
        saveLocal("rs_pending_join", mA[1]);
        window.location.hash = "";
        setInputCode(mA[1]);
        setModal("joinA");
        setReady(true);
        return;
      }

      // Restaurer profil
      const savedProfile = loadLocal("rs_profile");
      if (savedProfile && savedProfile.profileId) {
        setProfile(savedProfile);
        setTab("messages");
      }

      // Restaurer chat actif
      const savedChat = loadLocal("rs_chat");
      if (savedChat && savedChat.sessionId) {
        const snap = await get(ref(db, "sessions/" + savedChat.sessionId));
        if (snap.exists()) {
          setActiveChat(savedChat);
        } else {
          clearLocal("rs_chat");
        }
      }

      setReady(true);
    }

    init();
  }, []);

  // ── SYNC CONVERSATIONS ────────────────────────────────────────────────────
  useEffect(function() {
    if (!profile) return;
    const unsub = onValue(ref(db, "sessions"), function(snap) {
      if (!snap.exists()) { setConversations([]); setUnread(0); return; }
      const all = Object.values(snap.val()).filter(function(s) {
        return s.profileId === profile.profileId;
      }).sort(function(a, b) { return b.createdAt - a.createdAt; });
      setConversations(all);
      let u = 0;
      all.forEach(function(s) {
        const msgs = s.messages ? Object.values(s.messages) : [];
        const seen = loadLocal("seen_" + s.id) || 0;
        u += msgs.filter(function(m){ return m.ts > seen && m.side === "visitor"; }).length;
      });
      setUnread(u);
      if (u > 0) sendLocalNotif("Revele tes Sentiments", u + " nouveau(x) message(s)");
    });
    return function() { unsub(); };
  }, [profile]);

  // ── CRÉER SESSION MODE A ──────────────────────────────────────────────────
  async function createSessionA() {
    if (!inputName.trim()) return;
    const id = genId(6);
    await set(ref(db, "sessions/" + id), {
      id:id, mode:"A", senderName:inputName, receiverName:null,
      messages:{}, createdAt:Date.now(), lastActivity:Date.now(),
      senderRequestedReveal:false, receiverRequestedReveal:false,
      bothRevealed:false, bothJoined:false
    });
    const link = base + "#join=" + id;
    setInviteData({ sessionId:id, link:link });
    const chat = { sessionId:id, side:"sender", myName:inputName };
    saveLocal("rs_chat", chat);
    setActiveChat(chat);
    setModal("inviteA");
  }

  // ── REJOINDRE SESSION MODE A ──────────────────────────────────────────────
  async function joinSessionA() {
    const id = (inputCode || loadLocal("rs_pending_join") || "").toUpperCase();
    if (!inputName.trim() || !id) return;
    const snap = await get(ref(db, "sessions/" + id));
    if (!snap.exists()) { alert("Session introuvable."); return; }
    await update(ref(db, "sessions/" + id), { receiverName:inputName, bothJoined:true, lastActivity:Date.now() });
    clearLocal("rs_pending_join");
    const chat = { sessionId:id, side:"receiver", myName:inputName };
    saveLocal("rs_chat", chat);
    setActiveChat(chat);
    setModal(null);
    setInputName("");
  }

  // ── CRÉER PROFIL MODE B ───────────────────────────────────────────────────
  async function createProfile() {
    if (!inputName.trim()) return;
    await askNotifications();
    const pid = genId(8);
    await set(ref(db, "profiles/" + pid), { id:pid, name:inputName, createdAt:Date.now() });
    const p = { profileId:pid, myName:inputName };
    saveLocal("rs_profile", p);
    setProfile(p);
    setTab("mylink");
    setModal(null);
    setInputName("");
  }

  // ── VISITEUR CLIQUE LIEN PROFIL ───────────────────────────────────────────
  async function startVisitorSession() {
    const targetId = loadLocal("rs_pending_profile");
    if (!inputName.trim() || !targetId) return;
    const snap = await get(ref(db, "profiles/" + targetId));
    if (!snap.exists()) { alert("Ce profil n existe plus."); return; }
    const p = snap.val();
    const id = genId(6);
    await set(ref(db, "sessions/" + id), {
      id:id, mode:"B", profileId:targetId, profileName:p.name,
      visitorName:inputName, messages:{}, createdAt:Date.now(),
      lastActivity:Date.now(), profileRequestedReveal:false,
      visitorRequestedReveal:false, bothRevealed:false, bothJoined:true
    });
    clearLocal("rs_pending_profile");
    const chat = { sessionId:id, side:"visitor", myName:inputName };
    saveLocal("rs_chat", chat);
    setActiveChat(chat);
    setModal(null);
    setInputName("");
  }

  // ── OUVRIR CONVERSATION DASHBOARD ─────────────────────────────────────────
  function openConversation(convo) {
    saveLocal("seen_" + convo.id, Date.now());
    const chat = { sessionId:convo.id, side:"profile", myName:profile.myName };
    saveLocal("rs_chat", chat);
    setActiveChat(chat);
  }

  // ── QUITTER CHAT ──────────────────────────────────────────────────────────
  function quitChat() {
    if (window.confirm("Quitter cette session definitivement ?")) {
      clearLocal("rs_chat");
      setActiveChat(null);
    }
  }

  // ── RETOUR DEPUIS CHAT ────────────────────────────────────────────────────
  function backFromChat() {
    clearLocal("rs_chat");
    setActiveChat(null);
  }

  if (!ready) return (
    <div style={{ minHeight:"100vh", background:"#07060f", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{STYLES}</style>
      <div className="pulse-anim" style={{ fontSize:40 }}>🌒</div>
    </div>
  );

  const hasProfile = !!profile;

  // Si chat actif → afficher le chat
  if (activeChat) {
    const isProfileSide = activeChat.side === "profile";
    return (
      <div style={{ minHeight:"100vh", background:"#07060f", color:"#f0eaf8" }}>
        <style>{STYLES}</style>
        <div style={{ maxWidth:480, margin:"0 auto" }}>
          <ChatScreen
            sessionId={activeChat.sessionId}
            side={activeChat.side}
            myName={activeChat.myName}
            onBack={isProfileSide ? backFromChat : null}
            onQuit={!isProfileSide ? quitChat : null}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#07060f", fontFamily:"'Inter',sans-serif", color:"#f0eaf8", position:"relative", overflow:"hidden" }}>
      <style>{STYLES}</style>

      {/* Orbs */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"rgba(124,58,237,.07)", top:"5%", left:"5%", filter:"blur(80px)", animation:"orbFloat 7s ease-in-out infinite" }} />
        <div style={{ position:"absolute", width:320, height:320, borderRadius:"50%", background:"rgba(219,39,119,.06)", bottom:"10%", right:"5%", filter:"blur(80px)", animation:"orbFloat 9s ease-in-out infinite reverse" }} />
      </div>

      <div style={{ position:"relative", zIndex:1, maxWidth:480, margin:"0 auto", minHeight:"100vh", paddingBottom:80 }}>

        {/* ══ ONGLET NOUVEAU ══ */}
        {tab === "home" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div className="hb-anim" style={{ fontSize:50, marginBottom:18 }}>🌒</div>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:32, fontWeight:400, lineHeight:1.2, marginBottom:10 }}>
              Revele tes<br /><em style={{ color:"#c084fc" }}>Sentiments</em>
            </h1>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.4)", lineHeight:1.9, marginBottom:36 }}>
              Anonymement. Revele-toi quand tu es pret.
            </p>

            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <button style={{ padding:"18px 24px", borderRadius:18, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.03)", cursor:"pointer", textAlign:"left", transition:"all .25s" }}
                onClick={function(){ setModal("newA"); setInputName(""); }}
                onMouseEnter={function(e){ e.currentTarget.style.borderColor="rgba(124,58,237,.4)"; e.currentTarget.style.background="rgba(124,58,237,.06)"; }}
                onMouseLeave={function(e){ e.currentTarget.style.borderColor="rgba(255,255,255,.08)"; e.currentTarget.style.background="rgba(255,255,255,.03)"; }}>
                <div style={{ fontSize:26, marginBottom:8 }}>💌</div>
                <div style={{ fontSize:15, fontFamily:"'Playfair Display',serif", marginBottom:4, color:"#f0eaf8" }}>J ai quelque chose a dire</div>
                <div style={{ fontSize:12, color:"rgba(240,234,248,.38)", lineHeight:1.6 }}>Tu envoies un lien secret a une personne precise.</div>
              </button>

              <button style={{ padding:"18px 24px", borderRadius:18, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.03)", cursor:"pointer", textAlign:"left", transition:"all .25s" }}
                onClick={function(){ hasProfile ? setTab("mylink") : setModal("newB"); setInputName(""); }}
                onMouseEnter={function(e){ e.currentTarget.style.borderColor="rgba(219,39,119,.4)"; e.currentTarget.style.background="rgba(219,39,119,.05)"; }}
                onMouseLeave={function(e){ e.currentTarget.style.borderColor="rgba(255,255,255,.08)"; e.currentTarget.style.background="rgba(255,255,255,.03)"; }}>
                <div style={{ fontSize:26, marginBottom:8 }}>🚪</div>
                <div style={{ fontSize:15, fontFamily:"'Playfair Display',serif", marginBottom:4, color:"#f0eaf8" }}>Quelqu un a quelque chose a me dire</div>
                <div style={{ fontSize:12, color:"rgba(240,234,248,.38)", lineHeight:1.6 }}>Tu partages ton lien. Chaque personne obtient une conversation privee.</div>
              </button>

              <button className="btn btn-ghost" style={{ marginTop:4 }} onClick={function(){ setModal("joinA"); setInputName(""); setInputCode(""); }}>
                J ai recu un lien - Rejoindre
              </button>
            </div>
          </div>
        )}

        {/* ══ ONGLET MESSAGES ══ */}
        {tab === "messages" && (
          <div className="fade" style={{ padding:"24px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:400 }}>
                Tes conversations
              </h2>
              <div style={{ fontSize:12, color:"rgba(240,234,248,.3)" }}>
                {conversations.length} total
                {unread > 0 && <span style={{ marginLeft:8, background:"#db2777", color:"#fff", borderRadius:50, padding:"2px 8px", fontSize:11 }}>{unread} nouveau{unread>1?"x":""}</span>}
              </div>
            </div>

            {conversations.length === 0 && (
              <div className="pulse-anim" style={{ textAlign:"center", padding:"60px 20px", fontSize:14, color:"rgba(240,234,248,.22)", lineHeight:2 }}>
                🌑<br />Personne n a encore clique ton lien.
              </div>
            )}

            {conversations.map(function(convo) {
              const msgs = convo.messages ? Object.values(convo.messages) : [];
              const lastMsg = msgs.sort(function(a,b){return b.ts-a.ts;})[0];
              const seen = loadLocal("seen_" + convo.id) || 0;
              const unreadCount = msgs.filter(function(m){ return m.ts > seen && m.side === "visitor"; }).length;
              return (
                <div key={convo.id} className="convo-card" onClick={function(){ openConversation(convo); }}>
                  <div style={{ width:42, height:42, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,.25),rgba(219,39,119,.18))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                    {convo.bothRevealed ? "🌟" : "🦋"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <div style={{ fontSize:14, color: convo.bothRevealed ? "#c084fc" : "rgba(240,234,248,.75)" }}>
                        {convo.bothRevealed ? convo.visitorName : "Anonyme"}
                      </div>
                      <div style={{ fontSize:10, color:"rgba(240,234,248,.28)" }}>
                        {lastMsg ? timeAgo(lastMsg.ts) : timeAgo(convo.createdAt)}
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:"rgba(240,234,248,.32)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {lastMsg ? lastMsg.text : "Nouvelle conversation..."}
                    </div>
                  </div>
                  {unreadCount > 0 && (
                    <div style={{ width:20, height:20, borderRadius:"50%", background:"#db2777", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", flexShrink:0, animation:"badgePop .3s ease" }}>
                      {unreadCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ ONGLET MON LIEN ══ */}
        {tab === "mylink" && profile && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:46, marginBottom:16 }}>🔗</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:400, marginBottom:8 }}>
              Ton lien personnel
            </h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.4)", lineHeight:1.8, marginBottom:28 }}>
              Partage-le ou mets-le dans ton statut.<br />
              Chaque personne obtient une conversation privee avec toi.
            </p>

            <div style={{ background:"rgba(124,58,237,.08)", border:"1px solid rgba(124,58,237,.2)", borderRadius:14, padding:"14px 18px", marginBottom:16, textAlign:"left" }}>
              <div style={{ fontSize:10, color:"rgba(240,234,248,.28)", marginBottom:6, letterSpacing:".08em" }}>TON LIEN</div>
              <div style={{ fontFamily:"monospace", fontSize:12, color:"#c084fc", wordBreak:"break-all" }}>{inviteLink}</div>
            </div>

            <div style={{ display:"flex", gap:10, marginBottom:20 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(function(){ setCopied(false); }, 2000); }}>
                {copied ? "Copie !" : "Copier"}
              </button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ window.open("https://wa.me/?text=" + encodeURIComponent("Ce que tu n oses pas me dire en face... dis-le ici\n" + inviteLink)); }}>
                WhatsApp
              </button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ window.open("sms:?body=" + encodeURIComponent("Ce que tu n oses pas me dire en face... dis-le ici\n" + inviteLink)); }}>
                SMS
              </button>
            </div>

            <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"14px 16px", textAlign:"left" }}>
              <div style={{ fontSize:11, color:"rgba(240,234,248,.28)", marginBottom:8, letterSpacing:".06em" }}>MESSAGE SUGGERE POUR TON STATUT</div>
              <div style={{ fontSize:14, color:"rgba(240,234,248,.6)", lineHeight:1.7, fontStyle:"italic" }}>
                "Ce que tu n oses pas me dire en face... dis-le ici 🌒"
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ══ BOTTOM NAV ══ */}
      <BottomNav tab={tab} setTab={setTab} unread={unread} hasProfile={hasProfile} />

      {/* ══════════════ MODALS ══════════════ */}
      {modal && (
        <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,.7)", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={function(e){ if(e.target===e.currentTarget){ setModal(null); setInputName(""); setInputCode(""); }}}>
          <div className="fade" style={{ background:"#0e0c1a", border:"1px solid rgba(255,255,255,.1)", borderRadius:"24px 24px 0 0", padding:"28px 24px 40px", width:"100%", maxWidth:480 }}>

            {/* Modal : Mode A */}
            {modal === "newA" && (
              <>
                <div style={{ fontSize:36, marginBottom:12, textAlign:"center" }}>💌</div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, textAlign:"center", marginBottom:8 }}>Ton prenom secret</h3>
                <p style={{ fontSize:13, color:"rgba(240,234,248,.4)", textAlign:"center", marginBottom:24, lineHeight:1.7 }}>Il restera cache jusqu a la revelation.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <input placeholder="Ton prenom" value={inputName} onChange={function(e){setInputName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&inputName.trim())createSessionA();}} autoFocus />
                  <button className="btn btn-primary" onClick={createSessionA} disabled={!inputName.trim()}>Creer la session</button>
                </div>
              </>
            )}

            {/* Modal : Invite A */}
            {modal === "inviteA" && inviteData && (
              <>
                <div style={{ fontSize:36, marginBottom:12, textAlign:"center" }}>📨</div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, textAlign:"center", marginBottom:8 }}>Session prete</h3>
                <p style={{ fontSize:13, color:"rgba(240,234,248,.4)", textAlign:"center", marginBottom:20, lineHeight:1.7 }}>Partage ce lien. Elle ne saura pas que c est toi.</p>
                <div style={{ background:"rgba(124,58,237,.08)", border:"1px solid rgba(124,58,237,.2)", borderRadius:12, padding:"12px 16px", marginBottom:14 }}>
                  <div style={{ fontSize:10, color:"rgba(240,234,248,.28)", marginBottom:5, letterSpacing:".06em" }}>LIEN</div>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:"#c084fc", wordBreak:"break-all" }}>{inviteData.link}</div>
                </div>
                <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                  <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ navigator.clipboard.writeText(inviteData.link); setCopied(true); setTimeout(function(){setCopied(false);},2000); }}>{copied?"Copie !":"Copier"}</button>
                  <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ window.open("https://wa.me/?text="+encodeURIComponent("Quelqu un a quelque chose a te dire\n"+inviteData.link)); }}>WhatsApp</button>
                  <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ window.open("sms:?body="+encodeURIComponent("Quelqu un a quelque chose a te dire\n"+inviteData.link)); }}>SMS</button>
                </div>
                <button className="btn btn-primary" style={{ width:"100%" }} onClick={function(){ setModal(null); }}>
                  Ouvrir le chat
                </button>
              </>
            )}

            {/* Modal : Mode B */}
            {modal === "newB" && (
              <>
                <div style={{ fontSize:36, marginBottom:12, textAlign:"center" }}>🚪</div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, textAlign:"center", marginBottom:8 }}>Cree ton profil</h3>
                <p style={{ fontSize:13, color:"rgba(240,234,248,.4)", textAlign:"center", marginBottom:24, lineHeight:1.7 }}>Ton prenom sera cache jusqu a la revelation.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <input placeholder="Ton prenom" value={inputName} onChange={function(e){setInputName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&inputName.trim())createProfile();}} autoFocus />
                  <button className="btn btn-primary" onClick={createProfile} disabled={!inputName.trim()}>Creer mon profil</button>
                </div>
              </>
            )}

            {/* Modal : Rejoindre A */}
            {modal === "joinA" && (
              <>
                <div style={{ fontSize:36, marginBottom:12, textAlign:"center" }}>🦋</div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, textAlign:"center", marginBottom:8 }}>Rejoindre</h3>
                <p style={{ fontSize:13, color:"rgba(240,234,248,.4)", textAlign:"center", marginBottom:24, lineHeight:1.7 }}>Entre ton prenom et le code de session.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <input placeholder="Ton prenom" value={inputName} onChange={function(e){setInputName(e.target.value);}} autoFocus />
                  <input placeholder="Code (ex: AB12CD)" value={inputCode} onChange={function(e){setInputCode(e.target.value.toUpperCase());}} style={{ letterSpacing:".1em", fontFamily:"monospace" }} />
                  <button className="btn btn-primary" onClick={joinSessionA} disabled={!inputName.trim()||!inputCode.trim()}>Rejoindre</button>
                </div>
              </>
            )}

            {/* Modal : Visiteur */}
            {modal === "visitorEntry" && (
              <>
                <div style={{ fontSize:36, marginBottom:12, textAlign:"center" }}>🦋</div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, textAlign:"center", marginBottom:8 }}>Tu as quelque chose a dire</h3>
                <p style={{ fontSize:13, color:"rgba(240,234,248,.4)", textAlign:"center", marginBottom:24, lineHeight:1.7 }}>Entre ton prenom. Il restera secret jusqu a la revelation.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <input placeholder="Ton prenom (secret)" value={inputName} onChange={function(e){setInputName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&inputName.trim())startVisitorSession();}} autoFocus />
                  <button className="btn btn-primary" onClick={startVisitorSession} disabled={!inputName.trim()}>Commencer a ecrire</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
