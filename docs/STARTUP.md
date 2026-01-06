# Misdiagnose - Local Development Guide

**Last Updated:** January 7, 2026

## Prerequisites

- Node.js 18+ installed
- Python 3.10+ installed (for RAG service)
- API keys configured (see Environment Variables)

---

## Quick Start (All Services)

1. Open terminal in `D:\misdiagnose`

2. Start the game (client + server):
   ```bash
   npm run dev
   ```

3. In a **SEPARATE terminal**, start the RAG service:
   ```bash
   cd D:\misdiagnose\rag_textbook
   .venv\Scripts\python.exe api.py
   ```

4. Open browser to: http://localhost:3000

---

## Services & Ports

| Service | Port | Command |
|---------|------|---------|
| React Client | 3000 | `npm run dev:client` |
| Express Server | 3005 | `npm run dev:server` |
| RAG API | 3006 | `python api.py` (from rag_textbook folder) |

---

## Individual Commands

### Start client only:
```bash
cd D:\misdiagnose\client
npm run dev
```

### Start server only:
```bash
cd D:\misdiagnose\server
npm run dev
```

### Start RAG only:
```bash
cd D:\misdiagnose\rag_textbook
.venv\Scripts\python.exe api.py
```

### Start client + server together:
```bash
cd D:\misdiagnose
npm run dev
```

---

## Environment Variables

### Required API Keys

Create a `.env` file in `server/` folder:
```
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-proj-...
AI_PROVIDER=hybrid
```

### Or set in Windows:
```bash
set ANTHROPIC_API_KEY=your-key
set GROQ_API_KEY=your-key
set OPENAI_API_KEY=your-key
```

### AI Provider Options:
- `hybrid` (default) - Groq for real-time, OpenAI for background
- `groq` - All Groq (fast)
- `openai` - All OpenAI (quality)
- `claude` - All Claude/Anthropic

---

## RAG Service Setup

If the RAG service isn't set up yet:

```bash
cd D:\misdiagnose\rag_textbook

# Create virtual environment
python -m venv .venv

# Activate it
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run
python api.py
```

---

## Troubleshooting

### Port already in use?
```bash
npx kill-port 3000
npx kill-port 3005
npx kill-port 3006
```

### RAG not working?
- Make sure you're in the `rag_textbook` folder when running `api.py`
- Check that `.venv` exists (run: `python -m venv .venv`)
- Install requirements: `.venv\Scripts\pip.exe install -r requirements.txt`

### Missing dependencies?
```bash
npm install              # in root folder
npm run install:all      # installs all packages (root, client, server)
```

### TypeScript errors?
```bash
cd server
npx tsc --noEmit         # Check for type errors
```

### Server won't start?
- Check `.env` file exists in `server/` with API keys
- Check port 3005 is free
- Check `server/src/data/` folder exists

---

## Useful Scripts

```bash
# Development
npm run dev              # Client + Server
npm run dev:client       # Client only
npm run dev:server       # Server only

# Building
npm run build            # Build all
npm run build:client     # Build client
npm run build:server     # Build server

# Testing
npm run generate-cases   # Generate test cases
npm run set-test-user <uid>  # Mark user as test account

# Utilities
npx kill-port 3000       # Kill port 3000
npx kill-port 3005       # Kill port 3005
```

---

## Data Directories

Local development data is stored in:
```
server/src/data/
├── cases/           # Pre-generated case files
├── users/
│   └── users.json   # User profiles
├── pending/         # Pending case queue
├── analytics/       # Event logs
├── challenges.json
├── notifications.json
└── feedback.json
```

---

## Accessing Production

To test against production backend:

1. In `client/src/services/api.ts`, temporarily change:
   ```typescript
   export const API_BASE = 'https://api.misdiagnose.in/api';
   ```

2. Run client only:
   ```bash
   npm run dev:client
   ```

**Don't commit this change!**
