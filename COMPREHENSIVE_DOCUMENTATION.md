# MISDIAGNOSE - COMPREHENSIVE SYSTEM DOCUMENTATION

**Last Updated:** January 5, 2026
**Version:** 3.0.0
**Project:** Misdiagnose - Medical Deduction Game with RAG Integration
**Architecture:** Full-Stack TypeScript + Python RAG Service + Firebase Auth
**Primary Languages:** TypeScript (Frontend & Backend), Python (RAG Service)

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Directory Structure](#4-directory-structure)
5. [Authentication System](#5-authentication-system)
6. [User Management & Case History](#6-user-management--case-history)
7. [Case Pool System](#7-case-pool-system)
8. [Game Modes](#8-game-modes)
9. [Game Flow & Mechanics](#9-game-flow--mechanics)
10. [Challenge System](#10-challenge-system)
11. [Feedback System](#11-feedback-system)
12. [Notification System](#12-notification-system)
13. [Data Models & Type System](#13-data-models--type-system)
14. [Frontend Architecture](#14-frontend-architecture)
15. [Backend Architecture](#15-backend-architecture)
16. [RAG System](#16-rag-system)
17. [Scoring System](#17-scoring-system)
18. [Coaching & Feedback System](#18-coaching--feedback-system)
19. [Analytics & Telemetry](#19-analytics--telemetry)
20. [API Reference](#20-api-reference)
21. [Scripts & CLI Tools](#21-scripts--cli-tools)
22. [Environment Setup](#22-environment-setup)
23. [Running the Application](#23-running-the-application)
24. [Mobile Responsiveness](#24-mobile-responsiveness)

---

## 1. PROJECT OVERVIEW

### What is Misdiagnose?

Misdiagnose is an **interactive, AI-powered medical diagnosis educational game** where players take the role of physicians diagnosing patients. The game combines:

- **Intelligent Patient Roleplay** via Claude Sonnet LLM
- **Medical Knowledge Grounding** via Retrieval-Augmented Generation (RAG)
- **Sophisticated Scoring System** with 5-component evaluation
- **Adaptive Feedback** through coaching analysis
- **User Authentication** via Firebase Phone OTP (or Guest Mode)
- **Case History Tracking** for learning progress with detailed review
- **Pre-generated Case Pool** for faster gameplay
- **Test Mode** for development/testing accounts
- **Game Modes** - Standard (untimed) and Blitz (2-minute timer)
- **Challenge System** - Share cases with friends and compete
- **Mobile-Responsive Design** - Full mobile support with bottom navigation

### Core Gameplay Loop

1. **Entry**: User can play as Guest or Login via phone number + OTP (Firebase)
2. **Dashboard**: View stats, case history, start new game
3. **Mode Selection**: Choose Standard or Blitz (2-minute) mode
4. **Patient Presentation**: Game starts with a patient persona and initial complaint
5. **Diagnostic Process**: Player can:
   - Ask free-form questions (evaluated for quality by Claude)
   - Perform physical examinations (single or batch via free-text)
   - Order medical tests (single or batch via free-text)
6. **Diagnosis Submission**: Player selects from 10 possible diagnoses (or timeout in Blitz)
7. **Scoring & Analysis**:
   - Multi-component score breakdown (time, budget, efficiency, accuracy, reasoning)
   - Grade assignment (S, A, B, C, D, F)
   - Detailed feedback with diagnosis explanations (pre-computed for speed)
8. **Challenge Friends**: Create shareable challenge link after completing a case
9. **Coaching**: Detailed comparison against textbook ideal diagnostic pathway
10. **History**: Case result saved to user's profile for detailed review

### Key Features Summary

| Feature | Description | Status |
|---------|-------------|--------|
| Guest Mode | Play without login (no history saved) | Done |
| Firebase Phone Auth | OTP-based login for users | Done |
| User Profiles | Username, phone, case history | Done |
| Case Pool | Pre-generated cases for fast loading | Done |
| Background Generator | Auto-replenish case pool | Done |
| Test Mode | Special mode for test/dev accounts | Done |
| **Standard Mode** | Untimed gameplay for learning | Done |
| **Blitz Mode** | 2-minute time limit with visual timer | Done |
| Free-text Batch Tests | Order multiple tests at once | Done |
| Free-text Batch Exams | Perform multiple exams at once | Done |
| Pre-computed Explanations | Instant diagnosis feedback | Done |
| Diagnosis Explanations | AI explains correct/incorrect diagnosis | Done |
| Structured Coaching UI | Organized feedback with headers/sections | Done |
| Case History Dashboard | View past cases, stats, accuracy | Done |
| **Past Cases Page** | Full history with filters and search | Done |
| **Case Detail Modal** | Review past cases with full context | Done |
| **Challenge System** | Challenge friends via shareable URLs | Done |
| **Leaderboards** | Multiple people can play challenges | Done |
| **Notifications** | Get notified of challenge results | Done |
| **Feedback System** | Submit feedback from anywhere in app | Done |
| **Feedback Dashboard** | Admin view for managing feedback | Done |
| **Mobile Design** | Full mobile support with bottom nav | Done |
| **Analytics** | Track user behavior and performance | Done |

---

## 2. SYSTEM ARCHITECTURE

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Port 5173)                          │
│                                                                          │
│  React Application (TypeScript/Vite)                                     │
│  ├─ AuthProvider (Firebase Phone Auth + Guest Mode)                      │
│  ├─ ProtectedRoute (Auth Guard)                                          │
│  ├─ Dashboard (Stats, History, Start Game, Past Cases)                   │
│  ├─ PastCasesPage (Full history with filters)                            │
│  ├─ ChallengePage (Challenge landing and leaderboard)                    │
│  ├─ FeedbackDashboard (Admin feedback management)                        │
│  ├─ GameContent (Main Game Interface)                                    │
│  │   ├─ GameModeSelector (Standard/Blitz selection)                      │
│  │   ├─ BlitzTimer (Countdown with audio alerts)                         │
│  │   ├─ PersonaCard (Collapsible on mobile)                              │
│  │   ├─ DiagnosisList                                                    │
│  │   ├─ ChatInterface (Interview Tab)                                    │
│  │   ├─ ExaminationPanel (Exam Tab - supports batch)                     │
│  │   ├─ TestPanel (Tests Tab - supports batch)                           │
│  │   ├─ GameOverModal (Score + Explanations + Challenge)                 │
│  │   ├─ CoachingModal (Pathway Feedback)                                 │
│  │   ├─ ShareModal (Challenge link sharing)                              │
│  │   └─ CaseDetailModal (Past case review)                               │
│  ├─ FeedbackButton (Floating feedback form)                              │
│  ├─ NotificationDropdown (Challenge notifications)                       │
│  └─ Services (api.ts, firebase.ts, analytics.ts)                         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                        HTTP Requests
                        /api/game/*, /api/user/*, /api/challenge/*,
                        /api/feedback/*, /api/notifications/*
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                     SERVER LAYER (Port 3001)                             │
│                     Express.js + TypeScript                              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Routes                                                              │ │
│  │ ├─ /api/game/* (Game operations)                                   │ │
│  │ │   ├─ POST /new (allocates from pool, supports mode selection)    │ │
│  │ │   ├─ POST /:id/ask, /test, /exam, /diagnose                      │ │
│  │ │   ├─ POST /:id/batch-tests, /batch-exams (free-text)             │ │
│  │ │   ├─ POST /:id/timeout (blitz mode timeout)                      │ │
│  │ │   ├─ GET /:id/coaching                                           │ │
│  │ │   └─ GET /pool/status, /pool/test-cases                          │ │
│  │ ├─ /api/user/* (User operations)                                   │ │
│  │ │   ├─ GET /:uid, POST / (create/update)                           │ │
│  │ │   └─ GET /:uid/history (case history with detailed data)         │ │
│  │ ├─ /api/challenge/* (Challenge system)                             │ │
│  │ │   ├─ POST / (create challenge)                                   │ │
│  │ │   ├─ GET /:id (get challenge info)                               │ │
│  │ │   ├─ POST /:id/start (start challenge game)                      │ │
│  │ │   ├─ POST /:id/complete (submit challenge result)                │ │
│  │ │   └─ GET /user/:userId (get user's challenges)                   │ │
│  │ ├─ /api/feedback/* (Feedback system)                               │ │
│  │ │   ├─ POST / (submit feedback)                                    │ │
│  │ │   ├─ GET / (get all feedback - admin)                            │ │
│  │ │   ├─ PATCH /:id/status (update status)                           │ │
│  │ │   └─ DELETE /:id (delete feedback)                               │ │
│  │ ├─ /api/notifications/* (Notification system)                      │ │
│  │ │   ├─ GET /:userId (get notifications)                            │ │
│  │ │   ├─ POST /:id/read (mark as read)                               │ │
│  │ │   └─ POST /:userId/read-all (mark all as read)                   │ │
│  │ └─ /api/telemetry/* (Analytics)                                    │ │
│  │     └─ POST /event (log analytics event)                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Services                                                            │ │
│  │ ├─ gameEngine.ts (In-memory game state, mode support)              │ │
│  │ ├─ openai.ts (Claude API - patient responses, case generation)     │ │
│  │ ├─ ragService.ts (RAG API client)                                  │ │
│  │ ├─ casePoolManager.ts (Pre-generated case pool)                    │ │
│  │ ├─ backgroundGenerator.ts (Auto-replenish pool)                    │ │
│  │ ├─ userService.ts (User CRUD, case history with details)           │ │
│  │ ├─ challengeService.ts (Challenge CRUD, notifications)             │ │
│  │ ├─ feedbackService.ts (Feedback CRUD)                              │ │
│  │ └─ analyticsService.ts (Event logging)                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Scoring & Coaching                                                  │ │
│  │ ├─ scoring/engine.ts (5-component scoring)                         │ │
│  │ ├─ scoring/config.ts (Weights, test costs)                         │ │
│  │ └─ coaching/coachingEngine.ts (Pathway comparison)                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Data Storage:                                                           │
│  ├─ server/src/data/cases/ (pool-index.json, case_*.json)              │
│  ├─ server/src/data/users/users.json                                    │
│  ├─ server/src/data/challenges.json                                     │
│  ├─ server/src/data/notifications.json                                  │
│  └─ server/src/data/feedback.json                                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                          HTTP Requests
                       (http://localhost:3006)
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                      RAG SERVICE LAYER (Port 3006)                       │
│                      FastAPI + Python                                    │
│                                                                          │
│  ├─ POST /search, /domain-search, /disease-info                         │
│  ├─ POST /case-context, /ideal-pathway                                  │
│  ├─ FAISS Vector Index (~40,000 medical chunks)                         │
│  └─ Embedding Model: all-mpnet-base-v2 (384-dim)                        │
│                                                                          │
│  Knowledge Base: Exam Preparatory Manual for Undergraduates Medicine    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Data Flows

#### 1. Guest vs Authentication Flow
```
User lands on app →
Option A: "Continue as Guest" → Play immediately (no history saved)
Option B: Enter phone number → Firebase sends OTP → User enters OTP →
  Firebase verifies → If new user: set username → Backend creates user profile →
  AuthContext stores session → Dashboard loads with user data
```

#### 2. New Game Flow (with Mode Selection)
```
User clicks "Start New Case" →
GameModeSelector shows (Standard/Blitz) →
User selects mode →
POST /api/game/new { userId, mode } →
casePoolManager.allocateCase():
  - Filter cases user hasn't seen
  - Pick random available case
  - If pool empty: generate fresh via Claude + RAG
  - Track usage (usedBy array)
→ gameEngine.createGame(mode) →
Return GameState (with startTime for blitz) to client
```

#### 3. Blitz Timeout Flow
```
BlitzTimer counts down →
At 0: handleBlitzTimeout() →
POST /api/game/:id/timeout { userId } →
  - Verify blitz mode and time elapsed
  - Calculate score (0 accuracy)
  - Save timeout to case history
→ Return ScoreBreakdown with timedOut: true →
GameOverModal displays timeout results
```

#### 4. Challenge Flow
```
Player completes case → GameOverModal shows "Challenge Friends" →
POST /api/challenge { caseId, score, grade, mode } →
Returns { challengeId, shareUrl } →
ShareModal shows with WhatsApp/copy options →

Friend receives link → /challenge/:id →
ChallengePage loads (shows challenger grade, leaderboard) →
Friend clicks "Accept Challenge" →
POST /api/challenge/:id/start →
Game starts with same case + mode →
Friend completes → POST /api/challenge/:id/complete →
Result shown with leaderboard position
```

---

## 3. TECHNOLOGY STACK

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework with hooks |
| TypeScript | 5.3.2 | Type safety |
| Vite | 5.0.8 | Build tool with HMR |
| Firebase | 12.7.0 | Phone authentication |
| CSS 3 | - | Component-scoped styling |
| Web Audio API | - | Blitz timer sound effects |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 16+ | JavaScript runtime |
| Express | 4.18.2 | Web framework |
| TypeScript | 5.3.2 | Type safety |
| Anthropic SDK | 0.71.2 | Claude API integration |
| UUID | 9.0.0 | Unique ID generation |
| ts-node-dev | 2.0.0 | Development with auto-reload |

### RAG Service (Python)
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.9+ | Backend language |
| FastAPI | 0.109.0 | REST API framework |
| FAISS | 1.8.0 | Vector similarity search |
| sentence-transformers | 2.2.0 | Text embeddings |
| PyTorch | 2.0.0 | Deep learning framework |

### External Services
| Service | Purpose |
|---------|---------|
| Firebase Auth | Phone number + OTP authentication |
| Anthropic Claude | LLM for patient roleplay, case generation, explanations |

---

## 4. DIRECTORY STRUCTURE

```
D:\misdiagnose\
│
├── COMPREHENSIVE_DOCUMENTATION.md      # This file
├── package.json                         # Root orchestration scripts
│
├── client/                              # React Frontend
│   ├── src/
│   │   ├── main.tsx                    # React entry point
│   │   ├── App.tsx                     # Main game component
│   │   ├── App.css                     # Global game styles
│   │   │
│   │   ├── components/
│   │   │   ├── auth/                   # Authentication components
│   │   │   │   ├── LoginPage.tsx       # Phone input + OTP flow
│   │   │   │   ├── PhoneInput.tsx      # Phone number entry
│   │   │   │   ├── OTPInput.tsx        # 6-digit OTP entry
│   │   │   │   ├── UsernameInput.tsx   # New user username setup
│   │   │   │   └── ProtectedRoute.tsx  # Auth guard wrapper
│   │   │   │
│   │   │   ├── ChatInterface.tsx       # Interview/questioning tab
│   │   │   ├── TestPanel.tsx           # Tests tab (single + batch)
│   │   │   ├── ExaminationPanel.tsx    # Exams tab (single + batch)
│   │   │   ├── DiagnosisList.tsx       # 10 diagnosis options
│   │   │   ├── PersonaCard.tsx         # Patient info (collapsible)
│   │   │   ├── GameOverModal.tsx       # Score + explanations + challenge
│   │   │   ├── CoachingModal.tsx       # Pathway feedback (structured)
│   │   │   ├── Header.tsx              # Top navigation bar
│   │   │   ├── LoadingOverlay.tsx      # Loading state
│   │   │   │
│   │   │   ├── GameModeSelector.tsx    # Standard/Blitz mode picker
│   │   │   ├── BlitzTimer.tsx          # Countdown timer with audio
│   │   │   ├── TurnTracker.tsx         # Turn count display
│   │   │   │
│   │   │   ├── ShareModal.tsx          # Challenge link sharing
│   │   │   ├── CaseDetailModal.tsx     # Past case review modal
│   │   │   ├── NotificationDropdown.tsx # Notification bell
│   │   │   │
│   │   │   ├── FeedbackButton.tsx      # Floating feedback button
│   │   │   ├── FeedbackModal.tsx       # Feedback submission form
│   │   │   └── FeedbackPrompt.tsx      # Contextual feedback prompt
│   │   │
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx         # Global auth state (+ guest mode)
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx           # Landing page with stats/history
│   │   │   ├── Dashboard.css
│   │   │   ├── PastCasesPage.tsx       # Full history with filters
│   │   │   ├── PastCasesPage.css
│   │   │   ├── ChallengePage.tsx       # Challenge landing & leaderboard
│   │   │   ├── ChallengePage.css
│   │   │   ├── FeedbackDashboard.tsx   # Admin feedback view
│   │   │   └── FeedbackDashboard.css
│   │   │
│   │   ├── services/
│   │   │   ├── api.ts                  # HTTP client to backend
│   │   │   └── firebase.ts             # Firebase auth configuration
│   │   │
│   │   └── utils/
│   │       ├── analytics.ts            # Analytics tracking
│   │       └── share.ts                # Share utilities
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                              # Express Backend
│   ├── src/
│   │   ├── index.ts                    # Server entry point
│   │   │
│   │   ├── routes/
│   │   │   ├── game.ts                 # Game API endpoints
│   │   │   ├── user.ts                 # User API endpoints
│   │   │   ├── challenge.ts            # Challenge API endpoints
│   │   │   ├── feedback.ts             # Feedback API endpoints
│   │   │   ├── notification.ts         # Notification API endpoints
│   │   │   └── analytics.ts            # Analytics API endpoints
│   │   │
│   │   ├── services/
│   │   │   ├── gameEngine.ts           # In-memory game state
│   │   │   ├── openai.ts               # Claude API integration
│   │   │   ├── ragService.ts           # RAG API client
│   │   │   ├── casePoolManager.ts      # Case pool management
│   │   │   ├── backgroundGenerator.ts  # Auto-replenishment
│   │   │   ├── userService.ts          # User CRUD operations
│   │   │   ├── challengeService.ts     # Challenge CRUD + notifications
│   │   │   ├── feedbackService.ts      # Feedback CRUD
│   │   │   └── analyticsService.ts     # Event logging
│   │   │
│   │   ├── scoring/
│   │   │   ├── engine.ts               # 5-component scoring logic
│   │   │   ├── config.ts               # Weights, costs, thresholds
│   │   │   ├── types.ts                # Scoring interfaces
│   │   │   └── index.ts                # Exports
│   │   │
│   │   ├── coaching/
│   │   │   ├── coachingEngine.ts       # Pathway comparison
│   │   │   └── index.ts                # Exports
│   │   │
│   │   ├── scripts/
│   │   │   ├── generateCases.ts        # CLI: Generate cases
│   │   │   └── setTestUser.ts          # CLI: Set test user status
│   │   │
│   │   └── data/
│   │       ├── cases/
│   │       │   ├── pool-index.json     # Case pool metadata
│   │       │   ├── case_*.json         # Pre-generated cases
│   │       │   └── sample.json         # Sample case
│   │       ├── users/
│   │       │   └── users.json          # User directory
│   │       ├── challenges.json         # Challenge data
│   │       ├── notifications.json      # Notification data
│   │       └── feedback.json           # Feedback data
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                            # ANTHROPIC_API_KEY
│
├── shared/                              # Shared Types
│   └── types.ts                        # All TypeScript interfaces
│
├── rag_textbook/                        # Python RAG Service
│   ├── api.py                          # FastAPI server
│   ├── ingest.py                       # Data pipeline
│   ├── rag/
│   │   ├── store.py                    # Vector DB operations
│   │   └── chunking.py                 # Text chunking
│   ├── data/
│   │   ├── faiss.index                 # Vector index
│   │   └── chunks.jsonl                # Chunk metadata
│   ├── .venv/                          # Python virtual environment
│   └── requirements.txt
│
└── textbooks/                           # Medical Knowledge Source
    └── Exam Preparatory Manual...       # PDF + TXT
```

---

## 5. AUTHENTICATION SYSTEM

### Overview

The app supports two authentication modes:

1. **Guest Mode** - Play immediately without logging in (case history not saved)
2. **Firebase Phone Auth** - OTP-based login with case history tracking

### Firebase Configuration

**File:** `client/src/services/firebase.ts`

```typescript
// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVMkbi7Bmulw9LnTlmZQ66ldBQCh_w9zs",
  authDomain: "misdiagnose-29956.firebaseapp.com",
  projectId: "misdiagnose-29956",
  // ... other config
};

// Key exports:
export function initRecaptcha(buttonId: string): RecaptchaVerifier
export async function sendOTP(phoneNumber: string): Promise<void>
export async function verifyOTP(otp: string): Promise<FirebaseUser>
export async function signOut(): Promise<void>
export { auth, FirebaseUser }
```

### Auth Context

**File:** `client/src/contexts/AuthContext.tsx`

Provides global authentication state and methods:

```typescript
interface AuthContextType {
  // State
  firebaseUser: FirebaseUser | null;    // Firebase auth user
  userProfile: UserProfile | null;       // App user profile (from backend)
  loading: boolean;                      // Initial auth check
  error: string | null;
  isTestUser: boolean;                   // Whether user is test/dev account
  isGuest: boolean;                      // Whether user is in guest mode

  // Auth flow state
  otpSent: boolean;
  otpLoading: boolean;
  needsUsername: boolean;                // New user needs to set username

  // Methods
  sendOTP: (phoneNumber: string, buttonId: string) => Promise<void>;
  verifyOTP: (otp: string) => Promise<void>;
  setUsername: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  resetAuthFlow: () => void;
  continueAsGuest: () => void;           // Enter guest mode
  exitGuestMode: () => void;             // Exit guest mode to show login
}
```

### Guest Mode

Users start in guest mode by default and can:
- Play cases immediately without login
- Choose game modes (Standard/Blitz)
- Get full scoring and feedback

**Limitations in Guest Mode:**
- Case history is not saved
- Cannot create/respond to challenges
- Cannot be notified of challenge results
- See "Login to Save Progress" prompt on dashboard

### Login UI Components

| Component | File | Purpose |
|-----------|------|---------|
| LoginPage | `components/auth/LoginPage.tsx` | Main login container |
| PhoneInput | `components/auth/PhoneInput.tsx` | Phone number with country code |
| OTPInput | `components/auth/OTPInput.tsx` | 6-digit OTP entry |
| UsernameInput | `components/auth/UsernameInput.tsx` | Username for new users |
| ProtectedRoute | `components/auth/ProtectedRoute.tsx` | Auth guard wrapper |

---

## 6. USER MANAGEMENT & CASE HISTORY

### User Profile Structure

**File:** `server/src/services/userService.ts`

```typescript
interface User {
  uid: string;              // Firebase UID
  phone_number: string;     // Full phone with country code
  username: string;         // Display name (3-20 chars, alphanumeric + underscore)
  created_at: number;       // Unix timestamp
  last_login: number;       // Unix timestamp
  is_test_user?: boolean;   // Test/dev account flag
  case_history?: CaseHistoryEntry[];  // Completed cases
}
```

### Case History Entry (Enhanced)

**File:** `shared/types.ts`

```typescript
interface CaseHistoryEntry {
  caseId: string;
  gameId: string;
  completedAt: number;
  domain: string;                           // cardiology, respiratory, etc.
  correctDiagnosis: string;
  submittedDiagnosis: string;
  wasCorrect: boolean;
  finalScore: number;                       // 0-100
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  questionCount: number;
  testsOrdered: number;
  examsPerformed: number;
  timeElapsedMinutes: number;
  mode: GameMode;                           // 'standard' or 'blitz'
  timedOut?: boolean;                       // True if blitz timeout

  // Detailed data for case review (new)
  persona?: {
    name: string;
    age: number;
    gender: string;
    occupation?: string;
  };
  initialComplaint?: string;
  chatHistory?: Array<{ role: string; content: string }>;
  testResults?: Array<{ name: string; result: string; isAbnormal: boolean }>;
  examResults?: Array<{ name: string; finding: string; isAbnormal: boolean }>;

  // Score breakdown & coaching data (new)
  scoreBreakdown?: {
    accuracy: number;
    efficiency: number;
    clinicalReasoning: number;
    testEconomy: number;
    time: number;
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
  };
  diagnosisExplanation?: {
    description: string;
    keySymptoms: string[];
    clinicalReasoning: string;
  };
  incorrectExplanation?: {
    whyIncorrect: string;
    keyDifferences: string[];
    missingFindings: string[];
  };
}
```

### Case History Response

```typescript
interface CaseHistoryResponse {
  history: CaseHistoryEntry[];  // Most recent first
  totalCases: number;
  correctCount: number;
  averageScore: number;         // Rounded to 1 decimal
}
```

### Storage

Users are stored in JSON file for simplicity:
- **Location:** `server/src/data/users/users.json`
- **Format:** `{ users: Record<string, User> }` (keyed by UID)
- **Limits:** Max 100 history entries per user

---

## 7. CASE POOL SYSTEM

### Overview

To reduce wait times, the game pre-generates medical cases and stores them in a pool. When a user starts a game, it allocates from the pool instead of generating on-the-fly.

### Pre-computed Diagnosis Explanations

Cases now include pre-computed explanations for all 10 diagnoses:

```typescript
interface PrecomputedDiagnosisExplanation {
  diagnosisId: string;
  diagnosisName: string;
  description: string;
  keySymptoms: string[];
  clinicalReasoning: string;
  // For incorrect diagnoses
  whyIncorrectForCase?: string;
  keyDifferencesFromCorrect?: string[];
  missingFindings?: string[];
}
```

This allows instant feedback after diagnosis submission instead of waiting for AI generation.

### Storage Structure

```
server/src/data/cases/
├── pool-index.json          # Metadata index
├── case_1704312345678.json  # Pre-generated case (with precomputedExplanations)
├── case_1704312345679.json
├── ...
└── sample.json              # Original sample (for testing)
```

### Pool Index Structure

**File:** `server/src/data/cases/pool-index.json`

```typescript
interface CasePoolIndex {
  version: string;                    // Schema version (e.g., "1.0.0")
  lastUpdated: number;                // Unix timestamp
  totalCases: number;
  availableCases: number;
  cases: CaseMetadata[];              // All case metadata
  generationSettings: {
    minPoolSize: number;              // Trigger auto-gen below this (default: 2)
    targetPoolSize: number;           // Generate up to this (default: 10)
    domainsEnabled: string[];         // Medical domains to use
  };
}
```

### Case Metadata

```typescript
interface CaseMetadata {
  caseId: string;                     // e.g., "case_1704312345678"
  filename: string;                   // e.g., "case_1704312345678.json"
  domain: string;                     // cardiology, respiratory, etc.
  correctDiagnosis: string;           // Name of correct diagnosis
  status: 'available' | 'in_use';     // (in_use is deprecated)
  createdAt: number;
  usedBy: string[];                   // User IDs who've seen this case
  usedCount: number;
  lastUsedAt?: number;
  hasIdealPathway: boolean;
}
```

---

## 8. GAME MODES

### Standard Mode

- **No time limit** - Take as much time as needed
- **Recommended for learning** - Focus on thoroughness over speed
- **Full scoring** - All components evaluated normally

### Blitz Mode

- **2-minute time limit** - Diagnose under pressure
- **Visual countdown timer** - Color-coded (green → yellow → orange → red)
- **Audio alerts**:
  - Warning beep at 30 seconds
  - Urgent beeps in last 10 seconds
  - Timeout sound when time expires
- **Timeout handling**:
  - If time runs out, accuracy score is 0
  - Other components still evaluated
  - Case saved with `timedOut: true`

### Game Mode Constants

**File:** `shared/types.ts`

```typescript
export type GameMode = 'standard' | 'blitz';

export const BLITZ_TIME_LIMIT_MS = 120000; // 2 minutes
export const BLITZ_GRACE_PERIOD_MS = 3000; // 3 second grace for network latency
```

### Mode Selection UI

**File:** `client/src/components/GameModeSelector.tsx`

Modal that appears before starting a game:
- **Standard Mode** card with "Recommended for new players" badge
- **Blitz Mode** card with "2 minute time limit" badge
- Click to select and start game

### Blitz Timer Component

**File:** `client/src/components/BlitzTimer.tsx`

- Visual progress bar with countdown
- Color transitions based on time remaining:
  - Green: > 60s remaining
  - Yellow: 30-60s remaining
  - Orange: 10-30s remaining
  - Red: < 10s remaining (with pulsing animation)
- Web Audio API for sound effects

---

## 9. GAME FLOW & MECHANICS

### Game States

```typescript
type GameStatus = 'in_progress' | 'won' | 'lost' | 'timeout';
```

### GameState Interface

```typescript
interface GameState {
  gameId: string;
  caseId: string;
  domain?: string;
  persona: Persona;
  initialComplaint: string;
  diagnoses: Diagnosis[];
  chatHistory: ChatMessage[];
  testResults: TestResult[];
  examResults: ExamResult[];
  status: GameStatus;
  score: number;
  questionScores: number[];
  selectedDiagnosisId?: string;
  correctDiagnosisId?: string;
  startTime?: number;          // Unix timestamp for blitz mode
  mode: GameMode;              // 'standard' or 'blitz'
  timeLimit?: number;          // Time limit in ms (blitz only)
}
```

### Tab System

The game interface has 3 tabs (4 on mobile including Diagnose):

| Tab | Component | Purpose |
|-----|-----------|---------|
| Interview | `ChatInterface.tsx` | Ask questions to patient |
| Examine | `ExaminationPanel.tsx` | Perform physical exams |
| Tests | `TestPanel.tsx` | Order medical tests |
| Diagnose | `DiagnosisList.tsx` | Submit final diagnosis (mobile only) |

### Asking Questions (Interview Tab)

```typescript
handleAskQuestion(question: string) →
POST /api/game/:id/ask { question } →
Claude generates patient response + scores quality (1-10) →
ChatHistory updated with exchange →
Display response in chat bubble
```

### Performing Examinations (Exam Tab)

**Single Exam:**
```typescript
handlePerformExam(examName: string) →
POST /api/game/:id/exam { examName } →
Claude generates finding based on case →
ExamResult added to state
```

**Batch Exams (Free-text):**
```typescript
handlePerformBatchExams(freeText: string) →
POST /api/game/:id/batch-exams { freeText } →
Claude parses free-text into exam list →
Validates each exam (returns errors for invalid) →
Generates findings for valid exams →
Returns: { results: ExamResult[], errors: ValidationError[] }
```

### Ordering Tests (Tests Tab)

**Single Test:**
```typescript
handleOrderTest(testName: string) →
POST /api/game/:id/test { testName } →
Claude generates result based on case →
TestResult added to state
```

**Batch Tests (Free-text):**
```typescript
handleOrderBatchTests(freeText: string) →
POST /api/game/:id/batch-tests { freeText } →
Claude parses free-text into test list →
Validates each test (returns errors for duplicates, invalid) →
Generates results for valid tests →
Returns: { results: TestResult[], errors: ValidationError[] }
```

### Submitting Diagnosis

```typescript
handleSubmitDiagnosis(diagnosisId: string) →
POST /api/game/:id/diagnose { diagnosisId, userId } →
Backend:
  1. Check if correct
  2. Calculate 5-component score
  3. Use pre-computed explanation (instant) or generate via Claude
  4. If challenge game: complete challenge and determine result
  5. Save to user's case history (with detailed data)
→ Return SubmitDiagnosisResponse →
GameOverModal displays results (with Challenge Friends option)
```

### Blitz Timeout

```typescript
// BlitzTimer countdown reaches 0
handleBlitzTimeout() →
POST /api/game/:id/timeout { userId } →
Backend:
  1. Verify blitz mode and time elapsed
  2. Calculate score with 0 accuracy
  3. Save to case history with timedOut: true
→ Return timeout response →
GameOverModal displays timeout results
```

---

## 10. CHALLENGE SYSTEM

### Overview

The challenge system allows players to share cases with friends and compete for the best score. Multiple people can respond to the same challenge.

### Challenge Structure

**File:** `shared/types.ts`

```typescript
interface Challenge {
  id: string;                          // Short unique ID (6 chars, URL-safe)
  caseId: string;                      // Which case to play (poolCaseId)
  caseDomain: string;                  // For display (e.g., "cardiology")
  gameMode: GameMode;                  // Challenged must play same mode

  // Challenger info
  challengerId: string;
  challengerName: string;
  challengerGrade: string;             // Shown before playing
  challengerScore: number;             // Hidden until completion

  // All responses (multiple people can respond)
  responses: ChallengeResponse[];

  // Status
  status: ChallengeStatus;             // 'active' or 'expired'

  // Timestamps
  createdAt: number;
  expiresAt: number;                   // 7 days from creation
}

interface ChallengeResponse {
  responseId: string;
  respondentUserId?: string;
  respondentName: string;
  respondentGrade: string;
  respondentScore: number;
  result: 'win' | 'lose' | 'tie';
  completedAt: number;
}
```

### Challenge Flow

1. **Create Challenge**: After completing a case, player clicks "Challenge Friends" in GameOverModal
2. **Share Link**: ShareModal shows with URL, message, and WhatsApp option
3. **Challenge Landing**: Friend opens `/challenge/:id` → ChallengePage shows:
   - Challenger's name and grade (score hidden)
   - Case domain
   - "Accept Challenge" button
   - Leaderboard (if others have played)
4. **Play Challenge**: Friend plays the same case with same mode
5. **Complete**: Result shown with win/lose/tie and score comparison
6. **Leaderboard**: All responses sorted by score

### Challenge Service

**File:** `server/src/services/challengeService.ts`

```typescript
// Create a new challenge
createChallenge(request: CreateChallengeRequest): Challenge

// Get challenge by ID (marks expired if needed)
getChallengeById(id: string): Challenge | null

// Check if user already responded
checkUserRespondedToChallenge(challenge: Challenge, userId: string): ChallengeResponse | null

// Check if user played this case before (not via challenge)
checkUserPlayedCase(userId: string, caseId: string, challengerScore: number): AlreadyPlayedResult | null

// Get case data for challenge
getChallengeCase(caseId: string): Case | null

// Add response when someone completes challenge
addChallengeResponse(challengeId: string, ...): { challenge, response, result } | null

// Get challenges created by user
getUserChallenges(userId: string): Challenge[]
```

### Challenge Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/challenge | Create new challenge |
| GET | /api/challenge/:id | Get challenge info |
| POST | /api/challenge/:id/start | Start playing challenge |
| POST | /api/challenge/:id/complete | Submit challenge result |
| GET | /api/challenge/user/:userId | Get user's challenges |

---

## 11. FEEDBACK SYSTEM

### Overview

Users can submit feedback from anywhere in the app. Feedback includes context about where/when it was submitted and optional case data.

### Feedback Structure

**File:** `shared/types.ts`

```typescript
type FeedbackStatus = 'unread' | 'important' | 'solved' | 'irrelevant';
type FeedbackContext = 'dashboard' | 'during_case' | 'after_case';

interface FeedbackEntry {
  id: string;
  createdAt: number;
  updatedAt: number;

  // Who submitted
  userId?: string;
  userEmail?: string;
  isTestUser: boolean;

  // Content
  feedbackText: string;
  context: FeedbackContext;

  // Case context (if during/after case)
  caseSnapshot?: FeedbackCaseSnapshot;

  // Status for triage
  status: FeedbackStatus;

  // Admin notes
  adminNotes?: string;
}

interface FeedbackCaseSnapshot {
  caseId: string;
  gameId: string;
  domain: string;
  correctDiagnosis: string;
  submittedDiagnosis?: string;
  wasCorrect?: boolean;
  score?: number;
  questionsAsked: number;
  testsOrdered: number;
  examsPerformed: number;
  timeElapsedMinutes: number;
  chatHistory?: Array<{ role: string; content: string }>;
  testResults?: Array<{ name: string; result: string; isAbnormal: boolean }>;
  examResults?: Array<{ name: string; finding: string; isAbnormal: boolean }>;
}
```

### Feedback Components

- **FeedbackButton**: Floating button in bottom-right corner with tooltip
- **FeedbackModal**: Modal form for entering feedback text
- **FeedbackDashboard**: Admin view for test users to manage feedback

### Feedback Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/feedback | Submit new feedback |
| GET | /api/feedback | Get all feedback (with optional status filter) |
| GET | /api/feedback/stats | Get feedback statistics |
| GET | /api/feedback/:id | Get specific feedback entry |
| PATCH | /api/feedback/:id/status | Update feedback status |
| DELETE | /api/feedback/:id | Delete feedback entry |

---

## 12. NOTIFICATION SYSTEM

### Overview

Users receive notifications when their challenges are completed by others.

### Notification Structure

```typescript
type NotificationType = 'challenge_completed' | 'challenge_received';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: {
    challengeId: string;
    challengerName?: string;
    challengedName?: string;
    winnerId?: string;
    winnerName?: string;
  };
  read: boolean;
  createdAt: number;
}
```

### Notification Generation

Notifications are created automatically when:
1. Someone completes a challenge → challenger gets notified
2. Logged-in respondent completes → they get a notification too

### Notification Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications/:userId | Get user's notifications |
| POST | /api/notifications/:id/read | Mark notification as read |
| POST | /api/notifications/:userId/read-all | Mark all as read |

---

## 13. DATA MODELS & TYPE SYSTEM

### Core Interfaces

**File:** `shared/types.ts`

#### Patient Persona
```typescript
interface Persona {
  name: string;
  age: number;
  gender: string;
  occupation: string;
  background: string;
  lifestyle: {
    activityLevel: "low" | "moderate" | "high";
    smoking: boolean | "unknown";
    alcohol: "none" | "social" | "heavy";
  };
  personalityTraits: string[];
}
```

#### Medical Case
```typescript
interface Case {
  id: string;
  persona: Persona;
  diagnoses: Diagnosis[];           // 10 possible diagnoses
  correctDiagnosisId: string;
  initialComplaint: string;
  medicalHistory: string;           // Hidden from player
  symptoms: string;                 // Hidden from player
  relevantFindings: string;         // Hidden from player
  redHerrings: string;              // Misleading info
  domain?: string;                  // Medical domain
  idealPathway?: IdealPathway;      // Textbook diagnostic approach
  precomputedExplanations?: PrecomputedDiagnosisExplanation[]; // Pre-generated for speed
}
```

#### Test/Exam Results
```typescript
interface TestResult {
  id: string;
  testName: string;
  result: string;
  timestamp: number;
  isAbnormal: boolean;
}

interface ExamResult {
  id: string;
  examName: string;
  finding: string;
  timestamp: number;
  isAbnormal: boolean;
}
```

#### Chat Message
```typescript
interface ChatMessage {
  id: string;
  role: "player" | "patient";
  content: string;
  timestamp: number;
  questionQuality?: number;  // 1-10, scored by Claude
}
```

---

## 14. FRONTEND ARCHITECTURE

### Component Hierarchy

```
App.tsx
└── AuthProvider
    └── ProtectedRoute
        └── GameContent
            ├── (Loading) → LoadingOverlay
            ├── (ChallengePage) → Header + ChallengePage
            ├── (FeedbackDashboard) → Header + FeedbackDashboard (test users)
            ├── (PastCasesPage) → Header + PastCasesPage
            ├── (Dashboard) → Header + Dashboard + FeedbackButton
            │                  └── GameModeSelector (modal)
            └── (In Game)
                ├── game-header
                │   ├── Back to Dashboard
                │   ├── Test Mode indicator (if test user)
                │   └── New Case button
                ├── BlitzTimer (if blitz mode)
                ├── game-board
                │   ├── (Desktop) Two columns
                │   │   ├── Left: PersonaCard + DiagnosisList
                │   │   └── Right: Tab Bar + Tab Content
                │   └── (Mobile) Stacked
                │       ├── PersonaCard (collapsible)
                │       └── Active panel based on tab
                ├── mobile-bottom-nav (mobile only)
                │   └── Interview | Tests | Exam | Diagnose
                ├── error-toast
                ├── submitting-overlay
                ├── GameOverModal (when finished)
                │   └── ShareModal (for challenges)
                ├── GameModeSelector (modal)
                └── FeedbackButton (floating)
```

### Key Components

#### Dashboard (`pages/Dashboard.tsx`)
- Welcome message with username (or "Guest")
- Statistics: Cases Played, Accuracy %, Best Grade (logged-in only)
- Recent Cases: Last 5 completed cases with:
  - Correct/incorrect/timeout indicator
  - Diagnosis (strike-through if wrong, arrow to correct)
  - Domain, Mode tag, Grade, Score, Date
  - Click to open CaseDetailModal
- Action buttons: Start New Case, Past Cases, Enter Test Mode (test users), View Feedback (test users)
- "Login to Save Progress" button for guests

#### PastCasesPage (`pages/PastCasesPage.tsx`)
- Full history list with filters: All, Correct, Incorrect, Blitz, Standard
- Statistics summary: Total, Correct, Incorrect counts
- Clickable cards to open CaseDetailModal
- Detailed info: Questions asked, tests ordered, exams performed

#### CaseDetailModal (`components/CaseDetailModal.tsx`)
- Case summary: Patient info, grade, result, mode
- Diagnosis boxes with explanations
- Tabbed content: Conversation, Tests, Exams
- Coaching section: Score breakdown, strengths, areas for improvement
- "How to Diagnose" section with key symptoms and clinical reasoning

#### ChallengePage (`pages/ChallengePage.tsx`)
- Challenge invitation view: Challenger's grade, domain, "Accept Challenge" button
- Already played view: Your score vs challenger
- Expired challenge view: Final leaderboard
- Leaderboard component: Sorted by score, medals for top 3

#### BlitzTimer (`components/BlitzTimer.tsx`)
- Visual countdown with progress bar
- Color-coded urgency (green → yellow → orange → red)
- Web Audio API for beep sounds
- Calls `onTimeout` when time expires

#### GameModeSelector (`components/GameModeSelector.tsx`)
- Modal overlay with two mode options
- Standard: "Recommended for new players" badge
- Blitz: "2 minute time limit" badge

#### ShareModal (`components/ShareModal.tsx`)
- Challenge URL display with copy button
- Full message with grade for sharing
- WhatsApp share button

#### GameOverModal (`components/GameOverModal.tsx`)
- Correct/incorrect/timeout diagnosis display
- 5-component score breakdown with visual bars
- Grade and rank display
- Diagnosis explanation section (structured with headings)
- Incorrect explanation section (if applicable)
- Challenge result (if challenge game)
- Strengths and areas for improvement
- Buttons: "View Coaching", "Challenge Friends", "New Case"

### State Management

Uses React hooks (`useState`, `useCallback`, `useEffect`) within `GameContent`:

```typescript
// Core game state
const [gameState, setGameState] = useState<GameState | null>(null);
const [loading, setLoading] = useState(false);
const [submittingDiagnosis, setSubmittingDiagnosis] = useState(false);
const [error, setError] = useState<string | null>(null);

// Score and explanations
const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
const [correctDiagnosisName, setCorrectDiagnosisName] = useState<string>('');
const [submittedDiagnosisName, setSubmittedDiagnosisName] = useState<string>('');
const [diagnosisExplanation, setDiagnosisExplanation] = useState<DiagnosisExplanation | null>(null);
const [incorrectExplanation, setIncorrectExplanation] = useState<IncorrectDiagnosisExplanation | null>(null);

// UI state
const [activeTab, setActiveTab] = useState<Tab>('chat');
const [isMobile, setIsMobile] = useState(false);
const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
const [patientInfoExpanded, setPatientInfoExpanded] = useState(true);

// Game mode selector
const [showModeSelector, setShowModeSelector] = useState(false);
const [pendingCaseId, setPendingCaseId] = useState<string | undefined>(undefined);

// Test mode (test users only)
const [testMode, setTestMode] = useState(false);
const [testCases, setTestCases] = useState<TestCase[]>([]);
const [testCaseIndex, setTestCaseIndex] = useState(0);
const [currentTestCase, setCurrentTestCase] = useState<number | null>(null);

// Challenge state
const [challengeId, setChallengeId] = useState<string | null>(null);
const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);
const [showChallengePage, setShowChallengePage] = useState(false);
```

---

## 15. BACKEND ARCHITECTURE

### Server Entry Point

**File:** `server/src/index.ts`

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import gameRoutes from './routes/game';
import userRoutes from './routes/user';
import feedbackRoutes from './routes/feedback';
import challengeRoutes from './routes/challenge';
import notificationRoutes from './routes/notification';
import analyticsRoutes from './routes/analytics';
import { initializePool, getPoolStatus } from './services/casePoolManager';
import { startBackgroundGenerator, getGeneratorStatus } from './services/backgroundGenerator';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/game', gameRoutes);
app.use('/api/user', userRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/telemetry', analyticsRoutes);

// Health check with pool status
app.get('/api/health', (req, res) => {
  const poolStatus = getPoolStatus();
  const generatorStatus = getGeneratorStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    casePool: poolStatus,
    backgroundGenerator: generatorStatus
  });
});

// Startup
async function startServer() {
  await initializePool();
  if (process.env.ENABLE_BACKGROUND_GENERATION === 'true') {
    startBackgroundGenerator();
  }
  app.listen(PORT, () => {
    console.log(`Misdiagnose server running on port ${PORT}`);
  });
}

startServer();
```

### Game Engine

**File:** `server/src/services/gameEngine.ts`

In-memory game session management with mode support:

```typescript
const activeGames = new Map<string, InternalGameState>();

interface InternalGameState {
  gameId: string;
  caseData: Case;
  state: GameState;
  poolCaseId?: string;
  userId?: string;
}

// Key functions
createGame(caseData: Case, options?: { poolCaseId?: string; userId?: string; mode?: GameMode }): GameState
getGame(gameId: string): GameState | undefined
getCaseData(gameId: string): Case | undefined
addChatExchange(gameId: string, question: string, answer: string, quality: number): GameState | null
addTestResult(gameId: string, testName: string, result: string, isAbnormal: boolean): GameState | null
addExamResult(gameId: string, examName: string, finding: string, isAbnormal: boolean): GameState | null
submitDiagnosis(gameId: string, diagnosisId: string): { state: GameState; correct: boolean; breakdown: ScoreBreakdown } | null
timeoutGame(gameId: string): { state: GameState; breakdown: ScoreBreakdown } | null  // NEW: Blitz timeout
deleteGame(gameId: string): boolean
```

### Claude Integration

**File:** `server/src/services/openai.ts`

Uses Anthropic Claude for AI operations:

```typescript
// Model: claude-sonnet-4-20250514

generatePatientResponse(caseData: Case, question: string, chatHistory: ChatMessage[]):
  Promise<{ answer: string; questionQuality: number }>

generateCase(domain?: string): Promise<Case>

generateTestResult(caseData: Case, testName: string):
  Promise<{ result: string; isAbnormal: boolean }>

generateExamFinding(caseData: Case, examName: string):
  Promise<{ finding: string; isAbnormal: boolean }>

parseAndValidateTests(freeText: string):
  Promise<{ validTests: string[]; errors: ValidationError[] }>

parseAndValidateExams(freeText: string):
  Promise<{ validExams: string[]; errors: ValidationError[] }>

generateDiagnosisExplanation(caseData: Case, playerActions: PlayerActions):
  Promise<DiagnosisExplanation>

generateIncorrectDiagnosisExplanation(caseData: Case, wrongDiagnosisId: string, playerActions: PlayerActions):
  Promise<IncorrectDiagnosisExplanation>
```

---

## 16. RAG SYSTEM

### Overview

The RAG (Retrieval-Augmented Generation) system provides medical knowledge grounding. It uses vector similarity search on a medical textbook.

### Python Service

**File:** `rag_textbook/api.py`

FastAPI server with endpoints:

| Endpoint | Purpose |
|----------|---------|
| GET /health | Health check |
| POST /search | General textbook search |
| POST /domain-search | Search specific domain |
| POST /disease-info | Get disease details |
| POST /case-context | Get context for patient response |
| POST /ideal-pathway | Get diagnostic pathway |

### Vector Store

**File:** `rag_textbook/rag/store.py`

- **Model:** all-mpnet-base-v2 (384-dimensional embeddings)
- **Index:** FAISS IndexFlatIP (cosine similarity via inner product)
- **Chunks:** ~40,000 medical knowledge chunks
- **Chunk Size:** ~900 tokens with 150-token overlap

### Knowledge Base

- **Source:** Exam Preparatory Manual for Undergraduates Medicine, 4e
- **Size:** 55MB PDF → 5.2MB cleaned text
- **Domains:** cardiology, respiratory, gastroenterology, neurology, nephrology, hematology, endocrinology, rheumatology, infectious diseases, dermatology

---

## 17. SCORING SYSTEM

### 5-Component Architecture

| Component | Weight | Description |
|-----------|--------|-------------|
| Time | 15% | Speed of diagnosis |
| Budget | 20% | Cost efficiency of tests |
| Efficiency | 25% | Relevance of actions to pathway |
| Accuracy | 25% | Correctness of diagnosis (0 for timeout) |
| Clinical Reasoning | 15% | Question quality average |

### Scoring Engine

**File:** `server/src/scoring/engine.ts`

```typescript
calculateScore(gameState: GameState, caseData: Case, weights?: ScoringWeights): ScoreBreakdown

// Individual component calculators
calculateTimeScore(startTime: number, endTime: number, weights: ScoringWeights): TimeScore
calculateBudgetScore(testResults: TestResult[], weights: ScoringWeights): BudgetScore
calculateEfficiencyScore(testResults: TestResult[], examResults: ExamResult[], caseData: Case, chatHistory: ChatMessage[]): EfficiencyScore
calculateAccuracyScore(selectedId: string, correctId: string): AccuracyScore
calculateClinicalReasoningScore(chatHistory: ChatMessage[], examResults: ExamResult[], testResults: TestResult[]): ClinicalReasoningScore
```

### Grade Thresholds

| Grade | Score | Rank |
|-------|-------|------|
| S | 95+ | Master Diagnostician |
| A | 85+ | Expert Clinician |
| B | 70+ | Competent Physician |
| C | 55+ | Junior Resident |
| D | 40+ | Medical Student |
| F | <40 | Needs Improvement |

---

## 18. COACHING & FEEDBACK SYSTEM

### Coaching Engine

**File:** `server/src/coaching/coachingEngine.ts`

Compares player actions against ideal diagnostic pathway:

```typescript
compareToIdealPathway(
  idealPathway: IdealPathway,
  chatHistory: ChatMessage[],
  testResults: TestResult[],
  examResults: ExamResult[]
): PathwayComparison

generateCoachingFeedback(
  idealPathway: IdealPathway,
  comparison: PathwayComparison,
  wasCorrect: boolean
): CoachingFeedback
```

### Pathway Comparison

```typescript
interface PathwayComparison {
  correctActions: { action: string; type: string; matchedStep: PathwayStep; feedback: string }[];
  missedSteps: { step: PathwayStep; whyImportant: string }[];
  unnecessaryActions: { action: string; type: string; feedback: string }[];
  differentialEliminationActions: { action: string; ruledOut: string; how: string }[];
  orderingIssues: { action: string; idealOrder: number; actualOrder: number; feedback: string }[];
  pathwayScore: number;  // 0-100
}
```

---

## 19. ANALYTICS & TELEMETRY

### Overview

The app tracks user behavior and performance for improvement.

### Client-Side Analytics

**File:** `client/src/utils/analytics.ts`

```typescript
const analytics = {
  setUserId(userId: string | null): void;
  track(eventName: string, properties?: Record<string, any>): void;
  trackCaseStart(caseId: string, gameId: string, mode: GameMode, isChallenge: boolean): void;
  trackCaseComplete(data: CaseCompleteData): void;
}
```

### Tracked Events

| Event | Description | Data |
|-------|-------------|------|
| `case_start` | New game started | caseId, gameId, mode, isChallenge |
| `case_complete` | Diagnosis submitted | score, grade, duration, wasCorrect, mode, etc. |
| `case_timeout` | Blitz timeout | caseId, duration, testsOrdered, etc. |

### Server-Side Analytics

**File:** `server/src/routes/analytics.ts`

- POST /api/telemetry/event - Log analytics event

---

## 20. API REFERENCE

### Game Routes (`/api/game/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /new | Start new game (with mode) |
| GET | /:id | Get game state |
| POST | /:id/ask | Ask question |
| POST | /:id/exam | Perform exam |
| POST | /:id/test | Order test |
| POST | /:id/batch-exams | Batch exams (free-text) |
| POST | /:id/batch-tests | Batch tests (free-text) |
| POST | /:id/diagnose | Submit diagnosis |
| POST | /:id/timeout | Handle blitz timeout |
| GET | /:id/coaching | Get coaching feedback |
| GET | /pool/status | Get pool status |
| GET | /pool/test-cases | Get test mode cases |
| DELETE | /:id | Delete game |

### User Routes (`/api/user/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /:uid | Get user profile |
| POST | / | Create/update user |
| GET | /stats/count | Get user count |
| GET | /:uid/history | Get case history (with details) |

### Challenge Routes (`/api/challenge/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | / | Create new challenge |
| GET | /:id | Get challenge info |
| POST | /:id/start | Start playing challenge |
| POST | /:id/complete | Submit challenge result |
| GET | /user/:userId | Get user's challenges |

### Feedback Routes (`/api/feedback/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | / | Submit new feedback |
| GET | / | Get all feedback |
| GET | /stats | Get feedback statistics |
| GET | /:id | Get specific feedback |
| PATCH | /:id/status | Update feedback status |
| DELETE | /:id | Delete feedback |

### Notification Routes (`/api/notifications/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /:userId | Get user's notifications |
| POST | /:id/read | Mark as read |
| POST | /:userId/read-all | Mark all as read |

---

## 21. SCRIPTS & CLI TOOLS

### Generate Cases

**File:** `server/src/scripts/generateCases.ts`

```bash
# Generate 5 random cases
npm run generate-cases 5

# Generate 3 cardiology cases
npm run generate-cases 3 cardiology

# Fill pool to target size
npm run generate-cases --fill

# Show pool statistics
npm run generate-cases --status
```

### Set Test User

**File:** `server/src/scripts/setTestUser.ts`

```bash
# Make user a test user
npm run set-test-user <username> true

# Remove test user status
npm run set-test-user <username> false
```

**What Test Users Can Do:**
- Access "Enter Test Mode" button on Dashboard
- Access "View Feedback" dashboard
- Test Mode loads 3 specific cases for consistent testing
- Test Mode indicator shows in game header

---

## 22. ENVIRONMENT SETUP

### Server Environment (.env)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional
PORT=3001
RAG_API_URL=http://localhost:3006
ENABLE_BACKGROUND_GENERATION=true
```

### Client Environment

Firebase configuration is embedded in `firebase.ts` (no .env needed for client).

### Python Environment

```bash
cd rag_textbook
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

---

## 23. RUNNING THE APPLICATION

### Development Mode

**Terminal 1 - RAG Service:**
```bash
cd rag_textbook
.venv\Scripts\activate
python api.py
# Runs on http://localhost:3006
```

**Terminal 2 - Backend Server:**
```bash
cd server
npm run dev
# Runs on http://localhost:3001
```

**Terminal 3 - Frontend:**
```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

### Or Use Root Scripts

```bash
# Install all dependencies
npm run install:all

# Start server and client together
npm run dev
```

### Production Build

```bash
# Build all
npm run build

# Start production server
npm run start
```

---

## 24. MOBILE RESPONSIVENESS

### Overview

The app is fully responsive with a mobile-first approach for screens ≤768px.

### Mobile-Specific Features

1. **Bottom Navigation Bar**
   - Fixed at bottom of screen
   - Tabs: Interview, Tests, Exam, Diagnose
   - Badge counts for tests and exams

2. **Collapsible Patient Info**
   - PersonaCard collapses after first interaction
   - Tap to expand/collapse
   - Maximizes space for active panel

3. **Stacked Layout**
   - Single column instead of two
   - Full-width panels
   - Adapted for touch interaction

4. **Responsive Header**
   - Abbreviated text (← instead of ← Dashboard)
   - Compact test mode indicator

5. **Touch-Optimized**
   - Larger tap targets
   - Swipe-friendly interfaces
   - No hover-dependent interactions

### CSS Structure

```css
/* Mobile breakpoint */
@media (max-width: 768px) {
  .game-board { /* stacked layout */ }
  .mobile-bottom-nav { display: flex; }
  .left-column, .right-column { display: none; }
  .mobile-panel { display: block; }
}
```

---

## APPENDIX: CHANGES SINCE V2.0.0

| Feature | Description | Files Changed |
|---------|-------------|---------------|
| Guest Mode | Play without login | `AuthContext.tsx`, `ProtectedRoute.tsx`, `Dashboard.tsx` |
| Game Modes | Standard/Blitz selection | `GameModeSelector.tsx`, `BlitzTimer.tsx`, `types.ts`, `gameEngine.ts` |
| Blitz Timer | 2-min countdown with audio | `BlitzTimer.tsx`, `BlitzTimer.css` |
| Challenge System | Share cases with friends | `challengeService.ts`, `challenge.ts`, `ChallengePage.tsx`, `ShareModal.tsx` |
| Leaderboards | Multiple challenge responses | `challengeService.ts`, `ChallengePage.tsx` |
| Notifications | Challenge result alerts | `challengeService.ts`, `notification.ts`, `NotificationDropdown.tsx` |
| Feedback System | Submit feedback anywhere | `feedbackService.ts`, `feedback.ts`, `FeedbackButton.tsx`, `FeedbackModal.tsx` |
| Feedback Dashboard | Admin feedback view | `FeedbackDashboard.tsx`, `FeedbackDashboard.css` |
| Past Cases Page | Full history with filters | `PastCasesPage.tsx`, `PastCasesPage.css` |
| Case Detail Modal | Review past cases | `CaseDetailModal.tsx`, `CaseDetailModal.css` |
| Pre-computed Explanations | Instant feedback | `types.ts`, `game.ts`, `openai.ts` |
| Enhanced Case History | Store detailed data | `userService.ts`, `types.ts`, `game.ts` |
| Mobile Design | Responsive layout | `App.css`, `App.tsx`, various component CSS |
| Analytics | Track user behavior | `analytics.ts`, `analyticsService.ts` |
| Timeout Handling | Blitz mode timeout | `game.ts`, `gameEngine.ts` |

---

**End of Documentation**
