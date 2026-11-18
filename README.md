# LIFE OS

Aplicación personal, mobile-first y pensada para iPhone, con diseño negro premium y datos reales en Supabase. Reúne agenda, tareas, notas, alimentación, entrenamiento, objetivos y estadísticas en un único sistema.

## Stack

- React 18 + TypeScript + Vite 5
- Tailwind CSS 3
- Supabase (Auth, Postgres, Row Level Security y RPCs)
- Recharts para visualizaciones
- Vitest para pruebas de cálculos y comprobaciones estáticas de seguridad
- PWA instalable con service worker para assets estáticos

## Módulos

- **Hoy**: resumen del día con agenda, tareas, comidas, entrenamiento y objetivos reales.
- **Agenda**: calendario mensual/semanal/diario, actividades recurrentes, tareas y notas.
- **Alimentación**: planificador semanal, registro diario, recetas, despensa, mercado y alimentos prioritarios.
- **Entrenamiento**: rutina semanal, sesiones con ejercicios, historial, volumen, cardio y evolución de cargas.
- **Progreso**: productividad, cumplimiento, horas por categoría, hábitos alimentarios, desperdicio, consistencia y objetivos.
- **Ajustes**: perfil, zona horaria, unidades, categorías, estado de conexión y cierre de sesión.

Las estadísticas se calculan solo con registros del usuario. No hay datos de demostración, nutrición inventada ni métricas simuladas. La nutrición es opcional y permanece vacía si no se introduce.

## Inicio rápido

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

Variables de entorno en `.env`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

Usa exclusivamente la clave **anon/public**. Nunca incluyas una `service_role` en el frontend ni en el repositorio.

## Configurar Supabase

La migración está en:

```text
supabase/migrations/0001_life_os_schema.sql
```

### Opción A: Supabase CLI

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

`supabase link` solicita la contraseña de la base de datos del proyecto.

### Opción B: SQL Editor

1. Abre el SQL Editor del proyecto en Supabase.
2. Copia el contenido completo de `0001_life_os_schema.sql`.
3. Ejecútalo una sola vez en un proyecto limpio.

La migración crea:

- Todas las tablas, enums, restricciones, índices y triggers de `updated_at`.
- Perfil y categorías iniciales al registrar un usuario.
- RLS en todas las tablas privadas, limitado a `auth.uid()`.
- RPCs atómicas para compra, despensa, comidas, recetas, rutinas, sesiones de entrenamiento y objetivos.

### Autenticación

En **Authentication > URL Configuration**:

- Site URL: `http://localhost:5173` en desarrollo o el dominio de producción.
- Redirect URLs:
  - `http://localhost:5173/reset-password`
  - `https://tu-dominio.com/reset-password`
  - Añade también los orígenes que uses para preview.

Si la confirmación de email está activa, el registro pedirá confirmar el correo antes de iniciar sesión. Si se desactiva, el usuario podrá entrar inmediatamente.

## Scripts

```bash
npm run dev        # servidor de desarrollo
npm run build      # typecheck + build de producción
npm run preview    # preview del build
npm run typecheck  # TypeScript
npm test           # Vitest
npm run test:watch
```

## Seguridad y datos

- Todas las tablas privadas tienen RLS con políticas `select`, `insert`, `update` y `delete` limitadas al propietario.
- Las tablas hijas usan claves foráneas compuestas con `user_id` cuando aplica.
- Las operaciones multi-tabla se ejecutan en RPCs `security definer` con `search_path` fijo.
- El cliente solo usa la clave anon; las políticas son la frontera de seguridad.
- Las rutas protegidas redirigen a login si no hay sesión.
- El service worker cachea shell y assets estáticos. **No hay sincronización offline completa**: crear o editar datos requiere conexión.

## PWA en iPhone

1. Publica la app en HTTPS.
2. Abre la URL en Safari.
3. Compartir > Añadir a pantalla de inicio.

La app usa safe areas, barra inferior de navegación y manifest standalone. Los iconos están en `public/icons`.

## Verificación realizada

- `npm run typecheck`: correcto.
- `npm run build`: correcto.
- `npm test`: 25 pruebas correctas.
  - Cálculos de tareas, entrenamiento, nutrición, despensa, compras y objetivos.
  - Series de progreso y consistencia.
  - Comprobaciones estáticas de RLS, políticas, FKs compuestas y RPCs en la migración.
- Conectividad de Supabase Auth comprobada.
- La API REST respondió `PGRST205` para `profiles`, lo que confirma que **la migración todavía no se ha aplicado** al proyecto configurado. Hasta aplicarla, el registro y las consultas fallarán.

Las pruebas de RLS son estáticas sobre el SQL. No sustituyen una verificación contra una base de datos real con dos usuarios distintos.

## Limitaciones conocidas

- La migración no está aplicada en el proyecto de Supabase actual.
- Las fechas se calculan con la zona horaria local del navegador; el campo `timezone` del perfil se guarda, pero no se usa aún para reinterpretar fechas históricas.
- No hay sincronización offline ni resolución de conflictos.
- No se calculan macros automáticamente a partir de recetas: la nutrición solo aparece cuando se introduce manualmente.
- El service worker debe actualizar su versión de caché al cambiar assets críticos.

## Estructura

```text
src/
  components/        UI compartida, agenda, alimentación, entrenamiento, progreso
  hooks/             auth, consultas, categorías, red
  lib/               Supabase, fechas, cálculos, progreso, constantes
  pages/             hoy, agenda, alimentación, entrenamiento, progreso, ajustes, auth
supabase/
  migrations/        esquema, RLS y RPCs
tests/               cálculos, progreso y comprobaciones estáticas del esquema
public/              manifest, service worker e iconos
```
