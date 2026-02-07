// ============================================================================
// CasaValle — Constants & Utilities
// Single source of truth for users, categories, theme, helpers
// ============================================================================

export const USERS = [
  { id: "lucas", name: "Lucas", color: "#C45B28", emoji: "🌄" },
  { id: "luis", name: "Luis", color: "#2B6B4F", emoji: "🌲" },
  { id: "monica", name: "Mónica", color: "#8B6914", emoji: "🦋" },
  { id: "niels", name: "Niels", color: "#3B6FA0", emoji: "⛵" },
];
export const USER_MAP = Object.fromEntries(USERS.map((u) => [u.id, u]));

export const CATEGORIES = [
  { id: "hipoteca", label: "Hipoteca", icon: "🏡" },
  { id: "luz", label: "Luz / CFE", icon: "💡" },
  { id: "internet", label: "Internet", icon: "📡" },
  { id: "agua", label: "Agua", icon: "💧" },
  { id: "gas", label: "Gas", icon: "🔥" },
  { id: "sueldos", label: "Sueldos", icon: "👷" },
  { id: "jardineria", label: "Jardinería", icon: "🌿" },
  { id: "arreglos", label: "Arreglos / Mtto", icon: "🔧" },
  { id: "seguridad", label: "Seguridad", icon: "🔒" },
  { id: "predial", label: "Predial", icon: "🏛️" },
  { id: "seguro", label: "Seguro", icon: "🛡️" },
  { id: "limpieza", label: "Limpieza", icon: "🧹" },
  { id: "super", label: "Súper / Despensa", icon: "🛒" },
  { id: "muebles", label: "Muebles / Equipo", icon: "🪑" },
  { id: "combustible", label: "Leña / Combustible", icon: "🪵" },
  { id: "plagas", label: "Fumigación / Plagas", icon: "🐛" },
  { id: "basura", label: "Basura / Recolección", icon: "🗑️" },
  { id: "transporte", label: "Casetas / Gasolina", icon: "⛽" },
  { id: "comidas", label: "Comidas / Restaurantes", icon: "🍽️" },
  { id: "entretenimiento", label: "Entretenimiento", icon: "🎉" },
  { id: "ferreteria", label: "Ferretería / Material", icon: "🏗️" },
  { id: "otro", label: "Otro", icon: "📦" },
];
export const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const SPLIT_PRESETS = [
  { id: "all", label: "Todos (4)", users: USERS.map((u) => u.id) },
  { id: "no-niels", label: "Sin Niels (3)", users: ["lucas", "luis", "monica"] },
  { id: "no-monica", label: "Sin Mónica (3)", users: ["lucas", "luis", "niels"] },
  { id: "no-luis", label: "Sin Luis (3)", users: ["lucas", "monica", "niels"] },
  { id: "no-lucas", label: "Sin Lucas (3)", users: ["luis", "monica", "niels"] },
];

// Theme
export const T = {
  bg: "#0C1810", c: "#14261A", c2: "#1A3324", b: "#2A4A35",
  w: "#F0EDE6", ts: "#9BB0A0", tm: "#7A9680",
  accent: "#C45B28", accent2: "#E8722E", green: "#4CAF50",
  red: "#E74C3C", yellow: "#F1C40F", blue: "#3B6FA0",
};
export const FONT = "'Nunito', 'Segoe UI', system-ui, sans-serif";

// Chart palette (for stacked bars)
export const PALETTE = [
  "#C45B28", "#2B6B4F", "#8B6914", "#3B6FA0", "#E74C3C", "#9B59B6",
  "#1ABC9C", "#F39C12", "#E67E22", "#2ECC71", "#3498DB", "#E84393",
  "#6C5CE7", "#00B894", "#FDCB6E", "#D63031", "#74B9FF", "#A29BFE",
  "#55EFC4", "#FAB1A0", "#81ECEC", "#DFE6E9",
];

// ============================================================================
// Utility functions
// ============================================================================

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const fmt = (n) => {
  const abs = Math.abs(n);
  return `$${abs.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthLabel = (key) => {
  const [y, m] = key.split("-");
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${names[parseInt(m) - 1]} ${y}`;
};

export const daysInMonth = (key) => {
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m), 0).getDate();
};

export const daysLeft = (key) => {
  const now = new Date();
  const mk = monthKey(now);
  if (key !== mk) return key < mk ? 0 : daysInMonth(key);
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
};

export const prevMonth = (key) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 2, 1));
};

export const nextMonth = (key) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m, 1));
};

export const getLast12Months = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return monthKey(d);
  });
};

// PIN hash (simple but non-reversible)
export const hashPin = (pin) => {
  let h = 0;
  const s = pin + "casavalle2024";
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return "cv_" + Math.abs(h).toString(36);
};

// Settlement calculator — minimum transactions (greedy)
export const calcSettlements = (expenses) => {
  const balances = {};
  USERS.forEach((u) => (balances[u.id] = 0));

  expenses.forEach((e) => {
    if (!e.paid_by || !e.split_among || e.split_among.length === 0) return;
    const amount = parseFloat(e.amount) || 0;
    if (amount <= 0) return;

    if (e.split_type === "custom" && e.custom_split) {
      balances[e.paid_by] += amount;
      Object.entries(e.custom_split).forEach(([uid, share]) => {
        balances[uid] -= parseFloat(share) || 0;
      });
    } else if (e.split_type === "percent" && e.custom_split) {
      balances[e.paid_by] += amount;
      Object.entries(e.custom_split).forEach(([uid, pct]) => {
        balances[uid] -= amount * ((parseFloat(pct) || 0) / 100);
      });
    } else {
      const share = amount / e.split_among.length;
      balances[e.paid_by] += amount;
      e.split_among.forEach((uid) => { balances[uid] -= share; });
    }
  });

  const debtors = [];
  const creditors = [];
  Object.entries(balances).forEach(([id, bal]) => {
    const rounded = Math.round(bal * 100) / 100;
    if (rounded < -0.01) debtors.push({ id, amount: -rounded });
    else if (rounded > 0.01) creditors.push({ id, amount: rounded });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const txns = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const transfer = Math.min(debtors[di].amount, creditors[ci].amount);
    if (transfer > 0.01) {
      txns.push({ from: debtors[di].id, to: creditors[ci].id, amount: Math.round(transfer * 100) / 100 });
    }
    debtors[di].amount -= transfer;
    creditors[ci].amount -= transfer;
    if (debtors[di].amount < 0.01) di++;
    if (creditors[ci].amount < 0.01) ci++;
  }
  return { balances, txns };
};

// Max login attempts
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
