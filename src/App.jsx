import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase, ref, set, push, onValue, update, get, query, orderByChild, equalTo
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

const VAPID_KEY = ""; // A remplir apres configuration Firebase Cloud Messaging

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

function shareWhatsApp(link) {
  window.open("https://wa.me/?text=" + encodeURIComponent("Quelqu un a quelque chose a te dire\n" + link));
}

function shareSMS(link) {
  window.open("sms:?body=" + encodeURIComponent("Quelqu un a quelque chose a te dire\n" + link));
}

async function requestPushPermission() {
  if (!("Notification" in window)) return null;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

function sendLocalNotif(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, { body: body, icon: "/favicon.ico" });
  }
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Inter:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; background: #07060f; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:.55; } 50% { opacity:1; } }
  @keyframes heartbeat { 0%,100% { transform:scale(1); } 40% { transform:scale(1.18); } 70% { transform:scale(.94); } }
  @keyframes revealAnim { 0% { opacity:0; transform:scale(.8); } 60% { transform:scale(1.06); } 100% { opacity:1; transform:scale(1); } }
  @keyframes orbFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-22px); } }
  @keyframes badgePop { 0% { transform:scale(0); } 70% { transform:scale(1.2); } 100% { transform:scale(1); } }
  .fade { animation: fadeUp .45s ease both; }
  .pulse { animation: pulse 2s ease-in-out infinite; }
  .hb { animation: heartbeat 2.8s ease-in-out infinite; }
  .reveal { animation: revealAnim .6s cubic-bezier(.34,1.56,.64,1) both; }
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
  .btn-danger { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.25); color:rgba(239,68,68,.8); font-family:'Inter',sans-serif; cursor:pointer; transition:all .2s; }
  .btn-danger:hover { background:rgba(239,68,68,.2); }
  .mode-card {
    padding:24px;
    border-radius:20px;
    border:1px solid rgba(255,255,255,.08);
    background:rgba(255,255,255,.03);
    cursor:pointer;
    transition:all .25s;
    text-align:left;
  }
  .mode-card:hover { border-color:rgba(124,58,237,.4); background:rgba(124,58,237,.06); transform:translateY(-2px); }
  .convo-card {
    padding:16px;
    border-radius:14px;
    border:1px solid rgba(255,255,255,.07);
    background:rgba(255,255,255,.03);
    cursor:pointer;
    transition:all .2s;
    display:flex;
    align-items:center;
    gap:14px;
    margin-bottom:10px;
  }
  .convo-card:hover { border-color:rgba(124,58,237,.3); background:rgba(124,58,237,.05); }
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-thumb { background:rgba(124,58,237,.4); border-radius:2px; }
`;

export default function App() {
  const [screen, setScreen]         = useState("loading");
  const [myName, setMyName]         = useState("");
  const [sessionId, setSessionId]   = useState(null);
  const [side, setSide]             = useState(null);
  const [session, setSession]       = useState(null);
  const [input, setInput]           = useState("");
  const [joinCode, setJoinCode]     = useState("");
  const [copied, setCopied]         = useState(false);
  const [expired, setExpired]       = useState(false);
  const [profileId, setProfileId]   = useState(null);
  const [conversations, setConversations] = useState([]);
  const [unread, setUnread]         = useState(0);
  const [notifGranted, setNotifGranted] = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const prevMsgsLen = useRef(0);

  // ── INIT ────────────────────────────────────────────────────────────────────
  useEffect(function() {
    const hash = window.location.hash;

    // Mode A : rejoindre session directe
    const mA = hash.match(/join=([A-Z0-9]+)/);
    if (mA) { setJoinCode(mA[1]); setScreen("joinName"); return; }

    // Mode B : lien profil
    const mB = hash.match(/p=([A-Z0-9]+)/);
    if (mB) { setScreen("visitorName"); saveLocal("rs_target_profile", mB[1]); return; }

    // Restaurer session Mode A
    const savedA = loadLocal("rs_session");
    if (savedA && savedA.sessionId) {
      get(ref(db, "sessions/" + savedA.sessionId)).then(function(snap) {
        if (snap.exists()) {
          setSessionId(savedA.sessionId);
          setSide(savedA.side);
          setMyName(savedA.myName);
          setScreen("chat");
        } else {
          clearLocal("rs_session");
          setScreen("home");
        }
      }).catch(function() { clearLocal("rs_session"); setScreen("home"); });
      return;
    }

    // Restaurer profil Mode B
    const savedB = loadLocal("rs_profile");
    if (savedB && savedB.profileId) {
      setProfileId(savedB.profileId);
      setMyName(savedB.myName);
      setScreen("dashboard");
      return;
    }

    setScreen("home");
  }, []);

  // ── SYNC SESSION ────────────────────────────────────────────────────────────
  useEffect(function() {
    if (!sessionId) return;
    const dbRef = ref(db, "sessions/" + sessionId);
    const unsub = onValue(dbRef, function(snap) {
      if (!snap.exists()) return;
      const s = snap.val();
      const msgs = s.messages ? Object.values(s.messages) : [];
      const lastActivity = msgs.length ? Math.max.apply(null, msgs.map(function(m){return m.ts;})) : s.createdAt;
      if (Date.now() - lastActivity > INACTIVITY_MS) { setExpired(true); clearLocal("rs_session"); }
      else setExpired(false);

      // Notif si nouveau message et pas de moi
      if (msgs.length > prevMsgsLen.current) {
        const last = msgs.sort(function(a,b){return b.ts-a.ts;})[0];
        if (last && last.side !== side) {
          sendLocalNotif("Nouveau message", "Quelqu un t a ecrit");
        }
      }
      prevMsgsLen.current = msgs.length;
      setSession(s);
    });
    return function() { unsub(); };
  }, [sessionId, side]);

  // ── SYNC DASHBOARD (Mode B) ─────────────────────────────────────────────────
  useEffect(function() {
    if (!profileId) return;
    const dbRef = ref(db, "sessions");
    const unsub = onValue(dbRef, function(snap) {
      if (!snap.exists()) { setConversations([]); return; }
      const all = Object.values(snap.val()).filter(function(s) {
        return s.profileId === profileId;
      });
      all.sort(function(a, b) { return b.createdAt - a.createdAt; });
      setConversations(all);
      const totalUnread = all.reduce(function(acc, s) {
        const msgs = s.messages ? Object.values(s.messages) : [];
        const myLastSeen = loadLocal("seen_" + s.id) || 0;
        const unreadMsgs = msgs.filter(function(m) { return m.ts > myLastSeen && m.side === "visitor"; });
        return acc + unreadMsgs.length;
      }, 0);
      setUnread(totalUnread);
      if (totalUnread > 0) sendLocalNotif("Revele tes Sentiments", totalUnread + " nouveau(x) message(s)");
    });
    return function() { unsub(); };
  }, [profileId]);

  useEffect(function() {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [session]);

  // ── DEMANDER NOTIFS ──────────────────────────────────────────────────────────
  async function askNotifications() {
    const granted = await requestPushPermission();
    setNotifGranted(granted);
  }

  // ── MODE A : créer session ───────────────────────────────────────────────────
  async function createSessionA() {
    if (!myName.trim()) return;
    const id = genId(6);
    await set(ref(db, "sessions/" + id), {
      id: id,
      mode: "A",
      senderName: myName,
      receiverName: null,
      messages: {},
      createdAt: Date.now(),
      lastActivity: Date.now(),
      senderRequestedReveal: false,
      receiverRequestedReveal: false,
      bothRevealed: false,
      bothJoined: false
    });
    setSessionId(id);
    setSide("sender");
    saveLocal("rs_session", { sessionId: id, side: "sender", myName: myName });
    setScreen("invite");
  }

  // ── MODE A : rejoindre session ───────────────────────────────────────────────
  async function joinSessionA() {
    const id = joinCode.trim().toUpperCase();
    if (!myName.trim() || !id) return;
    const snap = await get(ref(db, "sessions/" + id));
    if (!snap.exists()) { alert("Session introuvable."); return; }
    await update(ref(db, "sessions/" + id), { receiverName: myName, bothJoined: true, lastActivity: Date.now() });
    setSessionId(id);
    setSide("receiver");
    saveLocal("rs_session", { sessionId: id, side: "receiver", myName: myName });
    setScreen("chat");
  }

  // ── MODE B : créer profil ────────────────────────────────────────────────────
  async function createProfile() {
    if (!myName.trim()) return;
    await askNotifications();
    const pid = genId(8);
    await set(ref(db, "profiles/" + pid), {
      id: pid,
      name: myName,
      createdAt: Date.now()
    });
    setProfileId(pid);
    saveLocal("rs_profile", { profileId: pid, myName: myName });
    setScreen("dashboard");
  }

  // ── MODE B : visiteur clique le lien profil ──────────────────────────────────
  async function startVisitorSession() {
    if (!myName.trim()) return;
    const targetProfileId = loadLocal("rs_target_profile");
    if (!targetProfileId) { alert("Lien invalide."); return; }
    const snap = await get(ref(db, "profiles/" + targetProfileId));
    if (!snap.exists()) { alert("Ce profil n existe plus."); return; }
    const profile = snap.val();
    const id = genId(6);
    await set(ref(db, "sessions/" + id), {
      id: id,
      mode: "B",
      profileId: targetProfileId,
      profileName: profile.name,
      visitorName: myName,
      messages: {},
      createdAt: Date.now(),
      lastActivity: Date.now(),
      profileRequestedReveal: false,
      visitorRequestedReveal: false,
      bothRevealed: false,
      bothJoined: true
    });
    clearLocal("rs_target_profile");
    setSessionId(id);
    setSide("visitor");
    saveLocal("rs_session", { sessionId: id, side: "visitor", myName: myName });
    setScreen("chat");
  }

  // ── MODE B : ouvrir une conversation depuis le dashboard ─────────────────────
  function openConversation(convo) {
    saveLocal("seen_" + convo.id, Date.now());
    setSessionId(convo.id);
    setSide("profile");
    saveLocal("rs_session", { sessionId: convo.id, side: "profile", myName: myName });
    setScreen("chat");
  }

  // ── ENVOYER MESSAGE ──────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionId) return;
    await push(ref(db, "sessions/" + sessionId + "/messages"), { text: text, side: side, ts: Date.now() });
    await update(ref(db, "sessions/" + sessionId), { lastActivity: Date.now() });
    setInput("");
    setTimeout(function() { if (inputRef.current) inputRef.current.focus(); }, 30);
  }

  // ── RÉVÉLATION ────────────────────────────────────────────────────────────────
  async function requestReveal() {
    if (!sessionId || !session) return;
    const isProfile = side === "profile";
    const field = isProfile ? "profileRequestedReveal" : (side === "sender" ? "senderRequestedReveal" : (side === "receiver" ? "receiverRequestedReveal" : "visitorRequestedReveal"));
    const otherField = isProfile ? "visitorRequestedReveal" : (side === "sender" ? "receiverRequestedReveal" : (side === "receiver" ? "senderRequestedReveal" : "profileRequestedReveal"));
    const updates = {};
    updates[field] = true;
    if (session[otherField]) updates.bothRevealed = true;
    await update(ref(db, "sessions/" + sessionId), updates);
  }

  function quitSession() {
    if (window.confirm("Quitter cette session ?")) {
      clearLocal("rs_session");
      setSessionId(null); setSide(null); setSession(null); setInput(""); setExpired(false);
      window.location.hash = "";
      if (profileId) setScreen("dashboard");
      else setScreen("home");
    }
  }

  // ── DONNÉES DÉRIVÉES ─────────────────────────────────────────────────────────
  const msgs = session && session.messages
    ? Object.values(session.messages).sort(function(a, b) { return a.ts - b.ts; })
    : [];

  const iRequested = session ? (
    side === "sender" ? session.senderRequestedReveal :
    side === "receiver" ? session.receiverRequestedReveal :
    side === "profile" ? session.profileRequestedReveal :
    session.visitorRequestedReveal
  ) : false;

  const theyRequested = session ? (
    side === "sender" ? session.receiverRequestedReveal :
    side === "receiver" ? session.senderRequestedReveal :
    side === "profile" ? session.visitorRequestedReveal :
    session.profileRequestedReveal
  ) : false;

  const bothRevealed = session ? session.bothRevealed : false;

  const myDisplayName = myName;
  const theirDisplayName = session ? (
    side === "sender" ? session.receiverName :
    side === "receiver" ? session.senderName :
    side === "profile" ? session.visitorName :
    session.profileName
  ) : "Anonyme";

  const inviteLinkA = window.location.href.split("#")[0] + "#join=" + sessionId;
  const profileLink = window.location.href.split("#")[0] + "#p=" + profileId;

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <div style={{ minHeight:"100vh", background:"#07060f", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <style>{STYLES}</style>
        <div className="pulse" style={{ fontSize:40 }}>🌒</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#07060f", fontFamily:"'Inter',sans-serif", color:"#f0eaf8", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
      <style>{STYLES}</style>

      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", width:420, height:420, borderRadius:"50%", background:"rgba(124,58,237,.07)", top:"5%", left:"8%", filter:"blur(90px)", animation:"orbFloat 7s ease-in-out infinite" }} />
        <div style={{ position:"absolute", width:340, height:340, borderRadius:"50%", background:"rgba(219,39,119,.06)", bottom:"8%", right:"6%", filter:"blur(90px)", animation:"orbFloat 9s ease-in-out infinite reverse" }} />
      </div>

      <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:480 }}>

        {/* ══════════════ HOME ══════════════ */}
        {screen === "home" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div className="hb" style={{ fontSize:54, marginBottom:20 }}>🌒</div>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:34, fontWeight:400, lineHeight:1.2, marginBottom:12 }}>
              Revele tes<br /><em style={{ color:"#c084fc" }}>Sentiments</em>
            </h1>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.9, marginBottom:36 }}>
              Anonymement. Revele-toi quand tu es pret.
            </p>

            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
              <div className="mode-card" onClick={function(){ setScreen("modeA"); }}>
                <div style={{ fontSize:28, marginBottom:10 }}>💌</div>
                <div style={{ fontSize:16, fontFamily:"'Playfair Display',serif", marginBottom:6 }}>J ai quelque chose a dire</div>
                <div style={{ fontSize:13, color:"rgba(240,234,248,.4)", lineHeight:1.6 }}>Tu as quelque chose sur le coeur pour une personne precise. Tu lui envoies un lien secret.</div>
              </div>
              <div className="mode-card" onClick={function(){ setScreen("modeB"); }}>
                <div style={{ fontSize:28, marginBottom:10 }}>🚪</div>
                <div style={{ fontSize:16, fontFamily:"'Playfair Display',serif", marginBottom:6 }}>Quelqu un a quelque chose a me dire</div>
                <div style={{ fontSize:13, color:"rgba(240,234,248,.4)", lineHeight:1.6 }}>Tu ouvres la porte. N importe qui peut t ecrire anonymement. Chaque conversation est separee.</div>
              </div>
            </div>

            <button className="btn btn-ghost" style={{ width:"100%", marginTop:8 }} onClick={function(){ setScreen("joinName"); }}>
              J ai recu un lien - Rejoindre
            </button>
          </div>
        )}

        {/* ══════════════ MODE A SETUP ══════════════ */}
        {screen === "modeA" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:46, marginBottom:20 }}>💌</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:400, marginBottom:10 }}>
              Ton prenom secret
            </h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.8, marginBottom:32 }}>
              Il restera cache jusqu a la revelation.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <input placeholder="Ton prenom" value={myName} onChange={function(e){ setMyName(e.target.value); }} onKeyDown={function(e){ if(e.key==="Enter"&&myName.trim()) createSessionA(); }} autoFocus />
              <button className="btn btn-primary" onClick={createSessionA} disabled={!myName.trim()}>Creer la session</button>
              <button className="btn btn-ghost" onClick={function(){ setScreen("home"); }}>Retour</button>
            </div>
          </div>
        )}

        {/* ══════════════ MODE B SETUP ══════════════ */}
        {screen === "modeB" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:46, marginBottom:20 }}>🚪</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:400, marginBottom:10 }}>
              Cree ton profil
            </h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.8, marginBottom:32 }}>
              Ton prenom sera revele seulement si tu l acceptes.<br />
              <span style={{ color:"rgba(192,132,252,.6)", fontSize:12 }}>Les notifications seront activees pour te prevenir.</span>
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <input placeholder="Ton prenom" value={myName} onChange={function(e){ setMyName(e.target.value); }} onKeyDown={function(e){ if(e.key==="Enter"&&myName.trim()) createProfile(); }} autoFocus />
              <button className="btn btn-primary" onClick={createProfile} disabled={!myName.trim()}>Creer mon profil</button>
              <button className="btn btn-ghost" onClick={function(){ setScreen("home"); }}>Retour</button>
            </div>
          </div>
        )}

        {/* ══════════════ VISITOR NAME (Mode B) ══════════════ */}
        {screen === "visitorName" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:46, marginBottom:20 }}>🦋</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:400, marginBottom:10 }}>
              Tu as quelque chose a dire
            </h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.8, marginBottom:32 }}>
              Entre ton prenom. Il restera secret jusqu a la revelation.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <input placeholder="Ton prenom (secret)" value={myName} onChange={function(e){ setMyName(e.target.value); }} onKeyDown={function(e){ if(e.key==="Enter"&&myName.trim()) startVisitorSession(); }} autoFocus />
              <button className="btn btn-primary" onClick={startVisitorSession} disabled={!myName.trim()}>Commencer a ecrire</button>
            </div>
          </div>
        )}

        {/* ══════════════ INVITE (Mode A) ══════════════ */}
        {screen === "invite" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div className="pulse" style={{ fontSize:46, marginBottom:20 }}>📨</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:400, marginBottom:10 }}>
              Ta session est prete
            </h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.8, marginBottom:32 }}>
              Partage ce lien. Elle ne saura pas que c est toi.<br />
              <span style={{ color:"rgba(251,191,36,.6)", fontSize:12 }}>Expire apres 48h sans message.</span>
            </p>
            <div style={{ background:"rgba(124,58,237,.1)", border:"1px solid rgba(124,58,237,.22)", borderRadius:14, padding:"14px 18px", marginBottom:14, textAlign:"left" }}>
              <div style={{ fontSize:11, color:"rgba(240,234,248,.3)", marginBottom:6 }}>LIEN DE SESSION</div>
              <div style={{ fontFamily:"monospace", fontSize:12, color:"#c084fc", wordBreak:"break-all" }}>{inviteLinkA}</div>
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ navigator.clipboard.writeText(inviteLinkA); setCopied(true); setTimeout(function(){ setCopied(false); }, 2000); }}>
                {copied ? "Copie !" : "Copier"}
              </button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ shareWhatsApp(inviteLinkA); }}>WhatsApp</button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ shareSMS(inviteLinkA); }}>SMS</button>
            </div>
            <div style={{ fontSize:12, color:"rgba(240,234,248,.28)", marginBottom:28 }}>
              Code: <span style={{ fontFamily:"monospace", color:"rgba(192,132,252,.7)", letterSpacing:".12em" }}>{sessionId}</span>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={function(){ setScreen("chat"); }}>
              Ouvrir le chat et attendre
            </button>
          </div>
        )}

        {/* ══════════════ JOIN NAME (Mode A) ══════════════ */}
        {screen === "joinName" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:46, marginBottom:20 }}>🦋</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:400, marginBottom:10 }}>
              Quelqu un te parle
            </h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.8, marginBottom:32 }}>
              Entre ton prenom. Il restera secret jusqu a la revelation.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <input placeholder="Ton prenom" value={myName} onChange={function(e){ setMyName(e.target.value); }} autoFocus />
              <input placeholder="Code de session (ex: AB12CD)" value={joinCode} onChange={function(e){ setJoinCode(e.target.value.toUpperCase()); }} style={{ letterSpacing:".1em", fontFamily:"monospace" }} />
              <button className="btn btn-primary" onClick={joinSessionA} disabled={!myName.trim()||!joinCode.trim()}>Rejoindre</button>
            </div>
          </div>
        )}

        {/* ══════════════ DASHBOARD (Mode B) ══════════════ */}
        {screen === "dashboard" && (
          <div className="fade" style={{ padding:"24px", minHeight:"100vh" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
              <div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:400 }}>
                  🚪 Ta porte ouverte
                </h2>
                <div style={{ fontSize:12, color:"rgba(240,234,248,.35)", marginTop:4 }}>
                  {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                  {unread > 0 && <span style={{ marginLeft:8, background:"#db2777", color:"#fff", borderRadius:50, padding:"2px 8px", fontSize:11, animation:"badgePop .3s ease" }}>{unread} nouveau{unread > 1 ? "x" : ""}</span>}
                </div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize:12, padding:"8px 14px" }} onClick={function(){ setScreen("shareProfile"); }}>
                Partager mon lien
              </button>
            </div>

            {conversations.length === 0 && (
              <div className="pulse" style={{ textAlign:"center", padding:"60px 20px", fontSize:14, color:"rgba(240,234,248,.25)", lineHeight:2 }}>
                🌑<br />Personne n a encore clique ton lien.<br />Partage-le pour recevoir des messages.
              </div>
            )}

            {conversations.map(function(convo) {
              const msgs = convo.messages ? Object.values(convo.messages) : [];
              const lastMsg = msgs.sort(function(a,b){return b.ts-a.ts;})[0];
              const myLastSeen = loadLocal("seen_" + convo.id) || 0;
              const unreadCount = msgs.filter(function(m){ return m.ts > myLastSeen && m.side === "visitor"; }).length;
              return (
                <div key={convo.id} className="convo-card" onClick={function(){ openConversation(convo); }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,.3),rgba(219,39,119,.2))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                    🦋
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                      <div style={{ fontSize:14, color: convo.bothRevealed ? "#c084fc" : "rgba(240,234,248,.7)" }}>
                        {convo.bothRevealed ? convo.visitorName : "Anonyme"}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(240,234,248,.3)" }}>
                        {lastMsg ? timeAgo(lastMsg.ts) : timeAgo(convo.createdAt)}
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:"rgba(240,234,248,.35)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {lastMsg ? lastMsg.text : "Nouvelle conversation..."}
                    </div>
                  </div>
                  {unreadCount > 0 && (
                    <div style={{ width:20, height:20, borderRadius:"50%", background:"#db2777", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", flexShrink:0, animation:"badgePop .3s ease" }}>
                      {unreadCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════ SHARE PROFILE ══════════════ */}
        {screen === "shareProfile" && (
          <div className="fade" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:46, marginBottom:20 }}>🔗</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:400, marginBottom:10 }}>
              Ton lien personnel
            </h2>
            <p style={{ fontSize:14, color:"rgba(240,234,248,.45)", lineHeight:1.8, marginBottom:32 }}>
              Partage ce lien. Chaque personne qui clique<br />obtient une conversation privee avec toi.
            </p>
            <div style={{ background:"rgba(124,58,237,.1)", border:"1px solid rgba(124,58,237,.22)", borderRadius:14, padding:"14px 18px", marginBottom:14, textAlign:"left" }}>
              <div style={{ fontSize:11, color:"rgba(240,234,248,.3)", marginBottom:6 }}>TON LIEN</div>
              <div style={{ fontFamily:"monospace", fontSize:12, color:"#c084fc", wordBreak:"break-all" }}>{profileLink}</div>
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:24 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ navigator.clipboard.writeText(profileLink); setCopied(true); setTimeout(function(){ setCopied(false); }, 2000); }}>
                {copied ? "Copie !" : "Copier"}
              </button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ shareWhatsApp(profileLink); }}>WhatsApp</button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={function(){ shareSMS(profileLink); }}>SMS</button>
            </div>
            <button className="btn btn-ghost" style={{ width:"100%" }} onClick={function(){ setScreen("dashboard"); }}>
              Retour au tableau de bord
            </button>
          </div>
        )}

        {/* ══════════════ CHAT ══════════════ */}
        {screen === "chat" && session && (
          <div style={{ height:"100vh", display:"flex", flexDirection:"column" }}>

            <div style={{ padding:"14px 20px", background:"rgba(7,6,15,.92)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17 }}>
                  🌒 <em style={{ color:"#c084fc" }}>Session privee</em>
                </div>
                <div style={{ fontSize:11, color:"rgba(240,234,248,.3)", marginTop:3 }}>
                  {session.bothJoined ? "Connectes" : "En attente..."}
                </div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ fontFamily:"monospace", fontSize:11, color:"rgba(124,58,237,.8)", background:"rgba(124,58,237,.1)", border:"1px solid rgba(124,58,237,.2)", padding:"3px 8px", borderRadius:6 }}>
                  {sessionId}
                </div>
                {(profileId && side === "profile") ? (
                  <button style={{ padding:"6px 12px", fontSize:11, borderRadius:20, border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.05)", color:"rgba(240,234,248,.7)", cursor:"pointer", fontFamily:"Inter,sans-serif", transition:"all .2s" }} onClick={function(){ setScreen("dashboard"); }}>
                    ← Retour
                  </button>
                ) : (
                  <button className="btn-danger" style={{ padding:"6px 12px", fontSize:11, borderRadius:20, border:"1px solid rgba(239,68,68,.25)" }} onClick={quitSession}>
                    Quitter
                  </button>
                )}
              </div>
            </div>

            {expired && (
              <div style={{ padding:"24px", textAlign:"center", background:"rgba(239,68,68,.08)", borderBottom:"1px solid rgba(239,68,68,.2)" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>⌛</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"rgba(239,68,68,.9)", marginBottom:6 }}>Session expiree</div>
                <div style={{ fontSize:13, color:"rgba(240,234,248,.4)", marginBottom:16 }}>48h sans message.</div>
                <button className="btn btn-primary" onClick={function(){ clearLocal("rs_session"); setSession(null); setSessionId(null); setScreen(profileId ? "dashboard" : "home"); }}>
                  {profileId ? "Retour au tableau de bord" : "Nouvelle session"}
                </button>
              </div>
            )}

            {!expired && (
              <div style={{ flex:1, overflowY:"auto", padding:"20px 16px" }}>
                {!session.bothJoined && (
                  <div className="pulse" style={{ textAlign:"center", padding:"60px 20px", fontSize:14, color:"rgba(240,234,248,.3)", lineHeight:2 }}>
                    🌑<br />En attente...
                  </div>
                )}

                {msgs.map(function(msg, i) {
                  const isMe = msg.side === side;
                  return (
                    <div key={i} className="fade" style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", marginBottom:14 }}>
                      <div style={{ maxWidth:"76%" }}>
                        <div style={{ padding:"11px 16px", background:isMe?"linear-gradient(135deg,rgba(124,58,237,.32),rgba(219,39,119,.22))":"rgba(255,255,255,.05)", border:"1px solid "+(isMe?"rgba(124,58,237,.28)":"rgba(255,255,255,.08)"), borderRadius:isMe?"18px 4px 18px 18px":"4px 18px 18px 18px", fontSize:15, lineHeight:1.65, color:"#f0eaf8" }}>
                          {msg.text}
                        </div>
                        <div style={{ fontSize:10, color:"rgba(240,234,248,.22)", marginTop:4, textAlign:isMe?"right":"left" }}>
                          {isMe ? "Toi" : "Anonyme"} · {timeAgo(msg.ts)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {theyRequested && !iRequested && !bothRevealed && (
                  <div className="pulse" style={{ textAlign:"center", margin:"16px 0", fontSize:13, color:"#c084fc", fontStyle:"italic" }}>
                    L autre souhaite se reveler...
                  </div>
                )}
                {iRequested && !bothRevealed && (
                  <div style={{ textAlign:"center", margin:"16px 0", fontSize:13, color:"rgba(251,191,36,.8)", fontStyle:"italic" }}>
                    En attente de l autre...
                  </div>
                )}

                {bothRevealed && (
                  <div className="reveal" style={{ margin:"20px 0", padding:"22px", background:"linear-gradient(135deg,rgba(124,58,237,.18),rgba(219,39,119,.14))", border:"1px solid rgba(124,58,237,.28)", borderRadius:16, textAlign:"center" }}>
                    <div style={{ fontSize:30, marginBottom:8, animation:"heartbeat 2s infinite" }}>🌟</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, marginBottom:6 }}>
                      <em style={{ color:"#c084fc" }}>{myDisplayName}</em>
                      {" & "}
                      <em style={{ color:"#f472b6" }}>{theirDisplayName}</em>
                    </div>
                    <div style={{ fontSize:13, color:"rgba(240,234,248,.45)", marginBottom:8 }}>Vous vous etes reveles</div>
                    <div style={{ fontSize:12, color:"rgba(240,234,248,.3)" }}>La magie a opere. Continuez ailleurs.</div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}

            {!bothRevealed && !expired && session.bothJoined && (
              <div style={{ padding:"12px 16px", background:"rgba(124,58,237,.07)", borderTop:"1px solid rgba(124,58,237,.12)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexShrink:0 }}>
                <div style={{ fontSize:12, color:"rgba(240,234,248,.4)", lineHeight:1.6 }}>
                  Vous vous comprenez ?<br />
                  <span style={{ color:"rgba(192,132,252,.6)" }}>Les deux doivent accepter.</span>
                </div>
                <button onClick={requestReveal} disabled={iRequested} style={{ padding:"10px 18px", background:iRequested?"rgba(251,191,36,.1)":"linear-gradient(135deg,rgba(124,58,237,.4),rgba(219,39,119,.3))", border:"1px solid "+(iRequested?"rgba(251,191,36,.3)":"rgba(124,58,237,.35)"), borderRadius:50, color:iRequested?"#fbbf24":"#f0eaf8", fontFamily:"'Inter',sans-serif", fontSize:13, cursor:iRequested?"default":"pointer", whiteSpace:"nowrap", transition:"all .2s", flexShrink:0 }}>
                  {iRequested ? "En attente..." : "Me reveler"}
                </button>
              </div>
            )}

            {!expired && (
              <div style={{ padding:"12px 16px 24px", background:"rgba(7,6,15,.95)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,.06)", display:"flex", gap:10, alignItems:"flex-end", flexShrink:0 }}>
                <textarea ref={inputRef} rows={1} placeholder={session.bothJoined?"Exprime-toi librement...":"En attente..."} value={input} disabled={!session.bothJoined} onChange={function(e){ setInput(e.target.value); }} onKeyDown={function(e){ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }} onInput={function(e){ e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }} style={{ flex:1, borderRadius:14, minHeight:48 }} />
                <button onClick={sendMessage} disabled={!input.trim()||!session.bothJoined} style={{ width:46, height:46, borderRadius:"50%", background:input.trim()&&session.bothJoined?"linear-gradient(135deg,#7c3aed,#db2777)":"rgba(255,255,255,.05)", border:"none", color:input.trim()&&session.bothJoined?"#fff":"rgba(255,255,255,.2)", fontSize:18, cursor:input.trim()&&session.bothJoined?"pointer":"default", transition:"all .2s", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>↑</button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
