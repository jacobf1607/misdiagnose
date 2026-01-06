# Misdiagnose - API Endpoints Reference

**Last Updated:** January 7, 2026

**Base URL (Local):** http://localhost:3005
**Base URL (Production):** https://api.misdiagnose.in

---

## Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health with pool, generator, and AI status |
| GET | `/api/ai-status` | Detailed AI provider configuration |

---

## Game Endpoints `/api/game/*`

### Start & Manage Games

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/game/new` | Start a new game |
| GET | `/api/game/:id` | Get current game state |
| DELETE | `/api/game/:id` | Delete a game session |

**POST /api/game/new**
```json
{
  "mode": "standard" | "blitz",
  "userId": "firebase-uid",  // optional
  "caseId": "case_123"       // optional, for challenges
}
```

### Player Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/game/:id/ask` | Ask patient a question |
| POST | `/api/game/:id/test` | Order a single test |
| POST | `/api/game/:id/exam` | Perform a single examination |
| POST | `/api/game/:id/batch-tests` | Order multiple tests (free-text) |
| POST | `/api/game/:id/batch-exams` | Perform multiple exams (free-text) |
| POST | `/api/game/:id/diagnose` | Submit final diagnosis |
| POST | `/api/game/:id/timeout` | Handle blitz mode timeout |

**POST /api/game/:id/ask**
```json
{ "question": "What symptoms are you experiencing?" }
```

**POST /api/game/:id/batch-tests**
```json
{ "freeText": "CBC, LFT, serum electrolytes" }
```

**POST /api/game/:id/diagnose**
```json
{
  "diagnosisId": "d5",
  "userId": "firebase-uid"  // optional
}
```

### Coaching & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/game/:id/coaching` | Get coaching feedback |
| GET | `/api/game/pool/status` | Get case pool status |
| GET | `/api/game/pool/test-cases` | Get test mode cases (test users only) |

---

## User Endpoints `/api/user/*`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/:uid` | Get user profile by Firebase UID |
| POST | `/api/user` | Create or update user |
| GET | `/api/user/:uid/history` | Get user's case history |
| GET | `/api/user/stats/count` | Get total user count |

**POST /api/user**
```json
{
  "uid": "firebase-uid",
  "phone_number": "+1234567890",
  "username": "player1"
}
```

**GET /api/user/:uid/history?limit=50**
```json
{
  "history": [...],
  "totalCases": 25,
  "correctCount": 18,
  "averageScore": 72.5
}
```

---

## Challenge Endpoints `/api/challenge/*`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/challenge` | Create a new challenge |
| GET | `/api/challenge/:id` | Get challenge by ID |
| POST | `/api/challenge/:id/start` | Start playing a challenge |
| POST | `/api/challenge/:id/complete` | Complete a challenge |
| GET | `/api/challenge/user/:userId` | Get challenges created by user |

**POST /api/challenge**
```json
{
  "caseId": "case_123",
  "userId": "firebase-uid",
  "userName": "player1",
  "score": 85,
  "grade": "A",
  "mode": "standard"
}
```

**POST /api/challenge/:id/complete**
```json
{
  "respondentUserId": "firebase-uid",
  "respondentName": "player2",
  "respondentScore": 78,
  "respondentGrade": "B"
}
```

---

## Feedback Endpoints `/api/feedback/*`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/feedback` | Submit new feedback |
| GET | `/api/feedback` | Get all feedback (admin) |
| GET | `/api/feedback/stats` | Get feedback statistics |
| GET | `/api/feedback/:id` | Get specific feedback entry |
| PATCH | `/api/feedback/:id/status` | Update feedback status |
| DELETE | `/api/feedback/:id` | Delete feedback entry |

**POST /api/feedback**
```json
{
  "userId": "firebase-uid",
  "userEmail": "user@example.com",
  "isTestUser": false,
  "feedbackText": "Great game!",
  "context": "after_case",
  "caseSnapshot": { ... }
}
```

---

## Notification Endpoints `/api/notifications/*`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/:userId` | Get user's notifications |
| POST | `/api/notifications/:id/read` | Mark notification as read |
| POST | `/api/notifications/:userId/read-all` | Mark all as read |

---

## Analytics Endpoints `/api/telemetry/*`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/telemetry/event` | Log an analytics event |

**POST /api/telemetry/event**
```json
{
  "eventName": "game_started",
  "properties": { "mode": "blitz" },
  "userId": "firebase-uid",
  "timestamp": 1704672000000
}
```

---

## Data Types

```typescript
type GameMode = "standard" | "blitz";
type GameStatus = "in_progress" | "won" | "lost" | "timeout";
type FeedbackStatus = "unread" | "important" | "solved" | "irrelevant";
type FeedbackContext = "dashboard" | "during_case" | "after_case";
type Grade = "S" | "A" | "B" | "C" | "D" | "F";
type ChallengeResult = "win" | "lose" | "tie";
```

---

## Example Requests

### Start a new standard game
```bash
curl -X POST https://api.misdiagnose.in/api/game/new \
  -H "Content-Type: application/json" \
  -d '{"mode": "standard"}'
```

### Ask a question
```bash
curl -X POST https://api.misdiagnose.in/api/game/{gameId}/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What symptoms are you experiencing?"}'
```

### Order multiple tests
```bash
curl -X POST https://api.misdiagnose.in/api/game/{gameId}/batch-tests \
  -H "Content-Type: application/json" \
  -d '{"freeText": "CBC, LFT, serum electrolytes"}'
```

### Submit diagnosis
```bash
curl -X POST https://api.misdiagnose.in/api/game/{gameId}/diagnose \
  -H "Content-Type: application/json" \
  -d '{"diagnosisId": "d5", "userId": "firebase-uid"}'
```

### Check health
```bash
curl https://api.misdiagnose.in/api/health
```

---

## AI Provider Info

### Current Configuration: HYBRID MODE

**Real-Time Tasks (Groq):**
- Patient responses → llama-3.1-8b-instant (560 T/sec)
- Test results → llama-3.1-8b-instant
- Exam findings → llama-3.1-8b-instant
- Input parsing → llama-3.1-8b-instant
- AI Scoring → openai/gpt-oss-120b (500 T/sec)

**Background Tasks (OpenAI):**
- Case generation → gpt-5.2
- Ideal pathway → gpt-5.2
- Explanations → gpt-5.2

**Fallback:** Claude (claude-3-5-haiku) if other providers fail
