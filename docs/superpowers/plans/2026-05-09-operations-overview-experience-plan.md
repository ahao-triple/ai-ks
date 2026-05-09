# Operations Overview Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operations overview dashboard (metrics-first) and lightweight unified UX states in the existing admin operations workspace.

**Architecture:** Keep all data fetches in `App.tsx`, add a dedicated front-end aggregation helper `operationsOverview.ts`, and render overview sections in `OperationsWorkspace.tsx` using existing UI primitives. Avoid new backend APIs in v1; only consume already-loaded state.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing local UI components (`MetricCard`, `Panel`, `StatusBadge`, `ReadoutGrid`).

---

## File Structure

- Create: `apps/web/src/lib/operationsOverview.ts`
  - Owns overview metrics/rankings/exceptions aggregation and formatting-safe output.
- Create: `apps/web/src/lib/operationsOverview.test.ts`
  - Unit tests for aggregation invariants and edge cases.
- Modify: `apps/web/src/App.tsx`
  - Build overview data from existing loaded state and pass to operations workspace.
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
  - Render overview panel, empty states, rankings, exceptions, and summary.
- Modify: `apps/web/src/pages/pages.test.tsx`
  - Verify overview section and baseline empty-state rendering.
- Modify: `apps/web/src/styles.css`
  - Add overview layout/state styles and responsive behavior.

---

### Task 1: Aggregation Helper With TDD

**Files:**
- Create: `apps/web/src/lib/operationsOverview.test.ts`
- Create: `apps/web/src/lib/operationsOverview.ts`

- [ ] **Step 1: Write failing helper tests**
- [ ] **Step 2: Run helper tests and confirm fail**
- [ ] **Step 3: Implement minimal helper to satisfy tests**
- [ ] **Step 4: Re-run helper tests and confirm pass**
- [ ] **Step 5: Commit helper changes**

---

### Task 2: Workspace Overview Rendering With TDD

**Files:**
- Modify: `apps/web/src/pages/pages.test.tsx`
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Add failing page tests for overview rendering**
- [ ] **Step 2: Run page tests and confirm fail**
- [ ] **Step 3: Implement overview UI section and empty states**
- [ ] **Step 4: Add responsive overview styles**
- [ ] **Step 5: Re-run page tests and confirm pass**
- [ ] **Step 6: Commit workspace UI changes**

---

### Task 3: App Wiring And Regression Verification

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Wire aggregated overview data in `App.tsx`**
- [ ] **Step 2: Pass overview payload into `OperationsWorkspace`**
- [ ] **Step 3: Run targeted tests (`operationsOverview`, `pages`)**
- [ ] **Step 4: Run full web verification**
  - `pnpm --filter web test`
  - `pnpm --filter web lint`
  - `pnpm --filter web build`
- [ ] **Step 5: Commit app wiring**

---

### Task 4: Final Validation

- [ ] **Step 1: Run `git status --short` and ensure only intended files changed**
- [ ] **Step 2: Re-open key files for quick consistency scan**
- [ ] **Step 3: Prepare completion summary with exact verification evidence**
