# Cel — Claude Code Context

## What this project is
Cel is a free, web-based 2D animation tool with limited 3D integration. Built web-first, with a clean path to wrap in Tauri as a desktop app later. Target users: small team.

## Tech stack
- **Build:** Vite
- **UI:** React + Zustand
- **Canvas / 2D:** Pixi.js v8
- **3D layer (later):** Three.js
- **Styling:** Tailwind CSS
- **Backend:** Node/Express + PostgreSQL (Neon via Vercel)
- **File storage:** Vercel Blob (migrate to Cloudflare R2 at scale)
- **Export (later):** gif.js + ffmpeg-wasm

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — lint
- `npm run typecheck` — type check

## Architecture rules — IMPORTANT
- **React owns the UI. Pixi owns the canvas. They do not cross.**
- Zustand is the bridge. Pixi reads state directly from the store; it never triggers React renders.
- The Pixi ticker loop must never cause a React re-render.
- Keep all canvas logic outside React component lifecycle.

## Project file format
Inspired by DaVinci Resolve — the project file is a small JSON manifest. It references media by file path + SHA-256 hash. It never embeds media bytes.
See `@./docs/project-context.md` for the full data model.

## Current goal: basic demo
Build the minimum loop: create an object → place keyframes → press play → watch it move.

Demo checklist (in order):
1. Pixi canvas renders a shape at 60fps
2. CSS Grid app shell (toolbar / canvas / panels / timeline)
3. Zustand data model: project → scenes → layers → keyframes
4. Timeline UI — scrubber, keyframe markers
5. Playback — interpolate between keyframes, drive Pixi from store
6. Multiple layers
7. Onion skinning
8. Local save/load (JSON file, no DB yet)
9. Scenes

## Coding conventions
- TypeScript strict mode
- Functional React components only, no class components
- No `any` — use `unknown` with type guards
- All canvas/Pixi code lives in `src/canvas/`
- All UI components live in `src/components/`
- All state lives in `src/store/`
- File names: kebab-case

## What to defer
Do not build these until the demo checklist is complete:
- Database / user accounts
- Render cache / proxy system
- Export (GIF, MP4)
- Three.js 3D layer
- Tauri packaging
- Collaboration features