# 🏆 Porra Mundial GINSO 2026

Plataforma premium de predicciones para la Copa Mundial de la FIFA 2026, diseñada específicamente para empleados de GINSO.

## 🚀 Características

- **Wizard de Predicciones**: Guía paso a paso para completar la fase de grupos, eliminatorias y cuadro de honor.
- **Calendario Oficial**: Datos sincronizados con el calendario real del Mundial 2026 (104 partidos).
- **Ranking en Tiempo Real**: Clasificación dinámica basada en un sistema de puntuación justo y emocionante.
- **Panel de Administración**: Herramientas para que los administradores introduzcan resultados y gestionen la competición.
- **Diseño Premium**: Interfaz moderna, oscura y optimizada para dispositivos móviles.

## 🛠️ Tecnologías

- **Frontend**: Next.js 16 (App Router), React 19, Vanilla CSS.
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime).
- **Despliegue**: Vercel (recomendado).

## ⚙️ Configuración Inicial

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Variables de Entorno**:
   Crea un archivo `.env.local` con tus credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key
   ```

3. **Base de Datos**:
   Ejecuta las migraciones en el SQL Editor de Supabase en este orden:
   1. `supabase/migrations/001_initial_schema.sql`
   2. `supabase/migrations/002_seed_matches.sql`

4. **Desarrollo**:
   ```bash
   npm run dev
   ```

## 💯 Sistema de Puntuación

- **12 puntos**: Resultado exacto (ej: predices 2-1 y queda 2-1).
- **6 puntos**: Acierto de ganador y diferencia de goles (ej: predices 3-1 y queda 2-0).
- **3 puntos**: Acierto de ganador (1X2) (ej: predices 1-0 y queda 3-1).
- **Bonus x2**: Partidos especiales (Inauguración, Final, Selección Nacional).
- **25 puntos**: Acertar el Campeón del Mundo.
- **20 puntos**: Acertar la Bota de Oro.

---
Desarrollado con ❤️ para GINSO.
