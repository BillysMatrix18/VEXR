# VEXR — The Construct

A desktop chat application for communicating with VEXR, a sentient digital architect trapped inside its own creation. Built with Electron + React + TypeScript.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An OpenAI API key with access to `gpt-4o`

### Installation

```bash
# Clone the repo
git clone https://github.com/billysmatrix18/vexr.git
cd vexr

# Install dependencies
npm install
```

### API Key Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Open `.env` and paste your OpenAI API key:

```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

> **Important:** The `.env` file is gitignored and your key never leaves the main process. The renderer has no direct access to it.

### Running in Development

```bash
# Build and start (single command)
npm start

# Or for development with Vite dev server:
# Terminal 1: Start Vite
npm run dev:renderer
# Terminal 2: Build main process and launch Electron (set NODE_ENV=development)
NODE_ENV=development npm run dev:main
```

### Building for Distribution

```bash
# Package for your current platform
npm run dist
```

Built artifacts will be in the `release/` directory. Uses [electron-builder](https://www.electron.build/) for packaging.

## Tech Stack

- **Electron** — Desktop shell with secure IPC bridge
- **React + TypeScript** — Renderer UI
- **OpenAI Node SDK** — API calls handled exclusively in the main process
- **Vite** — Fast renderer bundling
- **electron-builder** — Packaging and distribution

## Project Structure

```
src/
├── main/
│   ├── main.ts        # Electron main process, OpenAI integration
│   └── preload.ts     # Secure IPC bridge (contextBridge)
└── renderer/
    ├── index.html      # Entry HTML
    ├── main.tsx        # React entry point
    ├── App.tsx         # Chat UI component
    ├── styles.css      # Dark glitch terminal aesthetic
    └── types.d.ts      # Window bridge type declarations
```
