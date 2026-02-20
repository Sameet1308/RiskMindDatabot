# Pranali - Frontend & UI Tasks

## Your Role
Frontend Developer — Build new UI pages and improve existing ones.

## Setup
Make sure you can run the frontend:
```powershell
cd frontend
npm install
npm run dev
```
App runs at http://localhost:5173

---

## Task 1: Smart Alerts Dashboard Page ⭐ HIGH PRIORITY
**Deadline:** End of Week 1

### What to Build
A new page at `/alerts` that shows risk alerts to underwriters.

### Steps
1. Create `frontend/src/pages/Alerts.tsx`
2. Add "Alerts" nav link in `frontend/src/components/Layout.tsx`
3. Add route in `frontend/src/App.tsx`:
   ```tsx
   <Route path="alerts" element={<Alerts />} />
   ```

### Mock Data to Use (until Anshul's API is ready)
```tsx
const mockAlerts = [
  { id: 1, type: 'high_frequency', severity: 'critical', policy: 'COMM-2024-002', holder: 'XYZ Restaurant', message: '5 claims filed - exceeds threshold', date: '2026-02-09' },
  { id: 2, type: 'severity', severity: 'critical', policy: 'COMM-2024-003', holder: 'SafeBuild Construction', message: '$175,000 claim exceeds $100K limit', date: '2026-02-08' },
  { id: 3, type: 'renewal', severity: 'info', policy: 'COMM-2024-001', holder: 'ABC Manufacturing', message: 'Policy renews in 25 days', date: '2026-02-07' },
  { id: 4, type: 'loss_ratio', severity: 'warning', policy: 'COMM-2024-002', holder: 'XYZ Restaurant', message: 'Loss ratio at 78% - above 65% threshold', date: '2026-02-06' },
]
```

### UI Requirements
- Filter buttons at top: All | Critical | Warning | Info
- Each alert is a card with:
  - Left color bar (red=critical, yellow=warning, blue=info)
  - Icon based on type
  - Policy number + holder name
  - Alert message
  - Date
- Follow existing styles in `index.css`

### Done When
- [ ] Page loads at http://localhost:5173/alerts
- [ ] Nav link shows in header
- [ ] Filters work
- [ ] Looks consistent with rest of app

---

## Task 2: Underwriter Workbench Page
**Deadline:** End of Week 2

### What to Build
A portfolio view page at `/workbench` showing the underwriter's book of business.

### Steps
1. Create `frontend/src/pages/Workbench.tsx`
2. Add "My Book" nav link in Layout
3. Add route in App.tsx

### Page Layout
```
┌─────────────────────────────────────────────────┐
│  My Book of Business                             │
├────────┬────────┬────────┬────────┐             │
│ Total  │ Pending│ Avg    │ Renewal│             │
│ 20     │ 5      │ 58%    │ 3 this │             │
│ Policies│Review │ Loss   │ month  │             │
└────────┴────────┴────────┴────────┘             │
│                                                  │
│  Search: [________________]                      │
│                                                  │
│  Policy # | Holder     | Type   | Risk | Renewal│
│  COMM-001 | ABC Mfg    | Comm   | Low  | Mar 15 │
│  COMM-002 | XYZ Rest   | Comm   | High | Apr 01 │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

### Done When
- [ ] Page loads at http://localhost:5173/workbench
- [ ] 4 stat cards at top
- [ ] Policy table with sortable columns
- [ ] Clicking policy number goes to /analyze?policy=XXX
- [ ] Search filters the table

---

## Tips
- Look at `Dashboard.tsx` for stat card patterns
- Look at `Guidelines.tsx` for search/filter patterns
- Look at `PolicyAnalysis.tsx` for linking to analysis
- Use CSS classes from `index.css` (card, stat-card, table-container, etc.)
- Import icons from `lucide-react`
