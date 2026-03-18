# 🧪 MVP Testing Guide

Complete step-by-step instructions to test the AI Reconciliation SaaS

---

## ⚡ 5-Minute Setup

### Step 1: Start Backend (Terminal 1)
```bash
cd /tmp/ai-reconciliation-saas
docker-compose up
```

**Wait for this message:**
```
✓ Database tables created successfully
✓ FastAPI app initialized: AI Reconciliation SaaS v0.1.0
```

### Step 2: Start Frontend (Terminal 2)
```bash
cd /tmp/ai-reconciliation-saas
npm install  # Only first time
npm run dev
```

**Wait for:**
```
✓ Ready in 1.23s
```

### Step 3: Open Browser
```
http://localhost:3001
```

**You should see:**
- Blue header "Bank Reconciliation"
- Two upload areas: "Bank Statement" + "Cash Book"

---

## 🧪 Complete Test Workflow (15 Minutes)

### TEST 1: Upload Bank Statement

**What to do:**
1. Click "Bank Statement" upload area
2. Select any file (PDF, Excel, or CSV)
   - Use a real file or create a test Excel with 5 rows
3. Watch the upload spinner

**What to expect:**
- ✅ File uploads in ~1-2 seconds
- ✅ Auto-transitions to "Verify Column Mapping" screen
- ✅ No errors in browser console (F12)

**Check Backend:**
```bash
curl http://localhost:8000/health
# Should return: {"status": "healthy", ...}
```

---

### TEST 2: Verify AI Column Mapping

**What you should see:**
- 📋 "Column Mapping" section on left with 4 dropdowns:
  - 📅 Transaction Date
  - 📝 Description
  - 🔖 Reference
  - 💰 Amount
- 👁️ "Data Preview" section on right showing first few rows
- ✅ Green box: "AI Confidence: Strong match detected"

**What to do:**
1. Check that the column names look correct
2. If wrong, click dropdown and select correct column
3. Click "Confirm & Continue" button

**What to expect:**
- ✅ Button shows "Standardizing..." with spinner
- ✅ Processes for ~1 second per 100 rows
- ✅ Auto-transitions to "Reconciliation Workspace"
- ✅ No errors

---

### TEST 3: View Reconciliation Dashboard

**What you should see:**
```
Header: "Reconciliation Workspace"
Progress bar: Shows % matched (e.g., "5 of 50 transactions matched")

Split View:
┌─────────────────────┬─────────────────────┐
│  🏦 Bank Statement  │  📚 Cash Book       │
│  (X matched)        │  (X matched)        │
│  ─────────────────  │  ─────────────────  │
│  [Unmatched items]  │  [Unmatched items]  │
└─────────────────────┴─────────────────────┘

Bottom: "Matched Transactions (X)" - shows confirmed matches
```

---

### TEST 4: Select Unmatched Transaction & View Suggestions

**What to do:**
1. Click on ANY red transaction in the left "Bank Statement" list
   - Example: "2025-01-02 | Stripe Payout | $1500.00"

**What you should see:**
- ✅ Transaction highlighted in blue
- ✅ Popup appears from bottom: "Find Matching Book Entry"
- ✅ Shows the bank transaction details
- ✅ Below: "AI Suggestions" with 1-3 matching options

**Check Suggestion Details:**
Each suggestion shows:
```
🚀 High Confidence 92%   [or 🟡 Medium 78%]

💰 Amount: $1500.00      ← Should match or be very close
📅 Date: 2025-01-02      ← Should be within 2-7 days
Description: [Similar narration]

Value Match:    ████████░ 100%
Date Proximity: ███████░░  80%
Description:    ██████░░░  60%

[✓ Confirm Match]  [❌ Reject & Search]
```

---

### TEST 5: Approve a Match

**What to do:**
1. In the suggestions popup, click "Confirm Match" on any suggestion
   - This should be the first (highest confidence) option

**What to expect:**
- ✅ Popup closes
- ✅ Matched transaction disappears from both lists
- ✅ Progress bar increases
- ✅ Matched count updates (e.g., "6 of 50" → "7 of 50")
- ✅ New "Matched Transactions" card appears at bottom

**Check Matched Transaction Card:**
```
✓ Matched Transactions (1)

┌──────────────────────────────┐
│ 92% confidence               │
│ $1500.00                     │
│ 1:1 transaction              │
└──────────────────────────────┘
```

---

### TEST 6: Test Error Handling

**What to do:**
1. Stop the backend (Ctrl+C in Terminal 1)

**What you should see:**
- ✅ Red error banner at top of page
- ✅ Says something like "Backend not reachable"
- ✅ Click X to dismiss

**What to do:**
1. Restart backend: `docker-compose up`
2. Wait for health check
3. Error banner should disappear automatically

---

### TEST 7: Test with Real Data

**Create a test Excel file:**

**bank_statements.xlsx:**
```
Date          | Narration          | Reference | Amount
2025-02-01    | Stripe Payout      | STR001    | 1500.00
2025-02-02    | Amazon Purchase    | AMZ123    | 234.56
2025-02-03    | Electric Bill      | UTIL001   | 189.32
2025-02-04    | Client Payment     | INV001    | 5000.00
```

**cashbook.csv:**
```
date,description,reference,amount
2025-02-01,Stripe Sales,STRIPE,1500.00
2025-02-02,Office Supply,OFFICE,234.56
2025-02-03,Utilities,UTIL,189.32
2025-02-04,Income - Client A,INC001,5000.00
```

**Upload both and verify:**
- ✅ All 4 transactions match (100% confidence)
- ✅ All disappear from unmatched lists
- ✅ All appear in "Matched Transactions"
- ✅ Progress shows "8 of 8 matched" (100%)

---

## 🔍 Verify Data in Database

### Check What Was Stored

**Terminal 3:**
```bash
psql -U dev -d reconciliation -h localhost
```

**Check bank transactions:**
```sql
SELECT id, trans_date, narration, amount, status
FROM bank_transactions
ORDER BY created_at DESC
LIMIT 5;
```

**Check book transactions:**
```sql
SELECT id, trans_date, narration, amount, status
FROM book_transactions
ORDER BY created_at DESC
LIMIT 5;
```

**Check matches:**
```sql
SELECT id, match_type, confidence_score, status, variance
FROM match_groups
ORDER BY created_at DESC
LIMIT 5;
```

**Expected output:**
```
 id                 | trans_date | narration      | amount   | status
────────────────────┼────────────┼────────────────┼──────────┼──────────
 abc123...          | 2025-02-01 | Stripe Payout  | 1500.00  | matched
 def456...          | 2025-02-02 | Amazon Purchase| 234.56   | matched
 ghi789...          | 2025-02-03 | Electric Bill  | 189.32   | matched
```

---

## 🐛 Debugging Tests

### Test 1: No transactions appearing

**Check:**
1. Did backend finish extracting?
   ```bash
   docker-compose logs api | grep "Standardized"
   ```

2. Is database working?
   ```bash
   psql -U dev -d reconciliation -h localhost -c "SELECT COUNT(*) FROM bank_transactions;"
   ```

**Solution:**
- Restart backend: `docker-compose restart api`
- Refresh frontend: F5
- Try uploading again

---

### Test 2: Matching shows 0% progress

**Check:**
1. Did both files upload?
   - Look for "6 of X transactions matched" message
   - If says "0 matched", means no suggestions found

2. Check confidence scores:
   ```sql
   SELECT match_type, confidence_score FROM match_groups LIMIT 5;
   ```

**Solution:**
- Make sure bank and book files match similar data
- Use the provided test data above
- Amounts should match exactly or be very close

---

### Test 3: "Backend not reachable" error

**Check:**
1. Is docker-compose running?
   ```bash
   docker-compose ps
   ```
   Should show: `postgres | Up` and `api | Up`

2. Can you reach it?
   ```bash
   curl http://localhost:8000/health
   ```

**Solution:**
```bash
# Restart everything
docker-compose down
docker-compose up

# In new terminal:
npm run dev
```

---

### Test 4: File upload fails

**Check:**
1. File size: Must be < 10MB
2. File type: Must be .pdf, .xlsx, .csv
3. Browser console (F12) for error details

**Solution:**
- Try with smaller file
- Convert to CSV if PDF is problematic
- Check console for specific error message

---

## ✅ What Success Looks Like

### All Tests Pass:
- ✅ Upload completes in 1-2 seconds
- ✅ Mapping screen shows columns correctly
- ✅ Auto-transitions to reconciliation
- ✅ Progress bar shows matching progress
- ✅ Can select unmatched items
- ✅ Suggestions appear with confidence scores
- ✅ Can confirm matches
- ✅ UI updates in real-time
- ✅ Progress bar increases
- ✅ No errors in browser console
- ✅ Data stored in database
- ✅ Error handling works

---

## 📊 Testing Checklist

Use this to track your testing:

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Health check returns healthy
- [ ] Can upload bank statement
- [ ] Column mapping shows correctly
- [ ] Can confirm mapping
- [ ] Auto-transitions to reconciliation
- [ ] Bank transactions visible
- [ ] Book transactions visible
- [ ] Progress bar shows percentage
- [ ] Can click unmatched transaction
- [ ] Suggestions popup appears
- [ ] Suggestions show confidence scores
- [ ] Can confirm match
- [ ] UI updates instantly
- [ ] Progress bar increases
- [ ] Matched card appears
- [ ] Data appears in database
- [ ] Error handling works (stop backend)
- [ ] Progress reaches 100% with correct data

---

## 🎯 Test Scenarios

### Scenario 1: Perfect Match (Easy)
**Setup:** Use same dates, amounts, references
**Expected:** All transactions match at 100% confidence
**Time:** 2 minutes

### Scenario 2: Fuzzy Match (Medium)
**Setup:** Similar but not identical narrations, close dates
**Expected:** Transactions match at 70-90% confidence
**Time:** 5 minutes

### Scenario 3: Edge Cases (Hard)
**Setup:** Different currencies, date formats, missing fields
**Expected:** AI handles gracefully, suggests closest matches
**Time:** 10 minutes

### Scenario 4: Large File (Performance)
**Setup:** Upload 500+ transactions
**Expected:** Completes in < 5 seconds
**Time:** 5 minutes

---

## 📈 Performance Metrics to Check

| Operation | Expected Time | How to Measure |
|-----------|---------------|----------------|
| File Upload | < 2 seconds | Watch timer from click to screen change |
| Data Extraction | < 1 second | Watch "Extracting..." to "Preview" |
| Column Mapping | < 1 second | Instant when loading page |
| Standardization | < 500ms per 100 rows | Check logs: "Standardized X transactions" |
| Matching | < 1 second per 100 vs 100 | Click start → see suggestions |
| UI Update | Real-time | Match appears instantly on screen |

---

## 🔍 API Testing (Power User)

### Test Endpoints Directly

**Health Check:**
```bash
curl http://localhost:8000/health
```

**View API Docs:**
```
http://localhost:8000/docs
```

Click through endpoints to test:
- Try `/api/reconciliation/status` to see current matching state
- Try `/api/uploads/session/{session_id}` to view upload details

---

## 📝 Test Report Template

Use this to document your testing:

```
Date: ___________
Tester: _________

UPLOAD TEST:
- File selected: ____________
- Upload time: ____________
- Result: PASS / FAIL
- Issues: ____________

MAPPING TEST:
- Columns correct: YES / NO
- Preview shows data: YES / NO
- Result: PASS / FAIL
- Issues: ____________

RECONCILIATION TEST:
- Progress bar visible: YES / NO
- Suggestions appear: YES / NO
- Confidence scores shown: YES / NO
- Result: PASS / FAIL
- Issues: ____________

MATCH APPROVAL TEST:
- Can confirm match: YES / NO
- UI updates: YES / NO
- Progress increases: YES / NO
- Result: PASS / FAIL
- Issues: ____________

OVERALL: PASS / FAIL
Notes: ____________
```

---

## 🚀 Quick Test (30 Seconds)

1. Run: `docker-compose up` (Terminal 1)
2. Run: `npm run dev` (Terminal 2)
3. Open: `http://localhost:3001`
4. Click "Bank Statement"
5. Pick any PDF/Excel/CSV file
6. See magic happen ✨

**Expected:** Full workflow completes automatically in ~10 seconds

---

## 💡 Pro Testing Tips

1. **Use Browser DevTools (F12)**
   - Console tab: See any errors
   - Network tab: Watch API calls
   - Storage tab: See localStorage

2. **Watch Docker Logs**
   ```bash
   docker-compose logs -f api
   # Watch real-time backend activity
   ```

3. **Monitor Database**
   ```bash
   watch 'psql -U dev -d reconciliation -c "SELECT COUNT(*) FROM match_groups;"'
   # Watch match count increase in real-time
   ```

4. **Test Both Happy & Sad Paths**
   - Happy: Everything works
   - Sad: Stop backend, wrong file type, missing column

5. **Vary Your Data**
   - Perfect matches (easy)
   - Fuzzy matches (medium)
   - Edge cases (hard)

---

## 🎉 You're Ready!

Everything is set up. Just follow the workflow above and you'll see the full MVP in action.

**Report any issues you find** - they help improve the system!

---

**Start now:**
```bash
docker-compose up
npm run dev
# Open http://localhost:3001
```

Happy testing! 🚀
