# Cel — Project Context (Deep Reference)

> This file is referenced from CLAUDE.md. Load it when working on data models, storage, architecture, or the render cache system.

---

## Data model

The core hierarchy:

```
Project
└── scenes[]
    └── layers[]
        └── keyframes[]
            └── { timestamp, x, y, scaleX, scaleY, rotation, alpha, ... }
```

### Project manifest (stored in DB as JSONB)
```ts
type Project = {
  id: string
  name: string
  fps: number           // default 30
  duration: number      // total frames
  resolution: { width: number; height: number }
  scenes: Scene[]
  mediaManifest: MediaEntry[]
}
```

### Scene
```ts
type Scene = {
  id: string
  name: string
  layers: Layer[]
}
```

### Layer
```ts
type Layer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  mediaId: string | null   // null = procedural/drawn shape
  keyframes: Keyframe[]
}
```

### Keyframe
```ts
type Keyframe = {
  frame: number
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}
```

### Media entry (DaVinci-style linking)
```ts
type MediaEntry = {
  id: string
  filename: string
  path: string        // absolute path on user's machine at import time
  hash: string        // SHA-256 fingerprint for relinking
  width?: number
  height?: number
  importedAt: number
}
```

Media is never stored in the DB. On project open, resolve media in order:
1. Check stored path — file present? Done.
2. Scan for file with matching hash.
3. Prompt user to relink.

---

## Database schema (Postgres)

```sql
create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text,
  created_at  timestamptz default now()
);

create table projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references users(id),
  name            text not null,
  fps             int default 30,
  duration        int,
  manifest        jsonb not null,       -- scenes, layers, keyframes
  media_manifest  jsonb default '[]',   -- MediaEntry[]
  cache_url       text,                 -- R2/Blob path to render cache
  cache_dirty     boolean default true,
  updated_at      timestamptz default now(),
  created_at      timestamptz default now()
);

create table project_members (
  project_id  uuid references projects(id),
  user_id     uuid references users(id),
  role        text default 'editor',    -- 'owner' | 'editor' | 'viewer'
  primary key (project_id, user_id)
);

create table user_preferences (
  user_id  uuid primary key references users(id),
  prefs    jsonb default '{}'
);
```

---

## Storage architecture

```
Neon Postgres (via Vercel)
  users, projects, project_members, user_preferences
  project manifest stored as JSONB

Vercel Blob → Cloudflare R2 (when cost demands it)
  render cache blobs
  exported GIF / MP4 files

Browser IndexedDB (local-first)
  local render cache (primary during playback)
  media hash index
  user preferences cache
```

---

## Render cache system

> Build this AFTER the demo is complete.

### Concept
Pre-compute all frame states before playback. During playback, read from cache array instead of interpolating on every tick.

```
Edit mode:  keyframes → interpolate on demand → canvas
Play mode:  keyframes → pre-compute all frames → cache → canvas
```

### Cache entry format
```ts
type FrameCache = Array<ObjectState[]>

type ObjectState = {
  id: string
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
}
```

### Build strategy
Build cache incrementally using `requestIdleCallback` or a Web Worker to avoid blocking the UI. Use a dirty flag — invalidate and rebuild when the user edits.

```ts
async function buildCache(project: Project): Promise<FrameCache> {
  const totalFrames = project.duration * project.fps
  const cache: FrameCache = []
  for (let f = 0; f < totalFrames; f++) {
    cache[f] = interpolateAllObjects(project, f)
    if (f % 10 === 0) await yieldToMain()
  }
  return cache
}
const yieldToMain = () => new Promise(r => setTimeout(r, 0))
```

### Playback flow
```
User presses play
  → local IndexedDB cache valid?  → yes → play
  → no → cloud cache valid (cache_dirty = false)? → yes → download → play
  → no → build locally → play → upload to cloud, set cache_dirty = false
```

### Proxy textures
For heavy assets, swap in half-res textures during playback:
```ts
const getTexture = (assetId: string, isPlaying: boolean) =>
  isPlaying ? textures.proxy[assetId] : textures.full[assetId]
```
Generate proxy textures once at import time using an offscreen canvas.

---

## App shell layout

CSS Grid — do not change this structure:

```css
.app {
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  grid-template-rows: 48px 1fr 220px;
  height: 100vh;
  overflow: hidden;
}
```

| Area | Content |
|---|---|
| Top full-width | Toolbar |
| Left column | Layers panel |
| Center | Pixi canvas |
| Right column | Properties inspector |
| Bottom full-width | Timeline |

Panels collapse to icon rails on smaller screens. Canvas never shrinks below a usable size.

---

## Zustand store shape

```ts
type AppStore = {
  project: Project | null
  activeSceneId: string | null
  activeLayerId: string | null
  currentFrame: number
  isPlaying: boolean
  fps: number

  // actions
  setCurrentFrame: (frame: number) => void
  setIsPlaying: (playing: boolean) => void
  addKeyframe: (layerId: string, keyframe: Keyframe) => void
  updateKeyframe: (layerId: string, frame: number, patch: Partial<Keyframe>) => void
}
```

Pixi reads `currentFrame`, `isPlaying`, and the active scene's layer/keyframe data directly from the store on every ticker tick. It never subscribes to React state.

---

## Tauri migration path (future)
When ready, the migration is minimal:
- Replace `window.showOpenFilePicker()` with Tauri's `open()` dialog
- Remove any server-side dependencies (there should be none for core animation logic)
- Run `npm create tauri-app` in the same repo, point at existing Vite build output
- Add Apple Developer certificate config for notarization
- Windows build after Mac is stable