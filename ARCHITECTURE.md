# Architecture & Data Flow

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (Next.js)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ UploadStep   │───→│ MappingStep  │───→│ Reconcil.    │  │
│  │              │    │              │    │ Workspace    │  │
│  │ • Drag-drop  │    │ • AI Guesses │    │              │  │
│  │ • File parse │    │ • User verify│    │ • Split-view │  │
│  │ • Load data  │    │ • Save learns│    │ • Matching   │  │
│  └──────────────┘    └──────────────┘    │ • Scoring    │  │
│                                           │              │  │
│                    ┌─────────────────────→│ MatchReview  │  │
│                    │                      │ Panel        │  │
│                    │  Slide-in Modal      └──────────────┘  │
│                    │  • Show suggestions                    │
│                    │  • Score breakdown                     │
│                    │  • Approve/reject                      │
│                    │                                         │
└────────────────────┼─────────────────────────────────────────┘
                     │
           ┌─────────▼──────────┐
           │  State Management  │
           │  (Zustand Store)   │
           │                    │
           │ • Transactions     │
           │ • MatchGroups      │
           │ • Workflow step    │
           │ • Column mapping   │
           └────────────────────┘
```

---

## 📊 Data Flow: Step by Step

### Step 1: Upload
```
User Action          State Update           UI Update
───────────────      ──────────────         ──────────
Click Upload    →    setBankTransactions    Load complete
    ↓                    ↓
Load Mock Data      setStep("mapping")      Progress bar
    ↓                    ↓
Transition      Display mapping screen
```

### Step 2: Mapping Verification
```
User Action          State Update           UI Update
───────────────      ──────────────         ──────────
Select Column   →    setColumnMapping()     Dropdown updates
    ↓                    ↓
Click Confirm       setStep("reconcil.")    Data preview
    ↓                    ↓
Timeout             Show workspace
```

### Step 3: Matching
```
Bank Transactions            Matching Algorithm         Result
─────────────────           ──────────────────────      ──────
Click Unmatched       →      Filter by:                 Display
Transaction                  • Amount                   Suggestions
                             • Date (±14 days)      →   in Panel
                             • Narration similarity
                             ↓
          Confidence = (50% value + 20% date + 20% ref + 10% narr)
```

### Step 4: Approval
```
User clicks               State Update              UI Update
"Confirm Match"
    ↓
addMatchGroup()    →    Add to matchGroups[]   →   Animate out
    ↓                   Update transaction          Decrease
Store match               status to "matched"       Unmatched
                         ↓                         count
                    Remove from unmatched          ↓
                    lists in UI                   Show Match
                                                  Summary
```

---

## 🧮 Confidence Scoring Formula

```
TOTAL SCORE = (Weight₁ × Signal₁) + (Weight₂ × Signal₂) + ... + (Weightₙ × Signalₙ)

S = (0.50 × Value_Score) + (0.20 × Date_Score) + (0.20 × Ref_Score) + (0.10 × Narr_Score)

Where each signal returns a value from 0.0 to 1.0:

1️⃣  VALUE SCORE (50% weight - Critical)
   Value1 == Value2         → 1.0 (100%)
   Value1 != Value2         → 0.0 (0%)

2️⃣  DATE SCORE (20% weight - Important)
   Difference = 0 days      → 1.0 (100%)
   Difference = 1-3 days    → 0.8 (80%)
   Difference = 4-7 days    → 0.4 (40%)
   Difference > 7 days      → 0.0 (0%)

3️⃣  REFERENCE SCORE (20% weight - Important)
   Ref1 == Ref2             → 1.0 (100%)
   Ref1 != Ref2             → 0.0 (0%)
   Ref Missing              → 0.5 (50%)

4️⃣  NARRATION SCORE (10% weight - Supportive)
   Fuzzy Match > 90%        → 0.9 (90%)
   Fuzzy Match > 70%        → 0.7 (70%)
   Fuzzy Match > 50%        → 0.5 (50%)
   No similarity            → 0.0 (0%)

EXAMPLE CALCULATION:
Bank Transaction: {"amount": 100, "date": "2025-01-05", "ref": "INV001", "narr": "Payment"}
Book Transaction: {"amount": 100, "date": "2025-01-05", "ref": "INV001", "narr": "Invoice"}

Score = (0.50 × 1.0) + (0.20 × 1.0) + (0.20 × 1.0) + (0.10 × 0.9)
      = 0.50 + 0.20 + 0.20 + 0.09
      = 0.99
      = 99% CONFIDENCE ✅ AUTO-MATCH
```

---

## 🎨 Confidence Tiers & UI

```
Confidence Range    Tier                Action              Color
────────────────    ────                ──────              ─────
95-100%             🚀 High             Auto-match          🟢 Green
                    Confidence          (verified)

70-94%              🟡 Medium           Show suggestion     🟡 Yellow
                    Confidence          (needs approval)

< 70%               🔴 Low              Manual review       🔴 Red
                    Confidence          required

0%                  ✗ No Match          Stay unmatched      ⚪ Grey
                    Found
```

---

## 📦 Database Schema (Production)

```sql
-- Summary View (How it will look in PostgreSQL)

TABLE bank_transactions
├── id (UUID)
├── org_id (FK)
├── trans_date (Date)
├── narration (Text)
├── reference (Text)
├── amount (Decimal)
├── match_group_id (FK, Nullable)
└── status (Unreconciled | Pending | Matched)

TABLE book_transactions
├── id (UUID)
├── org_id (FK)
├── trans_date (Date)
├── narration (Text)
├── reference (Text)
├── amount (Decimal)
├── match_group_id (FK, Nullable)
└── status (Unreconciled | Pending | Matched)

TABLE match_groups (The "Bridge")
├── id (UUID)
├── org_id (FK)
├── match_type (1:1 | 1:N | N:1 | N:N)
├── total_bank_amount (Decimal)
├── total_book_amount (Decimal)
├── variance (Decimal) -- Should be 0
├── confidence_score (Integer 0-100)
└── status (Pending | Approved | Rejected)

-- Many-to-One Example:
-- Retail client, 1 bank payout = 5 separate book entries
match_group_001 → 1 bank_tx + 5 book_txs
```

---

## 🔄 Component Inheritance & Props

```
RootLayout
    ↓
page.tsx (Home)
    │
    ├─→ useReconciliationStore()
    │   │
    │   └─→ if step == "upload"
    │       └─→ UploadStep
    │           ├─→ setBankTransactions()
    │           ├─→ setBookTransactions()
    │           └─→ setStep("mapping")
    │
    ├─→ if step == "mapping"
    │   └─→ MappingStep
    │       ├─→ bankTransactions (from store)
    │       ├─→ setColumnMapping()
    │       └─→ setStep("reconciliation")
    │
    └─→ if step == "reconciliation"
        └─→ ReconciliationStep
            ├─→ bankTransactions (from store)
            ├─→ bookTransactions (from store)
            ├─→ matchGroups (from store)
            │
            ├─→ Renders Split-View
            │   ├─→ Unmatched Bank List
            │   └─→ Unmatched Book List
            │
            ├─→ On Click Unmatched
            │   └─→ Calc Suggestions (client-side)
            │       └─→ MatchReviewPanel
            │           ├─→ Show AI suggestions
            │           └─→ On "Confirm"
            │               └─→ addMatchGroup()
            │                   └─→ Update store
            │                       └─→ Auto-update UI
            │
            └─→ Matched Transactions Display
                └─→ Grid of approved matches
```

---

## 🎯 Quick Reference: File Purposes

| File | Purpose | Key Code |
|------|---------|----------|
| `page.tsx` | Route to correct step | `step === "reconciliation"` |
| `UploadStep.tsx` | File input UI | `handleSimulateUpload()` |
| `MappingStep.tsx` | Column verification | Column dropdown selects |
| `ReconciliationStep.tsx` | Main workspace | Split-view lists & matching |
| `MatchReviewPanel.tsx` | Match details | Score breakdown & buttons |
| `reconciliation.ts` | All state logic | `useReconciliationStore()` |
| `mockData.ts` | Test data | 8 bank + 8 book transactions |

---

## 🚀 Key State Transitions

```
INITIAL STATE
├─ step: "upload"
├─ bankTransactions: []
├─ bookTransactions: []
├─ matchGroups: []
└─ columnMapping: null

↓ (User uploads bank data)

AFTER UPLOAD
├─ step: "upload"
├─ bankTransactions: [8 transactions]
├─ bookTransactions: []
├─ matchGroups: []
└─ uploadedFileName: "bank_statement.xlsx"

↓ (Auto-transition after 1 second)

MAPPING STATE
├─ step: "mapping"
├─ bankTransactions: [8 transactions]
├─ bookTransactions: []
├─ columnMapping: null
└─ (waiting for user confirmation)

↓ (User confirms mapping)

RECONCILIATION STATE
├─ step: "reconciliation"
├─ bankTransactions: [8 transactions]
├─ bookTransactions: [8 transactions]
├─ columnMapping: { date, narration, reference, amount }
└─ matchGroups: []

↓ (User approves matches)

MATCHED STATE
├─ step: "reconciliation"
├─ bankTransactions: [some with matched=true]
├─ bookTransactions: [some with matched=true]
└─ matchGroups: [approved groups]

↓ (All matched)

COMPLETE STATE
├─ step: "complete"
├─ matchGroups: [all groups]
└─ Ready for export/report
```

---

## 🧪 Testing Checklist

Use this to test the prototype:

- [ ] Upload phase loads mock data
- [ ] Mapping phase shows column dropdown
- [ ] Column preview displays correctly
- [ ] Can change column mapping
- [ ] Workspace displays bank & book transactions
- [ ] Progress bar updates as matches are made
- [ ] Clicking unmatched transaction shows suggestions
- [ ] Confidence scores display correctly
- [ ] Approval button creates match
- [ ] Matched count increases
- [ ] Matched items appear in summary at bottom
- [ ] All transitions animate smoothly

---

This architecture is designed for 2026 performance standards and scales from MVP to enterprise SaaS.
