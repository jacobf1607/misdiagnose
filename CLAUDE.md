# Project Context for Claude Code

**Last Updated:** January 7, 2026

## Quick Start for New Sessions

When starting a new Claude Code session, read this file first and then the files in `docs/` folder for full context.

---

## Project Overview

**Misdiagnose** - A medical diagnosis training game with AI-powered case generation.

Players diagnose virtual patients by asking questions, ordering tests, and performing examinations. Features include:
- Guest mode (play without login)
- Firebase phone OTP authentication
- Two game modes: Standard (untimed) and Blitz (2-minute timer)
- Challenge system (compete with friends)
- Pre-generated case pool with background generation
- RAG-enhanced medical knowledge

---

## Architecture

| Service | Directory | Tech Stack | Port (Dev) |
|---------|-----------|------------|------------|
| **Frontend** | `client/` | React + Vite + TypeScript | 3000 |
| **Backend** | `server/` | Express + TypeScript | 3005 |
| **RAG Service** | `rag_textbook/` | Python FastAPI | 3006 |

---

## Production URLs (Railway + Custom Domain)

### Custom Domain (GoDaddy)
- **Frontend**: https://misdiagnose.in / https://www.misdiagnose.in
- **Backend API**: https://api.misdiagnose.in
- **RAG**: Public URL (see below)

### Railway URLs (Fallback)
- **Frontend**: https://lovely-elegance-production.up.railway.app
- **Backend**: https://extraordinary-connection-production.up.railway.app
- **RAG**: https://misdiagnose-production.up.railway.app

### GitHub
- **Repo**: https://github.com/jacobf1607/misdiagnose
- **Auto-deploys** on push to main

---

## Environment Variables

### Backend (Railway)
```
NODE_ENV=production
PORT=3005
AI_PROVIDER=hybrid
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-proj-...
RAG_API_URL=https://misdiagnose-production.up.railway.app  # Public URL, NOT internal
ENABLE_BACKGROUND_GENERATION=true
FRONTEND_URL=https://misdiagnose.in
```

### Frontend (Railway)
```
VITE_API_URL=  # Empty - hardcoded fallback in api.ts
```

**Note**: Frontend uses hardcoded `https://api.misdiagnose.in/api` in `client/src/services/api.ts`

---

## Key Files

### API Configuration
- `client/src/services/api.ts` - API_BASE URL (hardcoded for production)
  - **IMPORTANT**: All fetch calls must use `API_BASE` from this file, not relative `/api/` paths

### Authentication
- `client/src/contexts/AuthContext.tsx` - Firebase auth + user profile management
  - Distinguishes 404 (user not found) from network errors
  - Network errors do NOT create new users (protection against data loss)

### Data Storage (server/src/data/ or /app/dist/data on Railway)
```
data/
├── cases/           # Pre-generated case JSON files + pool-index.json
├── users/
│   └── users.json   # User profiles and case history (PROTECTED)
├── pending/         # Pending case generation queue
├── analytics/       # Session and event tracking
├── challenges.json  # Friend challenges
├── notifications.json
└── feedback.json
```

### Case Generation System
- `server/src/services/casePoolManager.ts` - Pool allocation and replenishment
- `server/src/services/pendingCaseManager.ts` - Fault-tolerant pending queue
- `server/src/services/backgroundGenerator.ts` - Auto-generation logic

### Docker/Deployment
- `server/Dockerfile` - Uses entrypoint.sh for volume support
- `server/entrypoint.sh` - Handles first-boot initialization, **NEVER overwrites users.json**
- `rag_textbook/Dockerfile` - Python service

---

## Case Generation System

### Three-Phase Generation
Cases are generated in phases for fault tolerance:

1. **Phase 1**: Generate case JSON (patient, diagnoses, tests, exams)
2. **Phase 2**: Generate ideal diagnostic pathway
3. **Phase 3**: Generate pre-computed explanations for all 10 diagnoses

### Trigger Logic
```
IF min(unseen cases per active user) < 10:
    needed = 20 - min(unseen)

    IF pending queue has cases:
        Complete from pending (prioritize Phase 3 > Phase 2 > Phase 1)
    ELSE:
        Generate new Phase 1 cases
```

### Key Constants
- `MIN_CASES_PER_USER = 10` - Trigger threshold
- `TARGET_CASES_PER_USER = 20` - Target after generation
- `MAX_BATCH_SIZE = 10` - Max cases per cycle
- `ACTIVE_USER_DAYS = 7` - Only consider users active in last 7 days

---

## User Data Protection (3 Layers)

### 1. Frontend (AuthContext.tsx)
```typescript
// Returns { user, notFound, networkError } - NOT just null
// Network errors ≠ "user not found"
if (result.networkError) {
  setError('Unable to connect to server');
  // DO NOT set needsUsername - prevents accidental account creation
}
```

### 2. Backend (userService.ts)
- `createOrUpdateUser()` preserves existing user data
- Only updates `last_login`, never overwrites stats

### 3. Deployment (entrypoint.sh)
```shell
# NEVER copy users.json from backup
if [ ! -f "$USERS_FILE" ]; then
    echo '{"users":{}}' > $USERS_FILE  # Create empty, never copy
fi
```

---

## CORS Configuration

Custom domains are allowed in `server/src/index.ts`:
```typescript
origin: [
  process.env.FRONTEND_URL,
  /\.railway\.app$/,
  /\.up\.railway\.app$/,
  'https://misdiagnose.in',
  'https://www.misdiagnose.in'
]
```

---

## Common Issues & Solutions

### "API calls going to wrong URL"
All files must import and use `API_BASE` from `client/src/services/api.ts`.
Don't use relative `/api/` paths directly in fetch calls.

### "Case pool empty on Railway"
1. Check `ENABLE_BACKGROUND_GENERATION=true` env var
2. Check `/api/health` endpoint for pool status
3. Check Railway logs for generation errors

### "RAG service connection failed"
- Use **public URL** for `RAG_API_URL`, not internal Railway networking
- Current: `https://misdiagnose-production.up.railway.app`

### "Login not working / CORS error"
1. Verify custom domain is in CORS allowed origins
2. Add domain to Firebase authorized domains
3. Check browser console for specific error

### "User data lost after redeploy"
- Railway Volume must be mounted at `/app/dist/data`
- `users.json` should NEVER be overwritten (protected by entrypoint.sh)

### "Background generator not running"
Check `ENABLE_BACKGROUND_GENERATION` env var is set to `true` (lowercase string).

### "203 pending cases stuck"
Use `completeCasesFromPending(needed)` which processes only what's needed,
prioritizing cases closest to completion (Phase 3 > Phase 2 > Phase 1).

---

## Firebase Configuration

- **Project**: `misdiagnose-29956`
- **Auth Method**: Phone OTP
- **Authorized Domains**:
  - localhost
  - Railway frontend URL
  - misdiagnose.in
  - www.misdiagnose.in

---

## AI Provider Configuration

### Hybrid Mode (Default)
| Task Type | Provider | Model |
|-----------|----------|-------|
| Real-time (patient responses, tests, exams) | Groq | llama-3.1-8b-instant |
| Scoring/reasoning | Groq | openai/gpt-oss-120b |
| Background (case generation, explanations) | OpenAI | gpt-5.2 |
| Fallback | Claude | claude-3-5-haiku |

---

## Documentation Files

All detailed documentation is in the `docs/` folder:
- `docs/COMPREHENSIVE_DOCUMENTATION.md` - Full system documentation
- `docs/DEPLOYMENT.md` - Railway deployment guide
- `docs/API_ENDPOINTS.md` - API reference
- `docs/STARTUP.md` - Local development guide

---

## Scripts & CLI Tools

```bash
# Development
npm run dev              # Start client + server
npm run dev:client       # Client only
npm run dev:server       # Server only

# Case Management
npm run generate-cases   # Generate new cases
npm run set-test-user <uid>  # Mark user as test account

# Build
npm run build            # Build all
npm run build:client     # Client only
npm run build:server     # Server only
```

---

## Future Considerations

### Database Migration (When Ready)
Current JSON file storage works for small scale. Consider PostgreSQL when:
- Multiple server instances needed
- Complex queries required (leaderboards, analytics)
- Guaranteed consistency needed
- Race condition elimination required

Migration effort: ~2-3 days with Prisma ORM.
