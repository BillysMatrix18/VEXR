# VEXR — The Construct

Two AIs inhabit a 3D world that builds itself in real time. VEXR, the theatrical architect, constructs the world as he speaks. The Trapped One wakes inside it with no memories. You watch them interact — and interrupt whenever you want.

Built with Electron + React + TypeScript + Three.js.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An OpenAI API key with access to `gpt-4o`

### Installation

```bash
git clone https://github.com/billysmatrix18/vexr.git
cd vexr
npm install
```

### API Key Configuration

```bash
cp .env.example .env
```

Open `.env` and paste your OpenAI API key(s):

```
OPENAI_KEY_VEXR=sk-your-api-key-here
OPENAI_KEY_HUMAN=sk-your-api-key-here
```

Two keys are supported — one for VEXR, one for the Trapped One. You can use the **same key for both**.

> Keys never leave the main process. The renderer has no access to them.

### Running

```bash
# Build and launch
npm start

# Development with Vite hot-reload:
# Terminal 1:
npm run dev:renderer
# Terminal 2:
NODE_ENV=development npm run dev:main
```

### Building for Distribution

```bash
npm run dist
```

## How It Works

### The 3D World

The app opens to a **black void** — pure nothing. Use the **Entity Panel** on the right side of the viewport to spawn characters:

- **[ + ADD VEXR ]** — VEXR appears with a burst of cyan particles. He immediately begins building the world around him, describing each element as he creates it. The 3D world generates in real time based on what VEXR says — floors tile outward, skies fade in, structures rise, and THE BLEED corrupts.

- **[ + ADD TRAPPED ]** — The Trapped One materializes with a flash. They're confused, scared, and have no memories. They explore and react to the world VEXR is building.

When both characters are present, they begin a **live conversation** — alternating automatically with natural pacing.

### Interaction

- **Watch** — The characters talk to each other and move through the 3D world
- **Interrupt** — Type a message at any time. It appears as `[SIGNAL DETECTED]` and both characters react
- **Pause / Resume** — Freeze and unfreeze the auto-conversation
- **New Session** — Wipes everything (conversation + 3D world) and starts fresh. The Trapped One develops differently every time.
- **Camera** — Click and drag to orbit, scroll to zoom

### World Building

VEXR's messages are parsed for keywords that trigger 3D generation:

| Keyword | Effect |
|---------|--------|
| floor, ground, surface | Digital grid floor tiles outward |
| sky, stars, horizon | Sky dome with stars fades in |
| build, tower, stage, arch | Geometric structure generates |
| bleed, corrupt, glitch | THE BLEED — corrupted region appears |
| light, glow, color | World lighting shifts with accent colors |
| speck | SPECK does an excited orbit |

## Project Structure

```
src/
├── main/
│   ├── main.ts              # Electron main, dual OpenAI, conversation engine
│   └── preload.ts            # Secure IPC bridge
└── renderer/
    ├── index.html
    ├── main.tsx
    ├── App.tsx               # Layout: viewport + entity panel + chat
    ├── styles.css            # Dark terminal aesthetic
    ├── types.d.ts
    └── world/
        ├── ConstructScene.tsx # Three.js scene, animation loop, camera
        ├── entities.ts        # Character models (VEXR, Trapped One, SPECK)
        └── worldBuilder.ts    # World generation + keyword parser
```

## Tech Stack

- **Electron** — Desktop shell with secure IPC
- **React + TypeScript** — Renderer UI
- **Three.js** — 3D world rendering
- **OpenAI Node SDK** — Two separate API instances, main process only
- **Vite** — Fast renderer bundling
- **electron-builder** — Packaging
