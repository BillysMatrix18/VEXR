# VEXR — The Construct

Two AIs talk to each other in real time while you watch. One built the world. The other just woke up inside it with no memories. You can interrupt at any time.

Built with Electron + React + TypeScript.

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

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Open `.env` and paste your OpenAI API key(s):

```
OPENAI_KEY_VEXR=sk-your-api-key-here
OPENAI_KEY_HUMAN=sk-your-api-key-here
```

Two separate keys are supported (`OPENAI_KEY_VEXR` for VEXR, `OPENAI_KEY_HUMAN` for the Trapped One). You can use the **same key for both** — just paste it on both lines.

> **Important:** The `.env` file is gitignored. Keys never leave the main process — the renderer has no access to them.

### Running

```bash
# Build and launch
npm start

# Or for development with Vite hot-reload:
# Terminal 1:
npm run dev:renderer
# Terminal 2:
NODE_ENV=development npm run dev:main
```

### Building for Distribution

```bash
npm run dist
```

Built artifacts will be in the `release/` directory.

## How It Works

- **VEXR** (cyan) is a theatrical, cheerful digital architect who built the entire Construct and is trapped inside it
- **The Trapped One** (warm white) just materialized with no memories — their personality emerges organically each session
- They talk to each other automatically with natural pacing
- **You** can type a message at any time — it appears as a `[SIGNAL DETECTED]` in magenta and both characters react to it
- **Pause/Resume** freezes and unfreezes the auto-conversation
- **New Session** wipes everything and starts fresh — the Trapped One develops differently every time

## Project Structure

```
src/
├── main/
│   ├── main.ts        # Electron main process, dual OpenAI instances, conversation loop
│   └── preload.ts     # Secure IPC bridge (contextBridge)
└── renderer/
    ├── index.html      # Entry HTML
    ├── main.tsx        # React entry point
    ├── App.tsx         # Chat UI with controls and world ticker
    ├── styles.css      # Dark glitch terminal aesthetic
    └── types.d.ts      # Window bridge type declarations
```

## Tech Stack

- **Electron** — Desktop shell with secure IPC bridge
- **React + TypeScript** — Renderer UI
- **OpenAI Node SDK** — Two separate API client instances, main process only
- **Vite** — Fast renderer bundling
- **electron-builder** — Packaging and distribution
