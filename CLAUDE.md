# Project Context for Claude Code

## Project Overview
Misdiagnose - A medical diagnosis training game with AI-powered case generation.

## Architecture
- **Frontend (client/)**: React + Vite, deployed on Railway
- **Backend (server/)**: Express + TypeScript, deployed on Railway
- **RAG Service (rag_textbook/)**: Python FastAPI, deployed on Railway

## Deployment (Railway)

### Service URLs
- **Frontend**: https://lovely-elegance-production.up.railway.app
- **Backend**: https://extraordinary-connection-production.up.railway.app
- **RAG**: Internal only (misdiagnose.railway.internal)

### GitHub Repo
- https://github.com/jacobf1607/misdiagnose
- Auto-deploys on push to main

### Backend Environment Variables (Railway)
- `ENABLE_BACKGROUND_GENERATION=true` - Enables auto case generation
- `GROQ_API_KEY` - For LLM calls
- `OPENAI_API_KEY` - For LLM calls
- `PORT` - Set automatically by Railway

### Frontend Environment Variables (Railway)
- `VITE_API_URL` - Should be empty (hardcoded fallback in api.ts)

### Persistent Storage
- Backend has a Railway Volume mounted at `/app/dist/data`
- This persists: user data, case pool, analytics, challenges, notifications
- Entrypoint script (`server/entrypoint.sh`) handles first-boot initialization

## Key Files

### API Configuration
- `client/src/services/api.ts` - API_BASE URL (hardcoded fallback for production)
- All fetch calls must use `API_BASE` from this file, not relative `/api/` paths

### Data Storage (server/src/data/)
- `cases/` - Pregenerated medical cases
- `users/users.json` - User profiles and case history
- `analytics/` - Session and event tracking
- `challenges.json` - Friend challenges
- `notifications.json` - User notifications
- `feedback.json` - User feedback

### Docker
- `server/Dockerfile` - Uses entrypoint.sh for volume support
- `rag_textbook/Dockerfile` - Python service

## Common Issues

### "API calls going to wrong URL"
All files must import and use `API_BASE` from `client/src/services/api.ts`.
Don't use relative `/api/` paths directly in fetch calls.

### "Case pool empty on Railway"
The Dockerfile copies `src/data` to `dist/data`. If using a volume, the entrypoint
script copies initial data from `/app/data-init` on first boot.

### "Background generator not running"
Check `ENABLE_BACKGROUND_GENERATION` env var is set to `true` (lowercase).

### "Data lost after redeploy"
Ensure Railway Volume is mounted at `/app/dist/data`.

## Firebase
- Auth configured for phone OTP login
- Authorized domains include the Railway frontend URL
