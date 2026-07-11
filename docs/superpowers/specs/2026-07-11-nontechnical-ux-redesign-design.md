# Design: Non-Technical UX Redesign

**Date:** 2026-07-11
**Status:** Approved by user
**Branch:** fix/ui-ux-enhancements

## Problem

The platform is functional (UI/UX test report rated it 7.5/10, no critical bugs) but reads as "a serviceable internal tool for engineers." Its actual target users are cross-department, non-technical employees (marketing, operations, support). The design language — Station/Step, `script-js`, webhook triggers, log tables, success-rate percentages — is built around an engineer's mental model. The product feels generic because its intended users face a comprehension barrier at every screen.

## Goal

Reposition the product from "an engineer's workflow tool" to "an automation assistant for everyday employees," in three independently shippable phases. Advanced capability is never removed — it moves behind an "Advanced" surface so technical users lose nothing.

## Design Principles

1. **Business language first** — every visible word must be understandable to someone who doesn't code.
2. **Templates before blank canvas** — a new user's first step is always picking a close-enough template.
3. **Results told as a story** — run history shows "what happened," not a log dump.
4. **Advanced power is relocated, not deleted** — canvas, custom scripts, and variable syntax remain, tucked into Advanced modes/sections.

UI language stays **English**, with terminology rewritten in plain English. No i18n framework in this effort.

## Terminology (display layer only)

Internal type keys, DB schema, and API contracts are unchanged — zero data migration. Display labels live in `frontend/src/shared/types/workflow.ts` (`STEP_TYPE_INFO`) and UI copy.

| Current | New display term |
|---|---|
| Workflow | Automation |
| Station / Stage | Stage (kept — already plain) |
| Step | Action |
| Execution | Run ("Run History", "3 runs today") |
| Trigger: manual / cron / webhook | "Start manually" / "On a schedule" / "When another system calls" |
| Script-JS / Script-Python | Custom Script (under Advanced category) |
| HTTP Request | Call an external service |
| Set Variable | Remember a value |
| If/Else | Decision |
| Simulate | Test |
| Node Library categories | "When it starts" / "Do something" / "Flow control" / "Advanced" |

---

## Phase 1 — Entry & Presentation Reshape

### 1a. Template Gallery

- Dashboard's "+ New Workflow" opens a **"New Automation"** page: a wall of template cards grouped by purpose (Notifications, Reports, Data Processing, Approvals), with a low-key "Start from scratch" entry below.
- Each card shows: name, one-line description, and an icon sequence of the actions involved (e.g. 📧→🔀→💬).
- Selecting a template creates a draft Automation pre-filled with its stages/actions and opens the editor.
- **Implementation:** templates are prebuilt `WorkflowDefinition` JSON stored as frontend static data (`frontend/src/features/templates/templates.ts`). No backend change. Ship 6–8 templates; the three existing demo workflows (Data Processing Pipeline, Scheduled Daily Report, Webhook Order Processor) become the first three.

### 1b. Run Timeline (replaces log table as default view)

- Executions page renamed **"Runs"**. Expanding a run shows a **timeline view** by default: one node per stage, one plain-language line per action — "Sent email to 3 people ✓", "Fetched 42 records from API ✓", "Stopped: recipient address invalid ✗".
- Summaries come from a per-action-type `summarize(config, output)` function (pure frontend, colocated with `STEP_TYPE_INFO`), derived from the existing execution result JSON. **No backend change.** Summary quality is bounded by what the result JSON already contains — accepted trade-off.
- **Error translation layer:** common error patterns (timeout, DNS, SMTP auth, JSON parse) map to plain-language explanations plus a suggested action; unmatched errors fall back to the raw message.
- The detailed log table moves into a collapsed "Technical details" section.
- Also fixes report items X-1 (expanded row collapses on scroll) and X-3 (add pagination).

### 1c. Clear the remaining test-report items

- D-2: description text wrapping at narrow viewports
- D-3: delete button clipped at right edge
- D-5: disable the play button for draft Automations with a hint to activate first
- E-1: Node Library auto-closes when returning to stage view
- E-2: Ctrl+S saves in the editor
- M-2: enlarge the Run Results pie chart
- M-3: Monitoring gains a "Scheduled" section listing schedules and next-run times
- N-1: sidebar navigation becomes Dashboard / Runs / Monitoring; the editor is reached from the Automation list

---

## Phase 2 — Guided Builder

### Plan View

From a template, non-technical users land in a **linear Plan View** instead of the React Flow canvas — stages/actions as a vertical list that reads like a plan:

```
When it starts:  ⏰ Every day at 9:00 AM          [edit]
Stage 1 — Collect data
  🔗 Call an external service (api.example.com)   [edit]
Stage 2 — Send report
  📧 Send email to team@company.com               [edit]
+ Add a stage
```

- Plan View and Canvas View are **two renderings of the same data**, toggled at top-right. Default view persisted in localStorage. Complex branching is the canvas's job; Plan View covers ~90% of non-technical use.
- **Implementation:** new component `frontend/src/features/editor/components/PlanView.tsx` reading/writing the existing `workflowStore` — no new data layer, the views stay in sync by construction.

### Two-tier action config panels

- Each action's settings split into **Basic** (required fields with plain labels — Send email shows only To / Subject / Message) and a collapsed **Advanced** section (headers, variable syntax, timeouts).
- Referencing a previous action's output replaces hand-typed `${step1.output.x}` with a **dropdown picker**: "Use result from → Stage 1 / Call an external service → response body," which generates the syntax. Direct syntax entry still works.
- Send email panel gains a live message preview.

### Onboarding

- First editor visit shows 3-step coach marks (this is your plan → click edit to change → press Test to try it).
- "Simulate" is renamed "Test".

---

## Phase 3 — AI Assist (independent; Phases 1–2 do not depend on it)

- **Entry:** an input above the template wall — "Describe what you want to automate…" → `POST /api/ai/draft` → LLM generates a `WorkflowDefinition` JSON → opens as a draft in Plan View. AI output lands on the plain-language surface, so users can read and edit it.
- **Run failure explanation:** error nodes in the Run Timeline get an "Explain this" button → `POST /api/ai/explain` with error context → plain-language explanation and suggestion.
- **Architecture:** new `backend/src/services/aiAssistant.ts`; LLM key via `ANTHROPIC_API_KEY` env var. **When the key is unset, all AI UI is hidden** — this is the concrete mechanism making the phase independent; the product is fully functional without it.
- LLM output is validated against a JSON Schema before persisting; on failure, show "AI draft failed — try a template instead."

---

## Error Handling

- The error translation layer (1b) is the only new error mechanism: pure functions, unit-testable.
- AI endpoints degrade gracefully (feature hidden or "try a template" prompt); they never block the main flow.

## Testing

- Vitest + Testing Library, matching existing test style. New components (TemplateGallery, RunTimeline, PlanView, two-tier config panels) each get tests.
- `summarize()` and error translation are pure functions — priority coverage.
- Terminology changes update copy assertions in existing tests.
- Acceptance per phase: load pages in Chrome, screenshot at ~1280px and ~375px, console clean.

## Out of Scope

- i18n / Chinese UI
- Backend data model or API contract changes (except the two Phase 3 AI endpoints)
- New step types
