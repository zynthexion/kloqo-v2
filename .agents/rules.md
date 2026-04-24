# Kloqo-V2: AI Interaction & Architecture Rules

This file is a **MANDATORY** read for any AI agent interacting with this codebase. You must follow these rules without exception.

## 1. Crucial Business Logic Zones (LOCKED)
The following directories contain the "Heart" of the system. Any modification to files within these zones must follow the **Surgical Fix Protocol**.

- **Backend**: `backend/src/application/` (Use Cases), `backend/src/domain/` (Entities/Logic)
- **Frontend State**: `apps/*/src/contexts/`, `apps/*/src/hooks/`
- **Shared Standards**: `packages/shared-core/src/utils/` (especially `date-utils.ts`, `break-helpers.ts`, `estimated-time-utils.ts`)
- **Shared Types**: `packages/shared/src/`

---

## 2. Surgical Fix Protocol
When modifying files in the **Locked Zones**:
1. **No Refactoring**: Do not simplify, "clean up," or rewrite code. Only make the minimal changes necessary to address the specific task.
2. **Preserve Context**: Maintain all existing comments, docstrings, and architectural patterns.
3. **Explicit Consent**: You must summarize your proposed change and ask for user permission before executing any write operations in these zones.

---

## 3. Mandatory Architecture Standards
Refer to `ARCHITECTURE.md` for full details. High-priority rules:

### A. Time & Date (Section 8)
- **Data Format**: Always use `HH:mm` (24h) for logic and storage.
- **Shared Helpers**: **ONLY** use helpers from `packages/shared-core/src/utils/date-utils.ts` for parsing, formatting, or displaying time.
- **Manual Formatting**: Writing manual `format(date, 'hh:mm a')` or `parse(...)` in UI components is **FORBIDDEN**.

### B. Real-time Architecture (SSE)
- Frontend state updates must use **targeted merges** of SSE payloads to maintain "Instant UX" and minimize re-fetches.

---

## 4. Verification Requirements
- All changes to logic must be verified via research or by proposing test commands.
- If a change affects the UI, describe the visual impact clearly to the user.
