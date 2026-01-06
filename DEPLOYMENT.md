# Misdiagnose - Railway Deployment Guide

This guide walks you through deploying Misdiagnose to Railway.

## Prerequisites

1. **GitHub Account** - Your code needs to be in a GitHub repository
2. **Railway Account** - Sign up at https://railway.app (use GitHub login)
3. **API Keys** (you should already have these):
   - Anthropic API Key
   - Groq API Key
   - OpenAI API Key

## Architecture Overview

Misdiagnose has 3 services that need to be deployed:

| Service | Directory | Purpose | Port |
|---------|-----------|---------|------|
| **Frontend** | `client/` | React UI | 3000 |
| **Backend** | `server/` | Express API | 3005 |
| **RAG Service** | `rag_textbook/` | Python ML API | 3006 |

## Step 1: Push to GitHub

If you haven't already, create a GitHub repository and push your code:

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit for Railway deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/misdiagnose.git
git branch -M main
git push -u origin main
```

## Step 2: Create Railway Project

1. Go to https://railway.app and log in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Find and select your `misdiagnose` repository
5. Railway will detect it's a monorepo

## Step 3: Deploy RAG Service (Python)

1. In Railway dashboard, click **"+ New"** → **"GitHub Repo"**
2. Select your repo again
3. Click **"Add Root Directory"** and enter: `rag_textbook`
4. Railway will auto-detect Python

### RAG Service Settings:
- **Name**: `rag-service`
- **Start Command**: `python api.py`
- **No environment variables needed** (uses embedded model)

### Add Volume for RAG Data:
1. Click on the RAG service
2. Go to **"Volumes"** tab
3. Click **"+ New Volume"**
4. Mount path: `/app/data`
5. This persists the FAISS index

## Step 4: Deploy Backend (Node.js)

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repo
3. Set root directory: `server`

### Backend Environment Variables:

Click on the service → **"Variables"** tab → Add these:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3005` |
| `AI_PROVIDER` | `hybrid` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (your key) |
| `GROQ_API_KEY` | `gsk_...` (your key) |
| `OPENAI_API_KEY` | `sk-proj-...` (your key) |
| `RAG_API_URL` | `http://rag-service.railway.internal:3006` |
| `ENABLE_BACKGROUND_GENERATION` | `true` |
| `FRONTEND_URL` | (set after frontend deploys) |

### Add Volume for Server Data:
1. Go to **"Volumes"** tab
2. Click **"+ New Volume"**
3. Mount path: `/app/src/data`
4. This persists users, cases, challenges

## Step 5: Deploy Frontend (React)

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repo
3. Set root directory: `client`

### Frontend Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | (your backend URL, e.g., `https://misdiagnose-server.up.railway.app/api`) |

### Get the Backend URL:
1. Click on your backend service
2. Go to **"Settings"** → **"Networking"**
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `https://misdiagnose-server-production.up.railway.app`)
5. Use this URL with `/api` suffix for `VITE_API_URL`

## Step 6: Configure Networking

### Internal Networking (Service-to-Service):
Railway provides internal URLs for service communication:
- RAG service internal URL: `http://rag-service.railway.internal:3006`
- Use this for `RAG_API_URL` in backend

### Public Domains:
1. For each service that needs public access (Backend, Frontend):
2. Go to **"Settings"** → **"Networking"**
3. Click **"Generate Domain"**

## Step 7: Update Firebase

Add your new domain to Firebase authorized domains:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`misdiagnose-29956`)
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Click **"Add domain"**
5. Add your Railway frontend domain (e.g., `misdiagnose-client.up.railway.app`)

## Step 8: Update Backend CORS

After frontend deploys, update the backend's `FRONTEND_URL` variable:
1. Click on backend service
2. Go to **"Variables"**
3. Set `FRONTEND_URL` to your frontend URL

## Step 9: Verify Deployment

1. **RAG Service**: Visit `https://your-rag-service.up.railway.app/health`
   - Should return: `{"status": "ok", "chunks_loaded": 40000+}`

2. **Backend**: Visit `https://your-backend.up.railway.app/api/health`
   - Should return: `{"status": "ok", ...}`

3. **Frontend**: Visit your frontend URL
   - Should show the Misdiagnose login page

## Troubleshooting

### "Module not found" errors
- Check that root directory is set correctly for each service

### CORS errors
- Verify `FRONTEND_URL` is set correctly in backend
- Make sure the URL includes `https://`

### Firebase auth not working
- Verify domain is added to Firebase authorized domains
- Check browser console for specific error

### RAG service slow to start
- First startup loads the ML model (~30 seconds)
- Subsequent restarts are faster due to caching

### Cases not generating
- Check `ENABLE_BACKGROUND_GENERATION=true`
- Verify API keys are correct
- Check backend logs in Railway dashboard

## Estimated Costs

| Service | RAM | Est. Monthly Cost |
|---------|-----|-------------------|
| RAG Service | ~800MB | $5-8 |
| Backend | ~150MB | $2-3 |
| Frontend | ~50MB | $1 |
| **Total** | | **~$8-12/month** |

## Custom Domain (Optional)

1. Go to your frontend service → **"Settings"** → **"Networking"**
2. Click **"+ Custom Domain"**
3. Enter your domain (e.g., `misdiagnose.com`)
4. Add the CNAME record to your DNS provider
5. Railway handles SSL automatically

---

## Quick Reference

### Service URLs Pattern
- Frontend: `https://misdiagnose-client-production.up.railway.app`
- Backend: `https://misdiagnose-server-production.up.railway.app`
- RAG: Internal only (`http://rag-service.railway.internal:3006`)

### Key Environment Variables
```
# Backend
NODE_ENV=production
AI_PROVIDER=hybrid
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-proj-...
RAG_API_URL=http://rag-service.railway.internal:3006
ENABLE_BACKGROUND_GENERATION=true
FRONTEND_URL=https://your-frontend.up.railway.app

# Frontend
VITE_API_URL=https://your-backend.up.railway.app/api
```

---

**Need help?** Check Railway's documentation at https://docs.railway.app
