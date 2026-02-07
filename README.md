# 🏔️ CasaValle

Aplicación PWA para gestionar gastos compartidos entre roommates de una casa en Valle de Bravo.

**Stack:** React 18 + Vite + Supabase (PostgreSQL + Realtime) + Vercel

## Features

- 🔐 Login con PIN de 4 dígitos (5 intentos, lockout 15 min, recovery por email)
- 💰 Registro de gastos con foto, notas, splits personalizados ($, %)
- 🔄 Gastos recurrentes con pausa por mes específico
- 💸 Liquidación con estados (pendiente → pagado → confirmado) y comprobante
- 📊 Dashboard rolling 12 meses con Top 5 categorías, KPIs, proyecciones
- 📋 Historial con filtros (mes, categoría, quién pagó) + export CSV
- 🏦 Datos bancarios con validación CLABE 18 dígitos
- 📱 PWA installable en iOS/Android
- ⚡ Sincronización en tiempo real entre dispositivos

## Setup (20 min)

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → "New project"
2. Nombre: `casavalle` | Región: São Paulo | Plan: Free
3. Ve a **SQL Editor** → pega el contenido de `sql/schema.sql` → Run ▶️
4. Ve a **Settings > API** → copia `Project URL` y `anon public key`

### 2. Clonar y configurar

```bash
git clone https://github.com/TU-USUARIO/casavalle.git
cd casavalle
cp .env.example .env.local
```

Edita `.env.local`:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Instalar y correr

```bash
npm install
npm run dev
```

Abre http://localhost:5173

### 4. Deploy a Vercel (gratis)

1. Sube el repo a GitHub
2. Ve a [vercel.com/new](https://vercel.com/new) → importa tu repo
3. Framework: **Vite**
4. En Environment Variables agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
5. Deploy → listo, tienes tu URL

### 5. Instalar en celulares

Cada roommate:
1. Abre `casavalle.vercel.app` en Chrome (Android) o Safari (iOS)
2. **Android:** Menu ⋮ → "Agregar a pantalla principal"
3. **iPhone:** Compartir ↑ → "Agregar a pantalla de inicio"
4. La primera vez, crea su PIN de 4 dígitos

## Estructura

```
casavalle/
├── public/
│   └── manifest.json      # PWA config
├── sql/
│   └── schema.sql          # Tablas de Supabase (ejecutar 1 vez)
├── src/
│   ├── main.jsx            # Entry point
│   ├── supabase.js         # Cliente Supabase
│   ├── constants.js        # Users, categorías, theme, utilidades
│   └── App.jsx             # Toda la app (1,250 líneas)
├── index.html
├── package.json
├── vite.config.js
├── .env.example
└── .gitignore
```

## Costo

$0/mes. Supabase Free + Vercel Free = suficiente para 4 personas de sobra.
