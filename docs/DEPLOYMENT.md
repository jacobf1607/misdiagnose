# Misdiagnose - Railway Deployment Guide

**Last Updated:** January 7, 2026

This guide walks you through deploying Misdiagnose to Railway with custom domain setup.

## Prerequisites

1. **GitHub Account** - Your code needs to be in a GitHub repository
2. **Railway Account** - Sign up at https://railway.app (use GitHub login)
3. **Custom Domain** (optional) - e.g., from GoDaddy
4. **API Keys**:
   - Anthropic API Key
   - Groq API Key
   - OpenAI API Key

## Architecture Overview

| Service | Directory | Purpose | Port |
|---------|-----------|---------|------|
| **Frontend** | `client/` | React UI | 3000 |
| **Backend** | `server/` | Express API | 3005 |
| **RAG Service** | `rag_textbook/` | Python ML API | 3006 |

## Current Production Setup

### Custom Domain (GoDaddy → Railway)
- **Frontend**: https://misdiagnose.in, https://www.misdiagnose.in
- **Backend API**: https://api.misdiagnose.in
- **RAG**: https://misdiagnose-production.up.railway.app (public, no custom domain)

### Railway Service Names
- Frontend: `lovely-elegance-production`
- Backend: `extraordinary-connection-production`
- RAG: `misdiagnose-production`

---

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/misdiagnose.git
git branch -M main
git push -u origin main
```

## Step 2: Create Railway Project

1. Go to https://railway.app and log in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Find and select your `misdiagnose` repository

## Step 3: Deploy RAG Service (Python)

1. In Railway dashboard, click **"+ New"** → **"GitHub Repo"**
2. Select your repo, set root directory: `rag_textbook`
3. Railway will auto-detect Python

### RAG Service Settings:
- **Name**: `rag-service`
- **Start Command**: `python api.py`
- **No environment variables needed** (uses embedded model)

### Add Volume (Optional):
- Mount path: `/app/data` for FAISS index persistence

## Step 4: Deploy Backend (Node.js)

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repo, set root directory: `server`

### Backend Environment Variables:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3005` |
| `AI_PROVIDER` | `hybrid` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `GROQ_API_KEY` | `gsk_...` |
| `OPENAI_API_KEY` | `sk-proj-...` |
| `RAG_API_URL` | `https://your-rag-service.up.railway.app` |
| `ENABLE_BACKGROUND_GENERATION` | `true` |
| `FRONTEND_URL` | `https://misdiagnose.in` |

**IMPORTANT**: Use the **public URL** for `RAG_API_URL`, not internal Railway networking.

### Add Volume for Data Persistence:
1. Go to **"Volumes"** tab
2. Click **"+ New Volume"**
3. Mount path: `/app/dist/data`
4. This persists users, cases, challenges

## Step 5: Deploy Frontend (React)

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repo, set root directory: `client`

### Frontend Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | (leave empty - hardcoded in api.ts) |

**Note**: The frontend has a hardcoded fallback in `client/src/services/api.ts`:
```typescript
export const API_BASE = import.meta.env.VITE_API_URL || 'https://api.misdiagnose.in/api';
```

---

## Custom Domain Setup (GoDaddy)

### For Frontend (misdiagnose.in)

1. In Railway, go to Frontend service → **Settings** → **Networking**
2. Add custom domain: `www.misdiagnose.in`
3. In GoDaddy DNS:
   - Add CNAME: `www` → Railway's provided target
4. For root domain (misdiagnose.in):
   - GoDaddy doesn't allow CNAME at root
   - Use **Domain Forwarding**: Forward `misdiagnose.in` to `https://www.misdiagnose.in`

### For Backend API (api.misdiagnose.in)

1. In Railway, go to Backend service → **Settings** → **Networking**
2. Add custom domain: `api.misdiagnose.in`
3. In GoDaddy DNS:
   - Add CNAME: `api` → Railway's provided target

### Verify DNS Propagation
```bash
nslookup www.misdiagnose.in
nslookup api.misdiagnose.in
```

---

## Firebase Configuration

Add authorized domains in Firebase Console:
1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add:
   - `misdiagnose.in`
   - `www.misdiagnose.in`
   - Your Railway frontend URL

---

## CORS Configuration

The backend (`server/src/index.ts`) allows these origins:
```typescript
origin: [
  process.env.FRONTEND_URL,
  /\.railway\.app$/,
  /\.up\.railway\.app$/,
  'https://misdiagnose.in',
  'https://www.misdiagnose.in'
]
```

If adding a new domain, update this list.

---

## Persistent Storage

### Volume Mount Points
- Backend: `/app/dist/data` (users, cases, challenges)
- RAG: `/app/data` (FAISS index)

### Data Protection
The `server/entrypoint.sh` script:
- Creates data directories on first boot
- **NEVER overwrites users.json** from backup
- Initializes cases from `/app/data-init` only if missing

---

## Verify Deployment

1. **RAG Service**: `GET https://your-rag.up.railway.app/health`
   - Should return: `{"status": "ok", "chunks_loaded": 40000+}`

2. **Backend**: `GET https://api.misdiagnose.in/api/health`
   - Should return pool status, generator status, AI provider info

3. **Frontend**: Visit https://misdiagnose.in
   - Should show the login/guest mode screen

---

## Troubleshooting

### CORS errors
- Verify domain is in CORS allowed origins
- Check `FRONTEND_URL` env var
- Make sure URL includes `https://`

### RAG service connection failed
- Use **public URL**, not internal Railway networking
- Internal networking (`*.railway.internal`) can be unreliable

### Firebase auth not working
- Verify domain is added to Firebase authorized domains
- Check browser console for specific error

### Cases not generating
- Check `ENABLE_BACKGROUND_GENERATION=true`
- Verify API keys are correct
- Check backend logs: Railway Dashboard → Service → Logs

### User data lost
- Ensure Volume is mounted at `/app/dist/data`
- Check that `entrypoint.sh` is being used (Dockerfile CMD)
- Users.json should never be overwritten from backup

---

## Estimated Costs

| Service | RAM | Est. Monthly Cost |
|---------|-----|-------------------|
| RAG Service | ~800MB | $5-8 |
| Backend | ~150MB | $2-3 |
| Frontend | ~50MB | $1 |
| Volume | 1GB | $0.25 |
| **Total** | | **~$8-12/month** |

---

## Quick Reference

### Environment Variables Summary

```bash
# Backend (Railway)
NODE_ENV=production
PORT=3005
AI_PROVIDER=hybrid
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-proj-...
RAG_API_URL=https://misdiagnose-production.up.railway.app
ENABLE_BACKGROUND_GENERATION=true
FRONTEND_URL=https://misdiagnose.in

# Frontend (Railway) - leave empty
VITE_API_URL=
```

### Useful Endpoints
- Health: `GET /api/health`
- AI Status: `GET /api/ai-status`
- Pool Status: `GET /api/game/pool/status`
