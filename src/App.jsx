import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import {
  USERS, USER_MAP, CATEGORIES, CAT_MAP, SPLIT_PRESETS, PALETTE,
  T, FONT as F, uid, fmt, monthKey, monthLabel, daysLeft, prevMonth, nextMonth,
  getLast12Months, hashPin, calcSettlements, MAX_PIN_ATTEMPTS, LOCKOUT_MINUTES,
} from "./constants.js";

// ============================================================================
// GLOBAL CSS
// ============================================================================

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { background: ${T.bg}; font-family: ${F}; overflow-x: hidden; }
input, select, textarea { font-family: ${F}; }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: ${T.b}; border-radius: 4px; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
`;

// ============================================================================
// SHARED UI COMPONENTS
// ============================================================================

const Btn = ({ children, onClick, color = T.accent, small, disabled, style = {} }) => (
  <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
    background: disabled ? T.b : color, color: T.w, border: "none", borderRadius: 12,
    padding: small ? "8px 16px" : "12px 24px", fontSize: small ? 13 : 15,
    fontWeight: 700, fontFamily: F, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, transition: "all 0.2s", ...style,
  }}>{children}</button>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: T.c, borderRadius: 16, padding: 20, border: `1px solid ${T.b}`, animation: "fadeIn 0.4s ease", ...style }}>{children}</div>
);

const Input = ({ label, value, onChange, type = "text", placeholder, style = {}, ...rest }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ color: T.ts, fontSize: 12, fontWeight: 700, fontFamily: F, display: "block", marginBottom: 6 }}>{label}</label>}
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", background: T.c2, border: `1px solid ${T.b}`, borderRadius: 10, padding: "10px 14px", color: T.w, fontSize: 15, fontFamily: F, outline: "none", ...style }}
      onFocus={(e) => (e.target.style.borderColor = T.accent)} onBlur={(e) => (e.target.style.borderColor = T.b)} {...rest} />
  </div>
);

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.c, borderRadius: 20, padding: 24, border: `1px solid ${T.b}`, maxWidth: 440, width: "100%", maxHeight: "80vh", overflowY: "auto", animation: "slideUp 0.3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: T.w, fontSize: 18, fontWeight: 800, fontFamily: F, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.tm, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const EmptyState = ({ icon, title, subtitle }) => (
  <div style={{ textAlign: "center", padding: "40px 20px" }}>
    <span style={{ fontSize: 48, display: "block", marginBottom: 12, animation: "float 3s ease-in-out infinite" }}>{icon}</span>
    <p style={{ color: T.w, fontSize: 16, fontWeight: 700, fontFamily: F, marginBottom: 6 }}>{title}</p>
    {subtitle && <p style={{ color: T.tm, fontSize: 13, fontFamily: F }}>{subtitle}</p>}
  </div>
);

const Toast = ({ message, type = "success", onClose }) => {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => { const t = setTimeout(() => ref.current(), 3000); return () => clearTimeout(t); }, []);
  const bg = type === "success" ? T.green : type === "error" ? T.red : T.yellow;
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: bg, color: "#fff", padding: "12px 24px", borderRadius: 12, fontFamily: F, fontWeight: 700, fontSize: 14, zIndex: 2000, animation: "slideUp 0.3s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: "90vw", textAlign: "center" }}>
      {message}
    </div>
  );
};

// ============================================================================
// PIN INPUT
// ============================================================================

const PinInput = ({ onComplete }) => {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const refs = useRef([]);
  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits]; next[idx] = val; setDigits(next);
    if (val && idx < 3) refs.current[idx + 1]?.focus();
    if (next.every((d) => d !== "")) onComplete(next.join(""));
  };
  const handleKey = (idx, e) => { if (e.key === "Backspace" && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus(); };
  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} type="tel" inputMode="numeric" maxLength={1}
          value={d} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKey(i, e)}
          style={{ width: 52, height: 60, textAlign: "center", background: T.c2, border: `2px solid ${d ? T.accent : T.b}`, borderRadius: 12, color: T.w, fontSize: 24, fontWeight: 800, fontFamily: F, outline: "none" }}
          onFocus={(e) => (e.target.style.borderColor = T.accent)} onBlur={(e) => (e.target.style.borderColor = d ? T.accent : T.b)} />
      ))}
    </div>
  );
};

// ============================================================================
// LOGIN — PIN with lockout, max attempts, email recovery
// ============================================================================

const Login = ({ onLogin, toast }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [mode, setMode] = useState("select"); // select | register_email | create | pin | recovery
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinAttempt, setPinAttempt] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_PIN_ATTEMPTS);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [email, setEmail] = useState("");

  const handleUserSelect = async (user) => {
    setSelectedUser(user); setError(""); setLoading(true);
    const { data } = await supabase.from("users").select("pin_hash, email, failed_attempts, locked_until").eq("id", user.id).single();
    setLoading(false);
    if (!data) { setMode("register_email"); return; }

    // Check lockout
    if (data.locked_until && new Date(data.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(data.locked_until) - new Date()) / 60000);
      setLockedUntil(data.locked_until);
      setError(`Cuenta bloqueada. Intenta en ${mins} min.`);
      setMode("pin");
      return;
    }

    setAttemptsLeft(MAX_PIN_ATTEMPTS - (data.failed_attempts || 0));
    if (!data.pin_hash) {
      // Has no PIN yet — if also no email, ask for email first
      setMode(data.email ? "create" : "register_email");
    } else {
      setMode("pin");
    }
  };

  const handleRegisterEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Ingresa un email válido");
      return;
    }
    setLoading(true); setError("");
    await supabase.from("users").update({ email: trimmed }).eq("id", selectedUser.id);
    setLoading(false);
    toast?.("Email guardado. Ahora crea tu PIN.", "success");
    setMode("create");
  };

  const handlePin = async (pin) => {
    if (pin.length !== 4 || !selectedUser) return;
    if (lockedUntil && new Date(lockedUntil) > new Date()) return;
    setLoading(true); setError("");

    if (mode === "create") {
      await supabase.from("users").update({ pin_hash: hashPin(pin), failed_attempts: 0, locked_until: null }).eq("id", selectedUser.id);
      setLoading(false);
      onLogin(selectedUser);
      return;
    }

    const { data } = await supabase.from("users").select("pin_hash, failed_attempts").eq("id", selectedUser.id).single();
    if (data?.pin_hash === hashPin(pin)) {
      await supabase.from("users").update({ failed_attempts: 0, locked_until: null }).eq("id", selectedUser.id);
      setLoading(false);
      onLogin(selectedUser);
    } else {
      const newAttempts = (data?.failed_attempts || 0) + 1;
      const remaining = MAX_PIN_ATTEMPTS - newAttempts;
      const updates = { failed_attempts: newAttempts };
      if (remaining <= 0) {
        updates.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        setLockedUntil(updates.locked_until);
        setError(`Cuenta bloqueada por ${LOCKOUT_MINUTES} min.`);
      } else {
        setError(`PIN incorrecto (${remaining} intento${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"})`);
      }
      setAttemptsLeft(remaining);
      await supabase.from("users").update(updates).eq("id", selectedUser.id);
      setLoading(false);
      setPinAttempt((p) => p + 1);
    }
  };

  const handleRecovery = async () => {
    if (!email.trim() || !selectedUser) return;
    setLoading(true); setError("");
    const { data: userData } = await supabase.from("users").select("email").eq("id", selectedUser.id).single();
    if (!userData?.email) {
      setLoading(false);
      setError("No hay email registrado. Contacta a los demás para resetear.");
      return;
    }
    if (userData.email.toLowerCase() !== email.trim().toLowerCase()) {
      setLoading(false);
      setError("El email no coincide con el registrado.");
      return;
    }
    await supabase.from("users").update({ pin_hash: null, failed_attempts: 0, locked_until: null }).eq("id", selectedUser.id);
    setLoading(false);
    toast?.("PIN reseteado. Crea uno nuevo.", "success");
    setMode("create");
    setError("");
    setLockedUntil(null);
    setPinAttempt((p) => p + 1);
  };

  const isLocked = lockedUntil && new Date(lockedUntil) > new Date();

  const goBack = () => { setSelectedUser(null); setMode("select"); setError(""); setLockedUntil(null); setEmail(""); };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: `linear-gradient(180deg, ${T.bg} 0%, #0A1A10 50%, ${T.c} 100%)` }}>
      <div style={{ animation: "float 4s ease-in-out infinite", marginBottom: 8 }}><span style={{ fontSize: 56 }}>🏔️</span></div>
      <h1 style={{ color: T.w, fontSize: 32, fontWeight: 900, fontFamily: F, margin: "0 0 4px", letterSpacing: "-1px" }}>CasaValle</h1>
      <p style={{ color: T.tm, fontSize: 14, fontFamily: F, marginBottom: 36 }}>Gastos compartidos · Valle de Bravo</p>

      {!selectedUser ? (
        <div style={{ width: "100%", maxWidth: 360 }}>
          <p style={{ color: T.ts, fontSize: 13, fontFamily: F, textAlign: "center", marginBottom: 20 }}>¿Quién eres?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {USERS.map((u, i) => (
              <button key={u.id} onClick={() => handleUserSelect(u)}
                style={{ background: T.c, border: `2px solid ${T.b}`, borderRadius: 16, padding: "20px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.2s", animation: `fadeIn 0.4s ease ${i * 0.1}s both` }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = u.color; e.currentTarget.style.transform = "scale(1.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.b; e.currentTarget.style.transform = "scale(1)"; }}>
                <span style={{ fontSize: 32 }}>{u.emoji}</span>
                <span style={{ color: T.w, fontSize: 15, fontWeight: 700, fontFamily: F }}>{u.name}</span>
              </button>
            ))}
          </div>
        </div>

      ) : mode === "register_email" ? (
        <div style={{ width: "100%", maxWidth: 360, animation: "fadeIn 0.3s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 40 }}>{selectedUser.emoji}</span>
            <h2 style={{ color: T.w, fontSize: 20, fontWeight: 800, fontFamily: F, margin: "8px 0 4px" }}>Hola {selectedUser.name}!</h2>
            <p style={{ color: T.tm, fontSize: 13, fontFamily: F }}>Registra tu email para poder recuperar tu PIN si lo olvidás</p>
          </div>
          <Input label="EMAIL" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" />
          {error && <p style={{ color: T.red, fontSize: 13, fontFamily: F, textAlign: "center", marginBottom: 12 }}>{error}</p>}
          <Btn onClick={handleRegisterEmail} disabled={!email.trim() || loading} style={{ width: "100%", marginBottom: 12 }}>
            {loading ? "Guardando..." : "Continuar"}
          </Btn>
          <button onClick={goBack} style={{ background: "none", border: "none", color: T.tm, fontSize: 13, fontFamily: F, cursor: "pointer", display: "block", margin: "0 auto", padding: 8 }}>← Cambiar usuario</button>
        </div>

      ) : mode === "recovery" ? (
        <div style={{ width: "100%", maxWidth: 360, animation: "fadeIn 0.3s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 40 }}>{selectedUser.emoji}</span>
            <h2 style={{ color: T.w, fontSize: 20, fontWeight: 800, fontFamily: F, margin: "8px 0 4px" }}>Recuperar acceso</h2>
            <p style={{ color: T.tm, fontSize: 13, fontFamily: F }}>Ingresa el email que registraste para resetear el PIN</p>
          </div>
          <Input label="EMAIL" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" />
          {error && <p style={{ color: T.red, fontSize: 13, fontFamily: F, textAlign: "center", marginBottom: 12 }}>{error}</p>}
          <Btn onClick={handleRecovery} disabled={!email.trim() || loading} style={{ width: "100%", marginBottom: 12 }}>
            {loading ? "Procesando..." : "Resetear PIN"}
          </Btn>
          <button onClick={() => { setMode("pin"); setError(""); setEmail(""); }} style={{ background: "none", border: "none", color: T.tm, fontSize: 13, fontFamily: F, cursor: "pointer", display: "block", margin: "0 auto", padding: 8 }}>← Volver</button>
        </div>

      ) : (
        <div style={{ width: "100%", maxWidth: 360, animation: "fadeIn 0.3s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 40 }}>{selectedUser.emoji}</span>
            <h2 style={{ color: T.w, fontSize: 20, fontWeight: 800, fontFamily: F, margin: "8px 0 4px" }}>
              {mode === "create" ? `${selectedUser.name}, crea tu PIN` : selectedUser.name}
            </h2>
            <p style={{ color: T.tm, fontSize: 13, fontFamily: F }}>
              {mode === "create" ? "Elige 4 dígitos que puedas recordar" : "Ingresa tu PIN"}
            </p>
          </div>
          {loading ? (
            <p style={{ color: T.tm, fontSize: 14, fontFamily: F, textAlign: "center" }}>Cargando...</p>
          ) : isLocked ? null : (
            <PinInput key={pinAttempt} onComplete={handlePin} />
          )}
          {error && <p style={{ color: T.red, fontSize: 13, fontFamily: F, textAlign: "center", marginTop: 12 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20 }}>
            <button onClick={goBack}
              style={{ background: "none", border: "none", color: T.tm, fontSize: 13, fontFamily: F, cursor: "pointer", padding: 8 }}>← Cambiar usuario</button>
            {mode === "pin" && (isLocked || attemptsLeft <= 2) && (
              <button onClick={() => { setMode("recovery"); setError(""); setEmail(""); }}
                style={{ background: "none", border: "none", color: T.accent2, fontSize: 13, fontFamily: F, cursor: "pointer", padding: 8 }}>Olvidé mi PIN</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EXPENSE FORM — unified for new + edit, with photo, split, notes
// ============================================================================

const ExpForm = ({ me, onSave, editExp, onCancel }) => {
  const [amount, setAmount] = useState(editExp ? String(editExp.amount) : "");
  const [category, setCategory] = useState(editExp?.category || "otro");
  const [desc, setDesc] = useState(editExp?.description || "");
  const [note, setNote] = useState(editExp?.note || "");
  const [photo, setPhoto] = useState(editExp?.photo || null);
  const [splitAmong, setSplitAmong] = useState(editExp?.split_among || USERS.map((u) => u.id));
  const [splitType, setSplitType] = useState(editExp?.split_type || "equal");
  const [customSplit, setCustomSplit] = useState(editExp?.custom_split || {});
  const [showNote, setShowNote] = useState(!!editExp?.note);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef(null);

  const toggleUser = (id) => {
    setSplitAmong((prev) => {
      const next = prev.includes(id) ? (prev.length <= 1 ? prev : prev.filter((u) => u !== id)) : [...prev, id];
      if (splitType !== "equal") {
        setCustomSplit((cs) => {
          const cleaned = {};
          next.forEach((uid) => { cleaned[uid] = cs[uid] || (splitType === "percent" ? (100 / next.length).toFixed(1) : "0"); });
          return cleaned;
        });
      }
      return next;
    });
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setFormError("Imagen muy grande (máx 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setFormError("Ingresa un monto válido"); return; }
    if (splitAmong.length === 0) { setFormError("Selecciona al menos una persona"); return; }
    setFormError("");

    if (splitType === "custom") {
      const total = Object.values(customSplit).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      if (Math.abs(total - amt) > 0.02) { setFormError(`Montos suman ${fmt(total)}, gasto es ${fmt(amt)}`); return; }
    }
    if (splitType === "percent") {
      const total = Object.values(customSplit).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      if (Math.abs(total - 100) > 0.5) { setFormError(`Porcentajes suman ${total.toFixed(1)}% (deben ser 100%)`); return; }
    }

    setSaving(true);
    const exp = {
      id: editExp?.id || uid(),
      amount: amt, category, description: desc.trim(), note: note.trim(), photo,
      paid_by: editExp?.paid_by || me.id, split_among: splitAmong, split_type: splitType,
      custom_split: splitType !== "equal" ? customSplit : null,
      month: editExp?.month || monthKey(),
      is_recurring: editExp?.is_recurring || false,
      recurring_id: editExp?.recurring_id || null,
    };
    await onSave(exp);
    setSaving(false);
  };

  const amtNum = parseFloat(amount) || 0;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <Card>
        <h3 style={{ color: T.w, fontSize: 18, fontWeight: 800, fontFamily: F, marginBottom: 20 }}>{editExp ? "✏️ Editar gasto" : "➕ Nuevo gasto"}</h3>
        <Input label="MONTO" type="number" value={amount} onChange={setAmount} placeholder="0.00" inputMode="decimal" style={{ fontSize: 24, fontWeight: 800, textAlign: "center" }} />

        {/* Category grid — 3 cols, scrollable */}
        <label style={{ color: T.ts, fontSize: 12, fontWeight: 700, fontFamily: F, display: "block", marginBottom: 8 }}>CATEGORÍA</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} style={{
              background: category === c.id ? T.accent + "30" : T.c2, border: `1.5px solid ${category === c.id ? T.accent : T.b}`,
              borderRadius: 10, padding: "8px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ color: category === c.id ? T.w : T.tm, fontSize: 9, fontWeight: 600, fontFamily: F }}>{c.label}</span>
            </button>
          ))}
        </div>

        <Input label="DESCRIPCIÓN (opcional)" value={desc} onChange={setDesc} placeholder="Ej: Pago mensual CFE" />

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setShowNote(!showNote)} style={{ background: showNote ? T.accent + "20" : T.c2, border: `1px solid ${showNote ? T.accent : T.b}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: showNote ? T.accent2 : T.tm, fontSize: 12, fontWeight: 600, fontFamily: F }}>💬 Nota</button>
          <button onClick={() => fileRef.current?.click()} style={{ background: photo ? T.accent + "20" : T.c2, border: `1px solid ${photo ? T.accent : T.b}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: photo ? T.accent2 : T.tm, fontSize: 12, fontWeight: 600, fontFamily: F }}>📷 {photo ? "Cambiar" : "Comprobante"}</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
        </div>
        {showNote && <Input label="NOTA" value={note} onChange={setNote} placeholder="Comentario..." />}
        {photo && (
          <div style={{ marginBottom: 14, position: "relative" }}>
            <img src={photo} alt="Comprobante" style={{ width: "100%", borderRadius: 10, maxHeight: 200, objectFit: "cover" }} />
            <button onClick={() => setPhoto(null)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        )}

        {/* Split presets */}
        <label style={{ color: T.ts, fontSize: 12, fontWeight: 700, fontFamily: F, display: "block", marginBottom: 8 }}>DIVIDIR ENTRE</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {SPLIT_PRESETS.map((p) => {
            const active = p.users.length === splitAmong.length && p.users.every((u) => splitAmong.includes(u));
            return <button key={p.id} onClick={() => { setSplitAmong(p.users); setSplitType("equal"); setCustomSplit({}); }} style={{ background: active ? T.accent + "25" : T.c2, border: `1px solid ${active ? T.accent : T.b}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: active ? T.accent2 : T.tm, fontSize: 11, fontWeight: 600, fontFamily: F }}>{p.label}</button>;
          })}
        </div>

        {/* User toggles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
          {USERS.map((u) => {
            const active = splitAmong.includes(u.id);
            return <button key={u.id} onClick={() => toggleUser(u.id)} style={{ background: active ? u.color + "25" : T.c2, border: `1.5px solid ${active ? u.color : T.b}`, borderRadius: 10, padding: "8px 4px", cursor: "pointer", opacity: active ? 1 : 0.5 }}>
              <span style={{ fontSize: 20, display: "block" }}>{u.emoji}</span>
              <span style={{ color: active ? T.w : T.tm, fontSize: 10, fontWeight: 600, fontFamily: F }}>{u.name}</span>
            </button>;
          })}
        </div>

        {/* Split type */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[{ id: "equal", label: "Iguales" }, { id: "custom", label: "Montos ($)" }, { id: "percent", label: "Porcentaje (%)" }].map((st) => (
            <button key={st.id} onClick={() => {
              setSplitType(st.id);
              if (st.id !== "equal") {
                const init = {}; splitAmong.forEach((u) => { init[u] = st.id === "percent" ? (100 / splitAmong.length).toFixed(1) : (amtNum / splitAmong.length).toFixed(2); });
                setCustomSplit(init);
              }
            }} style={{ flex: 1, background: splitType === st.id ? T.accent + "25" : T.c2, border: `1px solid ${splitType === st.id ? T.accent : T.b}`, borderRadius: 8, padding: "6px 4px", cursor: "pointer", color: splitType === st.id ? T.accent2 : T.tm, fontSize: 11, fontWeight: 600, fontFamily: F }}>{st.label}</button>
          ))}
        </div>

        {splitType !== "equal" && (
          <div style={{ marginBottom: 14 }}>
            {splitAmong.map((id) => {
              const u = USER_MAP[id];
              return <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{u.emoji}</span>
                <span style={{ color: T.ts, fontSize: 12, fontWeight: 600, fontFamily: F, width: 60 }}>{u.name}</span>
                <input type="number" inputMode="decimal" value={customSplit[id] || ""} onChange={(e) => setCustomSplit({ ...customSplit, [id]: e.target.value })}
                  style={{ flex: 1, background: T.c2, border: `1px solid ${T.b}`, borderRadius: 8, padding: "6px 10px", color: T.w, fontSize: 14, fontFamily: F, outline: "none", textAlign: "right" }} />
                <span style={{ color: T.tm, fontSize: 12, fontFamily: F }}>{splitType === "percent" ? "%" : "MXN"}</span>
              </div>;
            })}
            <p style={{ color: (() => { const total = Object.values(customSplit).reduce((s, v) => s + (parseFloat(v) || 0), 0); return Math.abs(total - (splitType === "percent" ? 100 : amtNum)) < 0.5 ? T.green : T.red; })(), fontSize: 11, fontFamily: F, textAlign: "right", marginTop: 4 }}>
              Total: {splitType === "percent" ? `${Object.values(customSplit).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(1)}% / 100%` : `${fmt(Object.values(customSplit).reduce((s, v) => s + (parseFloat(v) || 0), 0))} / ${fmt(amtNum)}`}
            </p>
          </div>
        )}

        {amtNum > 0 && splitType === "equal" && splitAmong.length > 0 && (
          <div style={{ background: T.c2, borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <p style={{ color: T.ts, fontSize: 12, fontFamily: F, marginBottom: 4 }}>Cada quien paga:</p>
            <p style={{ color: T.accent2, fontSize: 20, fontWeight: 800, fontFamily: F }}>{fmt(amtNum / splitAmong.length)}</p>
          </div>
        )}

        {formError && <div style={{ background: T.red + "15", border: `1px solid ${T.red}40`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}><p style={{ color: T.red, fontSize: 13, fontWeight: 600, fontFamily: F, margin: 0 }}>⚠️ {formError}</p></div>}

        <div style={{ display: "flex", gap: 10 }}>
          {onCancel && <Btn onClick={onCancel} color={T.b} style={{ flex: 1 }}>Cancelar</Btn>}
          <Btn onClick={handleSave} disabled={!amtNum || saving || splitAmong.length === 0} style={{ flex: 1 }}>{saving ? "Guardando..." : editExp ? "Actualizar" : "Guardar"}</Btn>
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// HOME DASHBOARD — month view with balances, recent expenses
// ============================================================================

const Home = ({ exps, me, month, setMonth, onEdit, onDelete, settlements, onGoSettle, toast }) => {
  const filtered = exps.filter((e) => e.month === month);
  const total = filtered.reduce((s, e) => s + parseFloat(e.amount), 0);
  const { balances, txns } = calcSettlements(filtered);
  const myBal = balances[me.id] || 0;
  const remaining = daysLeft(month);
  const isCurrentMonth = month === monthKey();
  const showReminder = remaining <= 7 && remaining > 0 && isCurrentMonth;
  const [expandedExp, setExpandedExp] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);

  // Calculate what I owe (pending debts not yet confirmed)
  const monthSettlements = (settlements || []).filter((s) => s.month === month);
  const myDebts = txns.filter((tx) => tx.from === me.id).map((tx) => {
    const s = monthSettlements.find((s) => s.from_user === tx.from && s.to_user === tx.to);
    return { ...tx, status: s?.status || "pending" };
  }).filter((tx) => tx.status !== "confirmed");

  // Pending confirmations I need to give (someone paid me)
  const myPendingConfirms = txns.filter((tx) => tx.to === me.id).map((tx) => {
    const s = monthSettlements.find((s) => s.from_user === tx.from && s.to_user === tx.to);
    return { ...tx, status: s?.status || "pending" };
  }).filter((tx) => tx.status === "paid");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ background: "none", border: "none", color: T.tm, fontSize: 20, cursor: "pointer" }}>‹</button>
        <h2 style={{ color: T.w, fontSize: 18, fontWeight: 800, fontFamily: F, margin: 0, minWidth: 160, textAlign: "center" }}>{monthLabel(month)}</h2>
        <button onClick={() => setMonth(nextMonth(month))} style={{ background: "none", border: "none", color: T.tm, fontSize: 20, cursor: "pointer" }}>›</button>
      </div>

      {/* Smart reminder: last 7 days with specific debt info */}
      {showReminder && (
        <div style={{ background: `linear-gradient(135deg, ${T.yellow}20, ${T.accent}20)`, border: `1px solid ${T.yellow}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
          <p style={{ color: T.yellow, fontSize: 13, fontWeight: 700, fontFamily: F, margin: 0 }}>
            {remaining <= 3 ? "⏰ Últimos días del mes" : `📝 ${remaining} días restantes`}
            {" — registra tus gastos y liquida"}
          </p>
          {myDebts.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {myDebts.map((d, i) => (
                <p key={i} style={{ color: d.status === "pending" ? T.red : T.yellow, fontSize: 12, fontFamily: F, margin: "3px 0 0" }}>
                  {d.status === "pending" ? "💰" : "⏳"} Debés {fmt(d.amount)} a {USER_MAP[d.to]?.emoji} {USER_MAP[d.to]?.name}
                  {d.status === "paid" && " (esperando confirmación)"}
                </p>
              ))}
            </div>
          )}
          {myPendingConfirms.length > 0 && (
            <div style={{ marginTop: myDebts.length > 0 ? 4 : 8 }}>
              {myPendingConfirms.map((d, i) => (
                <p key={i} style={{ color: T.blue, fontSize: 12, fontFamily: F, margin: "3px 0 0" }}>
                  📩 {USER_MAP[d.from]?.emoji} {USER_MAP[d.from]?.name} te pagó {fmt(d.amount)} — confirma recibido
                </p>
              ))}
            </div>
          )}
          {(myDebts.length > 0 || myPendingConfirms.length > 0) && (
            <button onClick={onGoSettle} style={{ background: T.accent + "30", border: `1px solid ${T.accent}60`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: T.accent2, fontSize: 12, fontWeight: 700, fontFamily: F, marginTop: 10, width: "100%" }}>
              💸 Ir a liquidar
            </button>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card style={{ textAlign: "center" }}>
          <p style={{ color: T.tm, fontSize: 11, fontWeight: 700, fontFamily: F, marginBottom: 4 }}>TOTAL MES</p>
          <p style={{ color: T.w, fontSize: 22, fontWeight: 900, fontFamily: F, margin: 0 }}>{fmt(total)}</p>
        </Card>
        <Card style={{ textAlign: "center" }}>
          <p style={{ color: T.tm, fontSize: 11, fontWeight: 700, fontFamily: F, marginBottom: 4 }}>TU BALANCE</p>
          <p style={{ color: myBal >= 0 ? T.green : T.red, fontSize: 22, fontWeight: 900, fontFamily: F, margin: 0 }}>{myBal >= 0 ? "+" : "-"}{fmt(myBal)}</p>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h4 style={{ color: T.w, fontSize: 14, fontWeight: 800, fontFamily: F, marginBottom: 12 }}>👥 Resumen</h4>
        {USERS.map((u) => {
          const paid = filtered.filter((e) => e.paid_by === u.id).reduce((s, e) => s + parseFloat(e.amount), 0);
          const bal = balances[u.id] || 0;
          return <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.b}20` }}>
            <span style={{ fontSize: 20 }}>{u.emoji}</span>
            <div style={{ flex: 1 }}>
              <span style={{ color: T.w, fontSize: 13, fontWeight: 700, fontFamily: F }}>{u.name}</span>
              <span style={{ color: T.tm, fontSize: 11, fontFamily: F, marginLeft: 8 }}>pagó {fmt(paid)}</span>
            </div>
            <span style={{ color: bal >= 0 ? T.green : T.red, fontSize: 13, fontWeight: 800, fontFamily: F }}>{bal >= 0 ? "+" : "-"}{fmt(bal)}</span>
          </div>;
        })}
      </Card>

      <Card>
        <h4 style={{ color: T.w, fontSize: 14, fontWeight: 800, fontFamily: F, marginBottom: 12 }}>Gastos ({filtered.length})</h4>
        {filtered.length === 0 ? <EmptyState icon="🌿" title="Sin gastos este mes" subtitle="Agrega el primero con +" /> :
          [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((e) => {
            const user = USER_MAP[e.paid_by];
            const cat = CAT_MAP[e.category] || { icon: "📦", label: e.category };
            const isExpanded = expandedExp === e.id;
            const canEdit = e.paid_by === me.id;
            return <div key={e.id}>
              <div onClick={() => setExpandedExp(isExpanded ? null : e.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.b}20`, cursor: "pointer" }}>
                <span style={{ fontSize: 22 }}>{cat.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: T.w, fontSize: 13, fontWeight: 700, fontFamily: F }}>{e.description || cat.label}</span>
                    {e.photo && <span style={{ fontSize: 10 }}>📷</span>}
                    {e.note && <span style={{ fontSize: 10 }}>💬</span>}
                    {e.is_recurring && <span style={{ fontSize: 10 }}>🔄</span>}
                  </div>
                  <div style={{ color: T.tm, fontSize: 11, fontFamily: F }}>
                    {user?.emoji} {user?.name} · {new Date(e.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    {e.split_among.length < USERS.length && ` · ÷${e.split_among.length}`}
                  </div>
                </div>
                <span style={{ color: T.w, fontSize: 15, fontWeight: 800, fontFamily: F }}>{fmt(e.amount)}</span>
              </div>
              {isExpanded && (
                <div style={{ animation: "fadeIn 0.2s ease" }}>
                  {e.note && <p style={{ color: T.ts, fontSize: 12, fontFamily: F, padding: "6px 0 2px", margin: 0 }}>💬 {e.note}</p>}
                  {e.photo && (
                    <button onClick={() => setPhotoModal(e.photo)} style={{ background: T.blue + "20", border: `1px solid ${T.blue}40`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: T.blue, fontSize: 11, fontFamily: F, marginTop: 6 }}>
                      📷 Ver comprobante
                    </button>
                  )}
                  {canEdit ? (
                    <div style={{ display: "flex", gap: 8, padding: "8px 0 4px" }}>
                      <Btn small onClick={() => onEdit(e)} color={T.c2}>✏️ Editar</Btn>
                      <Btn small onClick={() => setConfirmDelete(e)} color={T.red + "30"} style={{ color: T.red }}>🗑 Eliminar</Btn>
                    </div>
                  ) : (
                    <p style={{ color: T.tm, fontSize: 11, fontFamily: F, padding: "6px 0" }}>Solo {user?.name} puede editar este gasto</p>
                  )}
                </div>
              )}
            </div>;
          })}
      </Card>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="¿Eliminar gasto?">
        {confirmDelete && <>
          <div style={{ background: T.c2, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ color: T.w, fontSize: 14, fontWeight: 700, fontFamily: F, margin: "0 0 4px" }}>
              {CAT_MAP[confirmDelete.category]?.icon} {confirmDelete.description || CAT_MAP[confirmDelete.category]?.label}
            </p>
            <p style={{ color: T.accent2, fontSize: 18, fontWeight: 800, fontFamily: F, margin: 0 }}>{fmt(confirmDelete.amount)}</p>
            <p style={{ color: T.tm, fontSize: 11, fontFamily: F, margin: "4px 0 0" }}>
              {new Date(confirmDelete.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setConfirmDelete(null)} color={T.b} style={{ flex: 1 }}>Cancelar</Btn>
            <Btn onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }} color={T.red} style={{ flex: 1 }}>Eliminar</Btn>
          </div>
        </>}
      </Modal>

      <Modal open={!!photoModal} onClose={() => setPhotoModal(null)} title="📷 Comprobante">
        {photoModal && <img src={photoModal} alt="Comprobante" style={{ width: "100%", borderRadius: 12, maxHeight: "60vh", objectFit: "contain" }} />}
      </Modal>
    </div>
  );
};

// ============================================================================
// RECURRING — with pause per month
// ============================================================================

const RecurringView = ({ recs, me, refresh, toast }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingRec, setEditingRec] = useState(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("hipoteca");
  const [desc, setDesc] = useState("");
  const [splitAmong, setSplitAmong] = useState(USERS.map((u) => u.id));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const resetForm = () => {
    setAmount(""); setCategory("hipoteca"); setDesc(""); setSplitAmong(USERS.map((u) => u.id));
    setEditingRec(null); setShowForm(false);
  };

  const openEdit = (rec) => {
    setEditingRec(rec);
    setAmount(String(rec.amount));
    setCategory(rec.category);
    setDesc(rec.description || "");
    setSplitAmong(rec.split_among || USERS.map((u) => u.id));
    setShowForm(true);
  };

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      if (editingRec) {
        const { error } = await supabase.from("recurring").update({
          amount: amt, category, description: desc.trim(),
          split_among: splitAmong, updated_at: new Date().toISOString(),
        }).eq("id", editingRec.id);
        if (error) throw error;
        toast?.("Recurrente actualizado ✓", "success");
      } else {
        const { error } = await supabase.from("recurring").insert({
          id: uid(), amount: amt, category, description: desc.trim(),
          paid_by: me.id, split_among: splitAmong, split_type: "equal",
          active: true, paused_months: [],
        });
        if (error) throw error;
        toast?.("Recurrente creado ✓", "success");
      }
      resetForm();
      refresh();
    } catch (err) { console.error("Recurring save error:", err); toast?.("Error al guardar recurrente", "error"); }
    setSaving(false);
  };

  const toggleActive = async (id, current) => {
    try {
      const { error } = await supabase.from("recurring").update({ active: !current }).eq("id", id);
      if (error) throw error;
      toast?.(!current ? "Recurrente activado" : "Recurrente desactivado", "success");
      refresh();
    } catch (err) { console.error(err); toast?.("Error de conexión", "error"); }
  };

  const togglePauseMonth = async (rec) => {
    try {
      const mk = monthKey();
      const paused = rec.paused_months || [];
      const newPaused = paused.includes(mk) ? paused.filter((m) => m !== mk) : [...paused, mk];
      const { error } = await supabase.from("recurring").update({ paused_months: newPaused }).eq("id", rec.id);
      if (error) throw error;
      toast?.(newPaused.includes(mk) ? `Pausado para ${monthLabel(mk)}` : `Reactivado para ${monthLabel(mk)}`, "success");
      refresh();
    } catch (err) { console.error(err); toast?.("Error de conexión", "error"); }
  };

  const deleteRec = async (id) => {
    try {
      const { error } = await supabase.from("recurring").delete().eq("id", id);
      if (error) throw error;
      toast?.("Recurrente eliminado", "success");
      setConfirmDelete(null);
      refresh();
    } catch (err) { console.error(err); toast?.("Error al eliminar", "error"); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ color: T.w, fontSize: 18, fontWeight: 800, fontFamily: F }}>🔄 Recurrentes</h3>
        <Btn small onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>{showForm ? "Cancelar" : "+ Nuevo"}</Btn>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 16 }}>
          <h4 style={{ color: T.w, fontSize: 15, fontWeight: 800, fontFamily: F, marginBottom: 14 }}>
            {editingRec ? "✏️ Editar recurrente" : "➕ Nuevo recurrente"}
          </h4>
          <Input label="MONTO MENSUAL" type="number" value={amount} onChange={setAmount} placeholder="0.00" inputMode="decimal" />
          <label style={{ color: T.ts, fontSize: 12, fontWeight: 700, fontFamily: F, display: "block", marginBottom: 8 }}>CATEGORÍA</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                background: category === c.id ? T.accent + "30" : T.c2, border: `1.5px solid ${category === c.id ? T.accent : T.b}`,
                borderRadius: 10, padding: "8px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <span style={{ color: category === c.id ? T.w : T.tm, fontSize: 9, fontWeight: 600, fontFamily: F }}>{c.label}</span>
              </button>
            ))}
          </div>
          <Input label="DESCRIPCIÓN" value={desc} onChange={setDesc} placeholder="Ej: Mensualidad hipoteca" />
          <label style={{ color: T.ts, fontSize: 12, fontWeight: 700, fontFamily: F, display: "block", marginBottom: 8 }}>DIVIDIR ENTRE</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
            {USERS.map((u) => {
              const active = splitAmong.includes(u.id);
              return <button key={u.id} onClick={() => setSplitAmong((prev) => prev.includes(u.id) ? (prev.length <= 1 ? prev : prev.filter((x) => x !== u.id)) : [...prev, u.id])}
                style={{ background: active ? u.color + "25" : T.c2, border: `1.5px solid ${active ? u.color : T.b}`, borderRadius: 10, padding: "6px 4px", cursor: "pointer", opacity: active ? 1 : 0.5 }}>
                <span style={{ fontSize: 16, display: "block" }}>{u.emoji}</span>
                <span style={{ color: active ? T.w : T.tm, fontSize: 9, fontWeight: 600, fontFamily: F }}>{u.name}</span>
              </button>;
            })}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {editingRec && <Btn onClick={resetForm} color={T.b} style={{ flex: 1 }}>Cancelar</Btn>}
            <Btn onClick={handleSave} disabled={!parseFloat(amount) || saving} style={{ flex: 1 }}>
              {saving ? "Guardando..." : editingRec ? "Actualizar" : "Guardar"}
            </Btn>
          </div>
        </Card>
      )}

      {recs.length === 0 && !showForm ? <EmptyState icon="🔄" title="Sin recurrentes" subtitle="Agrega pagos mensuales fijos" /> :
        recs.map((r) => {
          const cat = CAT_MAP[r.category];
          const user = USER_MAP[r.paid_by];
          const isPausedThisMonth = (r.paused_months || []).includes(monthKey());
          const isOwner = r.paid_by === me.id;
          return <Card key={r.id} style={{ marginBottom: 10, opacity: r.active && !isPausedThisMonth ? 1 : 0.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>{cat?.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: T.w, fontSize: 14, fontWeight: 700, fontFamily: F, margin: 0 }}>{r.description || cat?.label}</p>
                <p style={{ color: T.tm, fontSize: 11, fontFamily: F, margin: 0 }}>{user?.emoji} {user?.name} · ÷{r.split_among?.length || USERS.length}
                  {isPausedThisMonth && <span style={{ color: T.yellow }}> · Pausado este mes</span>}
                  {!r.active && <span style={{ color: T.red }}> · Inactivo</span>}
                </p>
              </div>
              <span style={{ color: T.w, fontSize: 16, fontWeight: 800, fontFamily: F }}>{fmt(r.amount)}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => toggleActive(r.id, r.active)} style={{ background: "none", border: `1px solid ${T.b}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: T.tm, fontSize: 11, fontFamily: F }}>{r.active ? "⏸ Desactivar" : "▶️ Activar"}</button>
              {r.active && <button onClick={() => togglePauseMonth(r)} style={{ background: "none", border: `1px solid ${T.yellow}40`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: T.yellow, fontSize: 11, fontFamily: F }}>{isPausedThisMonth ? "▶️ Reanudar mes" : "⏭ Saltar mes"}</button>}
              {isOwner && <button onClick={() => openEdit(r)} style={{ background: "none", border: `1px solid ${T.blue}40`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: T.blue, fontSize: 11, fontFamily: F }}>✏️ Editar</button>}
              {isOwner && <button onClick={() => setConfirmDelete(r)} style={{ background: "none", border: `1px solid ${T.red}40`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: T.red, fontSize: 11, fontFamily: F }}>🗑</button>}
            </div>
          </Card>;
        })}

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="¿Eliminar recurrente?">
        {confirmDelete && <>
          <div style={{ background: T.c2, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ color: T.w, fontSize: 14, fontWeight: 700, fontFamily: F, margin: "0 0 4px" }}>
              {CAT_MAP[confirmDelete.category]?.icon} {confirmDelete.description || CAT_MAP[confirmDelete.category]?.label}
            </p>
            <p style={{ color: T.accent2, fontSize: 18, fontWeight: 800, fontFamily: F, margin: 0 }}>{fmt(confirmDelete.amount)} / mes</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setConfirmDelete(null)} color={T.b} style={{ flex: 1 }}>Cancelar</Btn>
            <Btn onClick={() => deleteRec(confirmDelete.id)} color={T.red} style={{ flex: 1 }}>Eliminar</Btn>
          </div>
        </>}
      </Modal>
    </div>
  );
};

// ============================================================================
// SETTLEMENTS — with payment proof & status management
// ============================================================================

const SettleView = ({ allExps, bank, month, setMonth, settlements, me, refresh, toast }) => {
  const filtered = allExps.filter((e) => e.month === month);
  const { balances, txns } = calcSettlements(filtered);
  const monthSettlements = settlements.filter((s) => s.month === month);
  const fileRef = useRef(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [proofModal, setProofModal] = useState(null);

  // Net balances: only confirmed payments compensate the balance
  const netBalances = { ...balances };
  monthSettlements.forEach((s) => {
    if (s.status === "confirmed") {
      const amt = parseFloat(s.amount);
      // from_user paid their debt → balance goes toward 0
      netBalances[s.from_user] = (netBalances[s.from_user] || 0) + amt;
      // to_user received payment → balance goes toward 0
      netBalances[s.to_user] = (netBalances[s.to_user] || 0) - amt;
    }
  });

  const allSettled = txns.length > 0 && txns.every((tx) => {
    const s = monthSettlements.find((s) => s.from_user === tx.from && s.to_user === tx.to);
    return s?.status === "confirmed";
  });

  const handleMarkPaid = async (tx) => {
    try {
      const existing = monthSettlements.find((s) => s.from_user === tx.from && s.to_user === tx.to);
      if (existing) {
        const { error } = await supabase.from("settlements").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("settlements").insert({ id: uid(), from_user: tx.from, to_user: tx.to, amount: tx.amount, settle_month: month, status: "paid", paid_at: new Date().toISOString() });
        if (error) throw error;
      }
      toast?.("Marcado como pagado ✓", "success");
      refresh();
    } catch (err) { console.error(err); toast?.("Error al marcar pago", "error"); }
  };

  const handleConfirm = async (settlementId) => {
    try {
      const { error } = await supabase.from("settlements").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", settlementId);
      if (error) throw error;
      toast?.("Pago confirmado ✓", "success");
      refresh();
    } catch (err) { console.error(err); toast?.("Error al confirmar", "error"); }
  };

  const handleProof = async (e, tx) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const existing = monthSettlements.find((s) => s.from_user === tx.from && s.to_user === tx.to);
        if (existing) {
          const { error } = await supabase.from("settlements").update({ proof_photo: ev.target.result, status: "paid", paid_at: new Date().toISOString() }).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("settlements").insert({ id: uid(), from_user: tx.from, to_user: tx.to, amount: tx.amount, settle_month: month, status: "paid", paid_at: new Date().toISOString(), proof_photo: ev.target.result });
          if (error) throw error;
        }
        toast?.("Comprobante subido ✓", "success");
        setUploadingFor(null);
        refresh();
      } catch (err) { console.error(err); toast?.("Error al subir comprobante", "error"); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ background: "none", border: "none", color: T.tm, fontSize: 20, cursor: "pointer" }}>‹</button>
        <h3 style={{ color: T.w, fontSize: 18, fontWeight: 800, fontFamily: F, margin: 0 }}>💸 Liquidar · {monthLabel(month)}</h3>
        <button onClick={() => setMonth(nextMonth(month))} style={{ background: "none", border: "none", color: T.tm, fontSize: 20, cursor: "pointer" }}>›</button>
      </div>

      {allSettled && (
        <div style={{ background: `linear-gradient(135deg, ${T.green}20, ${T.green}10)`, border: `1px solid ${T.green}40`, borderRadius: 12, padding: "14px 16px", marginBottom: 12, textAlign: "center" }}>
          <p style={{ color: T.green, fontSize: 15, fontWeight: 800, fontFamily: F, margin: 0 }}>✅ Mes completamente liquidado</p>
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <h4 style={{ color: T.w, fontSize: 14, fontWeight: 800, fontFamily: F, marginBottom: 12 }}>Balances {allSettled ? "(liquidado)" : "(pendiente)"}</h4>
        {USERS.map((u) => {
          const bal = balances[u.id] || 0;
          const net = Math.round((netBalances[u.id] || 0) * 100) / 100;
          const hasPayments = Math.abs(net - bal) > 0.01;
          return <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.b}20` }}>
            <span style={{ fontSize: 20 }}>{u.emoji}</span>
            <span style={{ color: T.w, fontSize: 13, fontWeight: 700, fontFamily: F, flex: 1 }}>{u.name}</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: Math.abs(net) < 0.01 ? T.green : net >= 0 ? T.green : T.red, fontSize: 14, fontWeight: 800, fontFamily: F }}>
                {Math.abs(net) < 0.01 ? "$0.00" : `${net >= 0 ? "+" : "-"}${fmt(net)}`}
              </span>
              {hasPayments && <p style={{ color: T.tm, fontSize: 9, fontFamily: F, margin: 0 }}>gastos: {bal >= 0 ? "+" : "-"}{fmt(bal)}</p>}
            </div>
          </div>;
        })}
      </Card>

      <Card>
        <h4 style={{ color: T.w, fontSize: 14, fontWeight: 800, fontFamily: F, marginBottom: 12 }}>
          {txns.length > 0 ? `Transferencias (${txns.length})` : "✅ Todo cuadrado"}
        </h4>
        {txns.map((tx, i) => {
          const from = USER_MAP[tx.from];
          const to = USER_MAP[tx.to];
          const toBank = bank.find((b) => b.user_id === tx.to);
          const settlement = monthSettlements.find((s) => s.from_user === tx.from && s.to_user === tx.to);
          const status = settlement?.status || "pending";
          const statusColor = status === "confirmed" ? T.green : status === "paid" ? T.yellow : T.tm;
          const statusLabel = status === "confirmed" ? "✅ Confirmado" : status === "paid" ? "⏳ Pagado" : "Pendiente";

          return <div key={i} style={{ background: T.c2, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${T.b}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{from?.emoji}</span>
              <span style={{ color: T.w, fontSize: 13, fontWeight: 700, fontFamily: F }}>{from?.name}</span>
              <span style={{ color: T.tm, fontSize: 16 }}>→</span>
              <span style={{ fontSize: 20 }}>{to?.emoji}</span>
              <span style={{ color: T.w, fontSize: 13, fontWeight: 700, fontFamily: F }}>{to?.name}</span>
              <span style={{ color: T.accent2, fontSize: 16, fontWeight: 900, fontFamily: F, marginLeft: "auto" }}>{fmt(tx.amount)}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: statusColor, fontSize: 11, fontWeight: 700, fontFamily: F }}>{statusLabel}</span>
            </div>

            {toBank && (
              <div style={{ background: T.c, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                <p style={{ color: T.tm, fontSize: 10, fontFamily: F, margin: "0 0 2px" }}>CLABE de {to?.name} ({toBank.bank_name}):</p>
                <p onClick={() => { navigator.clipboard?.writeText(toBank.clabe); toast?.("CLABE copiada 📋", "success"); }}
                  style={{ color: T.w, fontSize: 13, fontWeight: 700, fontFamily: F, margin: 0, cursor: "pointer", letterSpacing: "0.5px" }}>{toBank.clabe} 📋</p>
              </div>
            )}

            {/* Actions based on who I am in this tx */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {tx.from === me.id && status === "pending" && (
                <>
                  <button onClick={() => handleMarkPaid(tx)} style={{ background: T.green + "20", border: `1px solid ${T.green}40`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: T.green, fontSize: 11, fontFamily: F }}>✓ Ya pagué</button>
                  <button onClick={() => setUploadingFor(i)} style={{ background: T.blue + "20", border: `1px solid ${T.blue}40`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: T.blue, fontSize: 11, fontFamily: F }}>📷 Subir comprobante</button>
                </>
              )}
              {tx.to === me.id && status === "paid" && (
                <button onClick={() => handleConfirm(settlement?.id)} style={{ background: T.green + "20", border: `1px solid ${T.green}40`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: T.green, fontSize: 11, fontFamily: F }}>✅ Confirmar recibido</button>
              )}
              {settlement?.proof_photo && (
                <button onClick={() => setProofModal(settlement.proof_photo)} style={{ background: T.c, border: `1px solid ${T.b}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: T.tm, fontSize: 11, fontFamily: F }}>👁 Ver comprobante</button>
              )}
            </div>
            {uploadingFor === i && <input type="file" accept="image/*" capture="environment" onChange={(e) => handleProof(e, tx)} style={{ marginTop: 8 }} />}
          </div>;
        })}
      </Card>

      <Modal open={!!proofModal} onClose={() => setProofModal(null)} title="Comprobante de pago">
        {proofModal && (
          <img src={proofModal} alt="Comprobante" style={{ width: "100%", borderRadius: 12, maxHeight: "60vh", objectFit: "contain" }} />
        )}
      </Modal>
    </div>
  );
};

// ============================================================================
// DASHBOARD — Rolling 12m stacked bars + KPIs
// ============================================================================

const AnalyticsDashboard = ({ allExps, month, toast }) => {
  const [viewMode, setViewMode] = useState("category");
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [showLegend, setShowLegend] = useState(false);

  const months = getLast12Months().reverse();
  const grandTotal = allExps.reduce((s, e) => s + parseFloat(e.amount), 0);
  const avgMonthly = grandTotal / 12;

  // Current month vs previous
  const curMonthTotal = allExps.filter((e) => e.month === monthKey()).reduce((s, e) => s + parseFloat(e.amount), 0);
  const prevMonthTotal = allExps.filter((e) => e.month === prevMonth(monthKey())).reduce((s, e) => s + parseFloat(e.amount), 0);
  const monthDiff = prevMonthTotal > 0 ? ((curMonthTotal - prevMonthTotal) / prevMonthTotal * 100) : 0;

  // Per-person average
  const perPersonAvg = avgMonthly / USERS.length;

  const buildData = () => {
    if (viewMode === "category") {
      const allCats = new Set();
      const monthData = months.map((mk) => {
        const mExps = allExps.filter((e) => e.month === mk);
        const byCat = {};
        mExps.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + parseFloat(e.amount); allCats.add(e.category); });
        return { month: mk, segments: byCat, total: mExps.reduce((s, e) => s + parseFloat(e.amount), 0) };
      });
      const keys = [...allCats].sort((a, b) => {
        const tA = allExps.filter((e) => e.category === a).reduce((s, e) => s + parseFloat(e.amount), 0);
        const tB = allExps.filter((e) => e.category === b).reduce((s, e) => s + parseFloat(e.amount), 0);
        return tB - tA;
      });
      const colorMap = {}; keys.forEach((k, i) => { colorMap[k] = PALETTE[i % PALETTE.length]; });
      const labelMap = {}; keys.forEach((k) => { const c = CAT_MAP[k]; labelMap[k] = c ? `${c.icon} ${c.label}` : k; });
      return { monthData, keys, colorMap, labelMap };
    } else {
      const monthData = months.map((mk) => {
        const mExps = allExps.filter((e) => e.month === mk);
        const byPayer = {};
        mExps.forEach((e) => { byPayer[e.paid_by] = (byPayer[e.paid_by] || 0) + parseFloat(e.amount); });
        return { month: mk, segments: byPayer, total: mExps.reduce((s, e) => s + parseFloat(e.amount), 0) };
      });
      const keys = USERS.map((u) => u.id);
      const colorMap = {}; USERS.forEach((u) => { colorMap[u.id] = u.color; });
      const labelMap = {}; USERS.forEach((u) => { labelMap[u.id] = `${u.emoji} ${u.name}`; });
      return { monthData, keys, colorMap, labelMap };
    }
  };

  const { monthData, keys, colorMap, labelMap } = buildData();
  const maxTotal = Math.max(...monthData.map((d) => d.total), 1);
  const breakdownTotals = {}; keys.forEach((k) => { breakdownTotals[k] = monthData.reduce((s, d) => s + (d.segments[k] || 0), 0); });
  const activeKeys = keys.filter((k) => breakdownTotals[k] > 0);

  // Top 5 for budgets
  const top5 = activeKeys.slice(0, 5);
  const restTotal = activeKeys.slice(5).reduce((s, k) => s + breakdownTotals[k], 0);
  const top5Pct = grandTotal > 0 ? (top5.reduce((s, k) => s + breakdownTotals[k], 0) / grandTotal * 100).toFixed(0) : 0;

  return (
    <div>
      <h3 style={{ color: T.w, fontSize: 18, fontWeight: 800, fontFamily: F, marginBottom: 16 }}>📊 Dashboard</h3>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <Card style={{ textAlign: "center", padding: 12 }}>
          <p style={{ color: T.tm, fontSize: 9, fontWeight: 700, fontFamily: F, marginBottom: 2 }}>12 MESES</p>
          <p style={{ color: T.w, fontSize: 16, fontWeight: 900, fontFamily: F, margin: 0 }}>{fmt(grandTotal)}</p>
        </Card>
        <Card style={{ textAlign: "center", padding: 12 }}>
          <p style={{ color: T.tm, fontSize: 9, fontWeight: 700, fontFamily: F, marginBottom: 2 }}>PROM / MES</p>
          <p style={{ color: T.accent2, fontSize: 16, fontWeight: 900, fontFamily: F, margin: 0 }}>{fmt(avgMonthly)}</p>
        </Card>
        <Card style={{ textAlign: "center", padding: 12 }}>
          <p style={{ color: T.tm, fontSize: 9, fontWeight: 700, fontFamily: F, marginBottom: 2 }}>VS MES ANT</p>
          <p style={{ color: monthDiff > 0 ? T.red : T.green, fontSize: 16, fontWeight: 900, fontFamily: F, margin: 0 }}>{monthDiff > 0 ? "+" : ""}{monthDiff.toFixed(0)}%</p>
        </Card>
      </div>

      {/* Projection */}
      {curMonthTotal > 0 && month === monthKey() && (() => {
        const daysPassed = new Date().getDate();
        const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const projected = (curMonthTotal / daysPassed) * totalDays;
        return (
          <div style={{ background: T.c2, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: T.tm, fontSize: 12, fontFamily: F }}>📈 Proyección cierre de mes:</span>
            <span style={{ color: projected > avgMonthly * 1.1 ? T.red : T.w, fontSize: 14, fontWeight: 800, fontFamily: F }}>{fmt(projected)}</span>
          </div>
        );
      })()}

      {/* View toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[{ id: "category", label: "Por categoría" }, { id: "payer", label: "Por pagador" }].map((v) => (
          <button key={v.id} onClick={() => setViewMode(v.id)} style={{ flex: 1, background: viewMode === v.id ? T.accent + "25" : T.c2, border: `1px solid ${viewMode === v.id ? T.accent : T.b}`, borderRadius: 10, padding: "10px 8px", cursor: "pointer", color: viewMode === v.id ? T.accent2 : T.tm, fontSize: 13, fontWeight: 700, fontFamily: F }}>{v.label}</button>
        ))}
      </div>

      {/* Stacked bar chart */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 200, position: "relative" }}>
          {monthData.map((d, i) => {
            const barH = d.total > 0 ? Math.max((d.total / maxTotal) * 100, 2) : 0;
            const isHovered = hoveredMonth === i;
            const shortAmt = d.total >= 1000 ? `${(d.total / 1000).toFixed(0)}k` : d.total > 0 ? Math.round(d.total) : "";
            return <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: 0 }}
              onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)} onClick={() => setHoveredMonth(isHovered ? null : i)}>
              {d.total > 0 && <span style={{ color: isHovered ? T.w : T.tm, fontSize: 7, fontFamily: F, fontWeight: isHovered ? 800 : 600, marginBottom: 2, whiteSpace: "nowrap" }}>{isHovered ? fmt(d.total) : shortAmt}</span>}
              <div style={{ width: "100%", borderRadius: "4px 4px 0 0", overflow: "hidden", height: `${barH}%`, minHeight: d.total > 0 ? 4 : 0, display: "flex", flexDirection: "column-reverse", transition: "all 0.3s", opacity: hoveredMonth !== null && !isHovered ? 0.4 : 1, transform: isHovered ? "scaleX(1.15)" : "scaleX(1)" }}>
                {activeKeys.map((k) => { const val = d.segments[k] || 0; if (!val) return null; return <div key={k} style={{ width: "100%", height: `${(val / d.total) * 100}%`, background: colorMap[k], minHeight: 1 }} />; })}
              </div>
              <span style={{ color: isHovered ? T.w : T.tm, fontSize: 8, fontWeight: isHovered ? 700 : 500, fontFamily: F, marginTop: 4 }}>{monthLabel(d.month).split(" ")[0].slice(0, 3)}</span>
            </div>;
          })}
        </div>

        {hoveredMonth !== null && monthData[hoveredMonth] && (
          <div style={{ background: T.c2, borderRadius: 10, padding: 12, marginTop: 12, border: `1px solid ${T.b}`, animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: T.w, fontSize: 14, fontWeight: 800, fontFamily: F }}>{monthLabel(monthData[hoveredMonth].month)}</span>
              <span style={{ color: T.accent2, fontSize: 14, fontWeight: 800, fontFamily: F }}>{fmt(monthData[hoveredMonth].total)}</span>
            </div>
            {activeKeys.filter((k) => (monthData[hoveredMonth].segments[k] || 0) > 0).sort((a, b) => (monthData[hoveredMonth].segments[b] || 0) - (monthData[hoveredMonth].segments[a] || 0)).map((k) => {
              const val = monthData[hoveredMonth].segments[k] || 0;
              return <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: colorMap[k] }} />
                <span style={{ color: T.ts, fontSize: 11, fontFamily: F, flex: 1 }}>{labelMap[k]}</span>
                <span style={{ color: T.w, fontSize: 11, fontWeight: 700, fontFamily: F }}>{fmt(val)}</span>
              </div>;
            })}
          </div>
        )}

        <button onClick={() => setShowLegend(!showLegend)} style={{ background: "none", border: `1px solid ${T.b}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: T.tm, fontSize: 11, fontFamily: F, width: "100%", marginTop: 12 }}>
          {showLegend ? "▲ Ocultar" : `▼ Top 5 categorías (${top5Pct}% del gasto)`}
        </button>

        {showLegend && <div style={{ marginTop: 12 }}>
          {top5.map((k) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${T.b}20` }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: colorMap[k] }} />
            <span style={{ color: T.ts, fontSize: 12, fontFamily: F, flex: 1 }}>{labelMap[k]}</span>
            <span style={{ color: T.w, fontSize: 12, fontWeight: 700, fontFamily: F }}>{fmt(breakdownTotals[k])}</span>
            <span style={{ color: T.tm, fontSize: 11, fontFamily: F, width: 40, textAlign: "right" }}>{(breakdownTotals[k] / grandTotal * 100).toFixed(1)}%</span>
          </div>)}
          {restTotal > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <span style={{ color: T.tm, fontSize: 12, fontFamily: F }}>📦 Resto ({activeKeys.length - 5})</span>
            <span style={{ color: T.tm, fontSize: 12, fontWeight: 700, fontFamily: F, marginLeft: "auto" }}>{fmt(restTotal)}</span>
          </div>}
        </div>}
      </Card>

      {/* Per-person KPI breakdown */}
      <Card style={{ marginBottom: 16 }}>
        <h4 style={{ color: T.w, fontSize: 14, fontWeight: 800, fontFamily: F, marginBottom: 12 }}>👤 Pago por persona (12 meses)</h4>
        {USERS.map((u) => {
          const userTotal = allExps.filter((e) => e.paid_by === u.id).reduce((s, e) => s + parseFloat(e.amount), 0);
          const userAvg = userTotal / 12;
          const pct = grandTotal > 0 ? (userTotal / grandTotal * 100) : 0;
          return <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.b}20` }}>
            <span style={{ fontSize: 18 }}>{u.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: T.w, fontSize: 12, fontWeight: 700, fontFamily: F }}>{u.name}</span>
                <span style={{ color: T.w, fontSize: 12, fontWeight: 700, fontFamily: F }}>{fmt(userTotal)}</span>
              </div>
              <div style={{ height: 4, background: T.c2, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: u.color, borderRadius: 2 }} />
              </div>
              <span style={{ color: T.tm, fontSize: 10, fontFamily: F }}>{fmt(userAvg)}/mes · {pct.toFixed(0)}%</span>
            </div>
          </div>;
        })}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "8px 0" }}>
          <span style={{ color: T.tm, fontSize: 11, fontWeight: 700, fontFamily: F }}>Promedio por persona / mes</span>
          <span style={{ color: T.accent2, fontSize: 14, fontWeight: 900, fontFamily: F }}>{fmt(perPersonAvg)}</span>
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// HISTORY — with filters, search, Excel export
// ============================================================================

const HistoryView = ({ allExps, me, onEdit, onDelete, toast }) => {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = allExps.filter((e) => {
    if (search) {
      const s = search.toLowerCase();
      const match = (e.description?.toLowerCase().includes(s)) || (CAT_MAP[e.category]?.label.toLowerCase().includes(s)) || (USER_MAP[e.paid_by]?.name.toLowerCase().includes(s)) || String(e.amount).includes(s);
      if (!match) return false;
    }
    if (filterCat && e.category !== filterCat) return false;
    if (filterUser && e.paid_by !== filterUser) return false;
    if (filterMonth && e.month !== filterMonth) return false;
    return true;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const exportCSV = () => {
    const BOM = "\uFEFF";
    const header = "Fecha,Mes,Categoría,Descripción,Monto,Pagó,Dividido entre\n";
    const rows = filtered.map((e) => {
      const cat = CAT_MAP[e.category]?.label || e.category;
      const user = USER_MAP[e.paid_by]?.name || e.paid_by;
      const split = e.split_among.map((u) => USER_MAP[u]?.name).join("+");
      return `${new Date(e.created_at).toLocaleDateString("es-MX")},"${e.month}","${cat.replace(/"/g, '""')}","${(e.description || "").replace(/"/g, '""')}",${e.amount},"${user}","${split}"`;
    }).join("\n");
    const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "casavalle-gastos.csv"; a.click();
    URL.revokeObjectURL(url);
    toast?.("CSV descargado ✓", "success");
  };

  const uniqueMonths = [...new Set(allExps.map((e) => e.month))].sort().reverse();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ color: T.w, fontSize: 18, fontWeight: 800, fontFamily: F }}>📋 Historial</h3>
        <Btn small onClick={exportCSV} color={T.c2}>📥 CSV</Btn>
      </div>
      <Input value={search} onChange={setSearch} placeholder="🔍 Buscar..." />
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ background: T.c2, border: `1px solid ${T.b}`, borderRadius: 8, padding: "6px 8px", color: T.ts, fontSize: 11, fontFamily: F, outline: "none" }}>
          <option value="">Todos los meses</option>
          {uniqueMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ background: T.c2, border: `1px solid ${T.b}`, borderRadius: 8, padding: "6px 8px", color: T.ts, fontSize: 11, fontFamily: F, outline: "none" }}>
          <option value="">Categorías</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ background: T.c2, border: `1px solid ${T.b}`, borderRadius: 8, padding: "6px 8px", color: T.ts, fontSize: 11, fontFamily: F, outline: "none" }}>
          <option value="">Usuarios</option>
          {USERS.map((u) => <option key={u.id} value={u.id}>{u.emoji} {u.name}</option>)}
        </select>
      </div>
      <p style={{ color: T.tm, fontSize: 12, fontFamily: F, marginBottom: 12 }}>{filtered.length} resultados</p>

      {filtered.length === 0 ? <EmptyState icon="🔍" title="Sin resultados" /> :
        filtered.map((e) => {
          const cat = CAT_MAP[e.category] || { icon: "📦", label: e.category };
          const user = USER_MAP[e.paid_by];
          const canEdit = e.paid_by === me.id;
          return <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.b}20` }}>
            <span style={{ fontSize: 20 }}>{cat.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: T.w, fontSize: 13, fontWeight: 700, fontFamily: F }}>{e.description || cat.label}</span>
              <div style={{ color: T.tm, fontSize: 11, fontFamily: F }}>{user?.emoji} {user?.name} · {monthLabel(e.month)} · {new Date(e.created_at).toLocaleDateString("es-MX", { day: "numeric" })}</div>
            </div>
            <span style={{ color: T.w, fontSize: 14, fontWeight: 800, fontFamily: F, whiteSpace: "nowrap" }}>{fmt(e.amount)}</span>
            {canEdit && <div style={{ display: "flex", gap: 2 }}>
              <button onClick={() => onEdit?.(e)} style={{ background: "none", border: "none", cursor: "pointer", color: T.tm, fontSize: 14, padding: 4, opacity: 0.6 }}>✏️</button>
              <button onClick={() => setConfirmDelete(e)} style={{ background: "none", border: "none", cursor: "pointer", color: T.tm, fontSize: 14, padding: 4, opacity: 0.6 }}>🗑</button>
            </div>}
          </div>;
        })}

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="¿Eliminar gasto?">
        {confirmDelete && <>
          <div style={{ background: T.c2, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ color: T.w, fontSize: 14, fontWeight: 700, fontFamily: F, margin: "0 0 4px" }}>{CAT_MAP[confirmDelete.category]?.icon} {confirmDelete.description || CAT_MAP[confirmDelete.category]?.label}</p>
            <p style={{ color: T.accent2, fontSize: 18, fontWeight: 800, fontFamily: F, margin: 0 }}>{fmt(confirmDelete.amount)}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setConfirmDelete(null)} color={T.b} style={{ flex: 1 }}>Cancelar</Btn>
            <Btn onClick={() => { onDelete?.(confirmDelete); setConfirmDelete(null); }} color={T.red} style={{ flex: 1 }}>Eliminar</Btn>
          </div>
        </>}
      </Modal>
    </div>
  );
};

// ============================================================================
// BANK — only owner can edit, CLABE validation, copy
// ============================================================================

const BankView = ({ bank, me, refresh, toast }) => {
  const [editing, setEditing] = useState(null);
  const [clabe, setClabe] = useState("");
  const [bankName, setBankName] = useState("");

  const handleSave = async () => {
    const clean = clabe.replace(/\s/g, "");
    if (!/^\d{18}$/.test(clean)) { toast?.("CLABE debe tener 18 dígitos", "error"); return; }
    if (!bankName.trim()) { toast?.("Banco es obligatorio", "error"); return; }
    try {
      const existing = bank.find((b) => b.user_id === editing);
      if (existing) {
        const { error } = await supabase.from("bank_accounts").update({ clabe: clean, bank_name: bankName.trim() }).eq("user_id", editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert({ user_id: editing, clabe: clean, bank_name: bankName.trim() });
        if (error) throw error;
      }
      toast?.("Datos bancarios guardados ✓", "success");
      setEditing(null); setClabe(""); setBankName("");
      refresh();
    } catch (err) { console.error(err); toast?.("Error al guardar datos bancarios", "error"); }
  };

  const handleDelete = async (userId) => {
    try {
      const { error } = await supabase.from("bank_accounts").delete().eq("user_id", userId);
      if (error) throw error;
      toast?.("CLABE eliminada", "success");
      refresh();
    } catch (err) { console.error(err); toast?.("Error al eliminar CLABE", "error"); }
  };

  return (
    <div>
      <h3 style={{ color: T.w, fontSize: 18, fontWeight: 800, fontFamily: F, marginBottom: 16 }}>🏦 Datos bancarios</h3>
      <p style={{ color: T.tm, fontSize: 13, fontFamily: F, marginBottom: 20 }}>Para facilitar transferencias. Solo tú puedes editar tu CLABE.</p>
      {USERS.map((u) => {
        const b = bank.find((ba) => ba.user_id === u.id);
        const isMe = u.id === me.id;
        return <Card key={u.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>{u.emoji}</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: T.w, fontSize: 14, fontWeight: 700, fontFamily: F, margin: 0 }}>{u.name}</p>
              {b ? <>
                <p onClick={() => { navigator.clipboard?.writeText(b.clabe); toast?.("CLABE copiada 📋", "success"); }}
                  style={{ color: T.ts, fontSize: 13, fontFamily: F, margin: "2px 0 0", letterSpacing: "0.5px", cursor: "pointer" }}>{b.clabe} 📋</p>
                <p style={{ color: T.tm, fontSize: 11, fontFamily: F, margin: 0 }}>{b.bank_name}</p>
              </> : <p style={{ color: T.tm, fontSize: 12, fontFamily: F, margin: 0 }}>Sin CLABE</p>}
            </div>
            {isMe && <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => { setEditing(u.id); setClabe(b?.clabe || ""); setBankName(b?.bank_name || ""); }}
                style={{ background: T.c2, border: `1px solid ${T.b}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: T.tm, fontSize: 11, fontFamily: F }}>✏️</button>
              {b && <button onClick={() => handleDelete(u.id)}
                style={{ background: T.c2, border: `1px solid ${T.red}30`, borderRadius: 8, padding: "4px 8px", cursor: "pointer", color: T.red, fontSize: 11, fontFamily: F }}>🗑</button>}
            </div>}
          </div>
        </Card>;
      })}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`CLABE de ${USER_MAP[editing]?.name || ""}`}>
        <Input label="CLABE (18 dígitos)" value={clabe} onChange={setClabe} placeholder="012345678901234567" maxLength={18} inputMode="numeric" />
        {clabe.replace(/\s/g, "").length > 0 && clabe.replace(/\s/g, "").length !== 18 && <p style={{ color: T.yellow, fontSize: 11, fontFamily: F, marginTop: -8, marginBottom: 8 }}>⚠️ {clabe.replace(/\s/g, "").length}/18 dígitos</p>}
        <Input label="BANCO (obligatorio)" value={bankName} onChange={setBankName} placeholder="Ej: BBVA, Banorte" />
        <Btn onClick={handleSave} style={{ width: "100%" }}>Guardar</Btn>
      </Modal>
    </div>
  );
};

// ============================================================================
// NAVIGATION
// ============================================================================

const Nav = ({ view, set, pendingSettleCount }) => {
  const tabs = [
    { id: "home", icon: "🏠", label: "Inicio" },
    { id: "add", icon: "➕", label: "Nuevo" },
    { id: "recurring", icon: "🔄", label: "Fijos" },
    { id: "settle", icon: "💸", label: "Liquidar" },
    { id: "analytics", icon: "📊", label: "Dashboard" },
    { id: "history", icon: "📋", label: "Historial" },
    { id: "bank", icon: "🏦", label: "Banco" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.c, borderTop: `1px solid ${T.b}`, display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 900 }}>
      {tabs.map((t) => {
        const active = view === t.id;
        const showBadge = t.id === "settle" && pendingSettleCount > 0;
        return <button key={t.id} onClick={() => set(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "4px 6px", opacity: active ? 1 : 0.5, position: "relative" }}>
          <span style={{ fontSize: t.id === "add" ? 24 : 18, filter: active ? "none" : "grayscale(0.5)" }}>{t.icon}</span>
          {showBadge && <span style={{ position: "absolute", top: 0, right: 0, background: T.red, color: "#fff", fontSize: 8, fontWeight: 900, fontFamily: F, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingSettleCount}</span>}
          <span style={{ color: active ? T.accent2 : T.tm, fontSize: 9, fontWeight: active ? 800 : 600, fontFamily: F }}>{t.label}</span>
        </button>;
      })}
    </div>
  );
};

const Header = ({ me, onLogout }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", marginBottom: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 24 }}>🏔️</span>
      <h1 style={{ color: T.w, fontSize: 18, fontWeight: 900, fontFamily: F, margin: 0, letterSpacing: "-0.5px" }}>CasaValle</h1>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: T.ts, fontSize: 13, fontFamily: F }}>{me.emoji} {me.name}</span>
      <button onClick={onLogout} style={{ background: T.c2, border: `1px solid ${T.b}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer", color: T.tm, fontSize: 11, fontFamily: F }}>Salir</button>
    </div>
  </div>
);

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [me, setMe] = useState(() => {
    try { const s = localStorage.getItem("casavalle_session"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [view, setView] = useState("home");
  const [month, setMonth] = useState(monthKey());
  const [allExps, setAllExps] = useState([]);
  const [recs, setRecs] = useState([]);
  const [bank, setBank] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [editingExp, setEditingExp] = useState(null);

  const showToast = useCallback((msg, type = "success") => setToast({ message: msg, type }), []);

  const handleLogin = useCallback((user) => {
    setMe(user);
    try { localStorage.setItem("casavalle_session", JSON.stringify(user)); } catch {}
  }, []);

  const handleLogout = useCallback(() => {
    setMe(null);
    try { localStorage.removeItem("casavalle_session"); } catch {}
  }, []);

  const loadData = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      const months12 = getLast12Months();
      const [expRes, recRes, bankRes, budgetRes, settleRes] = await Promise.all([
        supabase.from("expenses").select("*").in("expense_month", months12).order("created_at", { ascending: false }),
        supabase.from("recurring").select("*").order("created_at", { ascending: false }),
        supabase.from("bank_accounts").select("*"),
        supabase.from("budgets").select("*"),
        supabase.from("settlements").select("*").in("settle_month", months12),
      ]);
      setAllExps((expRes.data || []).map(e => ({ ...e, month: e.expense_month })));
      setRecs(recRes.data || []);
      setBank(bankRes.data || []);
      const bg = {}; (budgetRes.data || []).forEach((b) => { bg[b.category] = b.monthly_limit; });
      setBudgets(bg);
      setSettlements((settleRes.data || []).map(s => ({ ...s, month: s.settle_month })));
    } catch (err) { console.error("Load error:", err); showToast("Error al cargar datos. Verifica tu conexión.", "error"); }
    setLoading(false);
  }, [me, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel("realtime-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, loadData]);

  // Auto-apply recurring for current month
  useEffect(() => {
    if (!me || !recs.length || !allExps) return;
    const mk = monthKey();
    const applied = allExps.filter((e) => e.is_recurring && e.month === mk);
    const toApply = recs.filter((r) => r.active && !(r.paused_months || []).includes(mk) && !applied.find((a) => a.recurring_id === r.id));
    if (toApply.length === 0) return;
    const newExps = toApply.map((r) => ({
      id: uid(), amount: r.amount, category: r.category, description: r.description,
      paid_by: r.paid_by, split_among: r.split_among, split_type: r.split_type || "equal",
      custom_split: null, expense_month: mk, is_recurring: true, recurring_id: r.id,
    }));
    supabase.from("expenses").insert(newExps).then(() => loadData());
  }, [me, recs, allExps]);

  const handleSaveExp = async (exp) => {
    try {
      const dbExp = { ...exp, expense_month: exp.month };
      delete dbExp.month;
      const { data: existing } = await supabase.from("expenses").select("id").eq("id", exp.id).single();
      if (existing) {
        const { error } = await supabase.from("expenses").update(dbExp).eq("id", exp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(dbExp);
        if (error) throw error;
      }
      // Budget alert
      const catBudget = budgets[exp.category];
      if (catBudget > 0) {
        const catTotal = allExps.filter((e) => e.category === exp.category && e.month === exp.month).reduce((s, e) => s + parseFloat(e.amount), 0) + exp.amount;
        const pct = (catTotal / catBudget) * 100;
        if (pct >= 100) showToast(`🚨 ${CAT_MAP[exp.category]?.label}: excedido (${fmt(catTotal)} / ${fmt(catBudget)})`, "error");
        else if (pct >= 80) showToast(`⚠️ ${CAT_MAP[exp.category]?.label}: ${pct.toFixed(0)}% usado`, "warning");
        else showToast(existing ? "Actualizado ✓" : "Guardado ✓", "success");
      } else {
        showToast(existing ? "Actualizado ✓" : "Guardado ✓", "success");
      }
      setEditingExp(null);
      setView("home");
      loadData();
    } catch (err) {
      console.error("Save error:", err);
      showToast("Error al guardar. Verifica tu conexión.", "error");
    }
  };

  const handleDeleteExp = async (exp) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
      if (error) throw error;
      showToast("Eliminado", "success");
      loadData();
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Error al eliminar. Verifica tu conexión.", "error");
    }
  };

  const handleEditExp = (exp) => { setEditingExp(exp); setView("add"); };

  if (!me) return <><style>{CSS}</style><Login onLogin={handleLogin} toast={showToast} /></>;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", padding: "0 16px 80px" }}>
      <style>{CSS}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header me={me} onLogout={handleLogout} />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <span style={{ fontSize: 32, display: "block", marginBottom: 12, animation: "float 2s ease-in-out infinite" }}>🏔️</span>
          <p style={{ color: T.tm, fontFamily: F }}>Cargando...</p>
        </div>
      ) : <>
        {view === "home" && <Home exps={allExps} me={me} month={month} setMonth={setMonth} onEdit={handleEditExp} onDelete={handleDeleteExp} settlements={settlements} onGoSettle={() => setView("settle")} toast={showToast} />}
        {view === "add" && <ExpForm me={me} onSave={handleSaveExp} editExp={editingExp} onCancel={editingExp ? () => { setEditingExp(null); setView("home"); } : undefined} />}
        {view === "recurring" && <RecurringView recs={recs} me={me} refresh={loadData} toast={showToast} />}
        {view === "settle" && <SettleView allExps={allExps} bank={bank} month={month} setMonth={setMonth} settlements={settlements} me={me} refresh={loadData} toast={showToast} />}
        {view === "analytics" && <AnalyticsDashboard allExps={allExps} month={month} toast={showToast} />}
        {view === "history" && <HistoryView allExps={allExps} me={me} onEdit={handleEditExp} onDelete={handleDeleteExp} toast={showToast} />}
        {view === "bank" && <BankView bank={bank} me={me} refresh={loadData} toast={showToast} />}
      </>}

      <Nav view={view} set={(v) => { if (v !== "add") setEditingExp(null); setView(v); }} pendingSettleCount={(() => {
        const mk = monthKey();
        const curExps = allExps.filter((e) => e.month === mk);
        const { txns } = calcSettlements(curExps);
        const curSettlements = settlements.filter((s) => s.month === mk);
        return txns.filter((tx) => {
          if (tx.from !== me.id && tx.to !== me.id) return false;
          const s = curSettlements.find((s) => s.from_user === tx.from && s.to_user === tx.to);
          return !s || s.status !== "confirmed";
        }).length;
      })()} />
    </div>
  );
}
