# AI Reconciliation SaaS - Prototype

A fully interactive prototype demonstrating the core UI/UX workflow for an AI-powered bank reconciliation tool.

## 🎯 What's Included

This prototype showcases three key steps of the reconciliation workflow:

### 1. **Upload Step** (`/src/components/UploadStep.tsx`)
- Intuitive drag-and-drop interface for uploading bank statements and cash books
- Support for PDF, XLSX, and CSV formats
- Demo mode: Click any upload area to load sample data

### 2. **Mapping Step** (`/src/components/MappingStep.tsx`)
- AI column detection and verification
- User-friendly interface to correct AI's column guesses
- Real-time data preview as mapping is adjusted
- Saves learned patterns for future uploads

### 3. **Reconciliation Workspace** (`/src/components/ReconciliationStep.tsx`)
- **Split-View UI**: Bank transactions (left) vs. Cash Book (right)
- **Real-time Progress**: Visual progress bar showing match completion
- **Confidence Scoring**: Matches color-coded by confidence level
  - 🚀 Green (95%+): Auto-matched
  - 🟡 Yellow (70-94%): AI suggestions
  - 🔴 Red (<70%): Manual review needed
- **Match Review Panel**: Detailed AI analysis of each suggested match
  - Score breakdown (Value, Date, Narration)
  - One-click confirmation or rejection

## 🚀 Getting Started

### Installation
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3001
```

### Demo Flow
1. Click "Bank Statement" upload to load mock bank data
2. Verify the AI's column mappings
3. Review and approve matches in the workspace
4. Watch the progress bar update in real-time

## 📁 Directory Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main page
├── components/
│   ├── UploadStep.tsx       # File upload UI
│   ├── MappingStep.tsx      # Column mapping verification
│   ├── ReconciliationStep.tsx # Main workspace
│   └── MatchReviewPanel.tsx  # Match details sidebar
├── store/
│   └── reconciliation.ts    # Zustand state management
├── data/
│   └── mockData.ts          # Sample transactions
└── styles/
    └── globals.css          # Tailwind CSS setup
```

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Icons**: Lucide React
- **Build**: Node.js 20+

## 🎨 Key Components

### State Management (Zustand)
The `useReconciliationStore` hook manages:
- Current step in the workflow
- Bank and book transactions
- Match groups and confidence scores
- Column mappings
- Upload history

### Confidence Scoring System
The prototype implements a simplified version of the full scoring formula:

$$S = (0.5 \cdot v_{val}) + (0.2 \cdot v_{date}) + (0.2 \cdot v_{ref}) + (0.1 \cdot v_{narr})$$

Where:
- **Value Match** (50%): Exact amount match
- **Date Proximity** (20%): Transaction date within acceptable range
- **Reference ID** (20%): Check/Invoice number match
- **Narration Similarity** (10%): Fuzzy string matching

## 📊 Mock Data

The prototype includes 8 bank transactions and 8 book transactions with realistic:
- Date formatting (YYYY-MM-DD)
- Various narration styles
- Mixed match scenarios (1:1, some unmatched)
- Realistic amounts

## 🔄 Next Steps to Production

To extend this prototype into a full product:

1. **Connect Real Data Sources**
   - Replace mock data with Azure AI Document Intelligence
   - Implement PDF/Excel parsing
   - Add database persistence (PostgreSQL/Supabase)

2. **Build the Backend API**
   - FastAPI service for matching engine
   - RapidFuzz for fuzzy string matching
   - GPT-4o-mini for narration cleaning

3. **Add Authentication**
   - Integrate Clerk for user management
   - Implement org-level data isolation

4. **Enhance Reporting**
   - PDF generation for reconciliation statements
   - Audit trail exports
   - Integration with accounting software

## 📝 Code Quality

- **TypeScript**: Full type safety
- **Component-Driven**: Reusable React components
- **Tailwind CSS**: Utility-first styling
- **Responsive Design**: Works on mobile, tablet, desktop

## 🐛 Tips for Customization

### Change Colors
Edit the Tailwind classes (e.g., `bg-blue-600` → `bg-indigo-600`)

### Adjust Confidence Thresholds
Modify `ReconciliationStep.tsx` or the scoring logic in the store

### Add More Mock Data
Expand arrays in `src/data/mockData.ts`

### Customize Matching Algorithm
Update logic in `useReconciliationStore` or `ReconciliationStep.tsx`

## 📄 License

Built for demonstration purposes.

---

**Questions?** Review the component files—each is heavily commented and follows industry best practices.
