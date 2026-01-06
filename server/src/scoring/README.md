# Scoring System

A comprehensive scoring engine for the medical diagnosis game that rewards:
- **Fast diagnosis** (time pressure)
- **Cost-efficient testing** (budget constraint)
- **Avoiding unnecessary tests** (efficiency)
- **Good clinical reasoning** (systematic approach)

## Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Time | 15% | Faster diagnosis = higher score |
| Budget | 20% | Stay under budget, avoid expensive tests |
| Efficiency | 20% | No redundant/unnecessary tests |
| Accuracy | 30% | Correct diagnosis is crucial |
| Clinical Reasoning | 15% | Systematic approach, good questions |

## Usage

```typescript
import { calculateScore, createTranscriptFromGameState } from './scoring';

// Create transcript from game state
const transcript = createTranscriptFromGameState(
  gameId,
  startTime,
  endTime,
  'cardiology',           // domain
  'd1',                    // correct diagnosis ID
  'Acute MI',              // correct diagnosis name
  'd1',                    // submitted diagnosis ID
  'Acute MI',              // submitted diagnosis name
  chatHistory,
  testResults,
  examResults
);

// Calculate score
const result = calculateScore(transcript);

console.log(result.totalScore);        // 85
console.log(result.grade);             // 'A'
console.log(result.rank);              // 'Expert Clinician'
console.log(result.summary);           // 'Grade A (85/100)...'
console.log(result.strengths);         // ['Quick diagnostic time', ...]
console.log(result.areasForImprovement); // ['Focus on domain-relevant tests']
```

## Grade Thresholds

| Grade | Score Range | Rank |
|-------|-------------|------|
| S | 95-100 | Master Diagnostician |
| A | 85-94 | Expert Clinician |
| B | 70-84 | Competent Physician |
| C | 55-69 | Junior Resident |
| D | 40-54 | Medical Student |
| F | 0-39 | Needs Improvement |

## Time Scoring

- **Optimal time**: ≤10 minutes → 100% (with bonus)
- **Max time**: 30 minutes → 0%
- Linear decay between optimal and max

## Budget Scoring

- **Total budget**: ₹5,000
- **Bonus threshold**: 50% remaining → 100%
- Over budget → penalties apply

### Test Costs (Examples)

| Test | Cost | Category |
|------|------|----------|
| CBC | ₹100 | Basic |
| ECG | ₹150 | Basic |
| Troponin | ₹200 | Advanced |
| Chest X-ray | ₹300 | Imaging |
| CT Scan | ₹1,200+ | Imaging |
| MRI | ₹3,000 | Imaging |
| Angiography | ₹3,000 | Invasive |

## Efficiency Scoring

Penalties for:
- **Redundant tests**: Same test ordered twice (-10 each)
- **Low-yield tests**: Wrong domain tests (-5 each)
- **Unnecessary expensive tests**: High cost, normal result (-10 each)

## Clinical Reasoning Scoring

Rewards for:
- High question quality scores (7+/10)
- Domain-relevant tests and exams
- **Systematic approach**: History → Exam → Basic tests → Advanced tests

## Configuration

All weights and costs are configurable in `config.ts`:

```typescript
import { DEFAULT_WEIGHTS, TEST_COSTS, EXAM_COSTS } from './config';

// Customize weights
const customWeights = {
  ...DEFAULT_WEIGHTS,
  accuracyWeight: 40,  // Make accuracy more important
  timeWeight: 10       // Make time less important
};

const result = calculateScore(transcript, customWeights);
```

## Files

```
scoring/
├── types.ts      # Type definitions
├── config.ts     # Weights, test costs, exam costs
├── engine.ts     # Pure scoring functions
├── engine.test.ts # Unit tests
├── index.ts      # Main exports
└── README.md     # This file
```

## Pure Functions

All scoring functions are pure (no side effects):

```typescript
// Individual component scores
calculateTimeScore(transcript, weights)
calculateBudgetScore(transcript, weights)
calculateEfficiencyScore(transcript, weights)
calculateAccuracyScore(transcript, weights)
calculateClinicalReasoningScore(transcript, weights)

// Full calculation
calculateScore(transcript, weights)
```

## Testing

```bash
cd server
npm test -- --testPathPattern=scoring
```

## Example Score Breakdown

```json
{
  "time": {
    "raw": 100,
    "weighted": 15,
    "timeElapsedMinutes": 5.2,
    "bonusApplied": true,
    "details": "Excellent! Completed in 5.2 min"
  },
  "budget": {
    "raw": 85,
    "weighted": 17,
    "totalSpent": 750,
    "budgetRemaining": 4250,
    "percentUsed": 15,
    "details": "Only spent 750 of 5000 budget (15%)"
  },
  "efficiency": {
    "raw": 90,
    "weighted": 18,
    "unnecessaryTests": [],
    "redundantTests": [],
    "lowYieldTests": ["Skin Biopsy"],
    "totalPenalty": 5,
    "details": "Issues: 1 low-yield tests"
  },
  "accuracy": {
    "raw": 100,
    "weighted": 30,
    "correct": true,
    "firstAttempt": true,
    "details": "Correct diagnosis on first attempt!"
  },
  "clinicalReasoning": {
    "raw": 82,
    "weighted": 12.3,
    "relevantActionsCount": 8,
    "totalActionsCount": 10,
    "systematicApproach": true,
    "questionQualityAvg": 7.5,
    "details": "Good clinical reasoning"
  },
  "totalScore": 92,
  "grade": "A",
  "rank": "Expert Clinician",
  "summary": "Grade A (92/100). You correctly diagnosed Acute MI using 6 questions, 2 exams, and 3 tests.",
  "strengths": [
    "Quick diagnostic time",
    "Cost-efficient testing",
    "Correct diagnosis on first attempt"
  ],
  "areasForImprovement": [
    "Focus on domain-relevant tests"
  ]
}
```
