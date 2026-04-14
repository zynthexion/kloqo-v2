# Kloqo V2 — Architecture & Engineering Principles

> **This document is the source of truth for all engineering decisions in this codebase.**
> Any agent or developer making changes must respect these principles before modifying any file.

---

## 1. Project Structure (Clean Architecture)

```
backend/src/
├── domain/           ← Interfaces, entities, pure business rules. No I/O.
│   ├── repositories.ts        ← Repository interfaces only
│   └── services/
│       ├── token/             ← Token strategy pattern (see §4)
│       ├── SlotScheduler.ts   ← Pure zipper algorithm (no side effects)
│       └── SlotCalculator.ts  ← Pure slot generation
├── application/      ← Use cases. One class per use case. No Firestore here.
├── infrastructure/   ← Firebase/Firestore implementations. I/O only, no logic.
└── interfaces/       ← HTTP controllers. Thin adapters — no business logic.
```

**Rule:** Business logic lives in `domain/` and `application/` only. Never in `infrastructure/` or `interfaces/`.

---

## 2. Principles Checklist

Before any code change, verify:

| Principle | Rule |
|-----------|------|
| **S** — Single Responsibility | Each use case does exactly one thing. Each class has one reason to change. |
| **O** — Open/Closed | Token modes, notification types → extend via new class, not by editing existing ones. |
| **L** — Liskov Substitution | Concrete repos and strategies must be fully substitutable for their interfaces. |
| **I** — Interface Segregation | Repository interfaces are scoped tightly. Don't add unrelated methods. |
| **D** — Dependency Inversion | Use cases depend on interfaces (`IAppointmentRepository`, `ITokenStrategy`), never on Firebase. |
| **DRY** | Patient upsert → `ManagePatientUseCase`. Token logic → `ITokenStrategy`. Never duplicate. |
| **KISS** | No clever abstractions beyond what's needed. Each strategy/use case should be readable in isolation. |
| **YAGNI** | Don't add generic catch-all use cases. Delete dead code. |
| **Fail Fast** | Validate all inputs at the top of `execute()` before any DB writes. |
| **Law of Demeter** | Frontend calls REST API only. Frontend must NOT write directly to Firestore. |

---

## 3. Token Distribution Logic

### Classic Distribution
| Event | Action |
|-------|--------|
| Patient books (Advanced) | `status: 'Pending'`, `tokenNumber: null` |
| Patient arrives → Confirmed | `classicTokenNumber` assigned: `001`, `002`... (arrival order) |
| Walk-in arrives | `classicTokenNumber` assigned immediately |

### Advanced (Kloqo Advanced) Distribution
| Event | Action |
|-------|--------|
| Patient books (Advanced) | `tokenNumber: 'A001'` assigned at booking time |
| Patient arrives → Confirmed | No change to token |
| Walk-in arrives | `tokenNumber: 'W101'` assigned via zipper scheduler |

---

## 4. Strategy Pattern — `ITokenStrategy`

Adding a new distribution mode requires **zero changes** to existing use cases.

```
domain/services/token/
  ITokenStrategy.ts           ← interface (2 methods)
  AdvancedTokenStrategy.ts    ← A001 at booking; no-op on arrival
  ClassicTokenStrategy.ts     ← null at booking; 001 on arrival
  TokenStrategyFactory.ts     ← picks strategy from clinic.tokenDistribution
```

**In use cases, always use the factory:**
```ts
const strategy = TokenStrategyFactory.create(clinic.tokenDistribution, this.appointmentRepo);
const token = await strategy.generateBookingToken(params);
```

---

## 5. Walk-in Scheduling — Zipper Algorithm

Walk-ins in **advanced mode** use `computeWalkInSchedule()` in `SlotScheduler.ts`.

- It interleaves advance (`A`) and walk-in (`W`) appointments in the queue.
- It is a **pure function** with no side effects — keep it that way.
- The spacing between walk-ins is controlled by `clinic.walkInTokenAllotment`.

---

## 6. Frontend Rules (The "Dumb Frontend" & SSE Mandate)

**The V2 frontend must only call REST API endpoints and listen to SSE.**

❌ **Forbidden in V2 frontends:**
- Direct Firestore writes (`doc(db, ...)`, `updateDoc`, `runTransaction`).
- Direct Firestore reads or polling (`getDocs`, `setInterval` API calls).
- ANY use of `firebase/firestore` `onSnapshot` listeners. The frontend must remain 100% disconnected from the database.

✅ **Allowed in V2 frontends:**
- `GET` / `POST` / `PATCH` calls to the Node.js `/api/...` backend.
- **Server-Sent Events (SSE):** Real-time UI updates must ONLY be handled via the centralized `useSSE` hook listening to the backend's push events.
- FCM Token Registration (the only permitted use of the Firebase Client SDK).

---

## 7. Booking Routes

| Route | Use Case | Notes |
|-------|----------|-------|
| `POST /appointments/book-advanced` | `BookAdvancedAppointmentUseCase` | With or without slot reservation |
| `POST /appointments/walk-in` | `CreateWalkInAppointmentUseCase` | Includes patient upsert + zipper scheduling |
| `PATCH /appointments/:id/status` | `UpdateAppointmentStatusUseCase` | Triggers classic token on 'Confirmed', buffer refill on terminal states |

---

## 8. The Golden Standard: Time & Date Architecture

Kloqo enforces a strict **"24-Hour Native"** architecture to prevent "Off-by-12" errors and ensure chronological sorting consistency across the monorepo.

### 8.1. Data Storage & Logic Standard
| Context | Format | Rule |
|---------|--------|------|
| **Firestore Date** | `'d MMMM yyyy'` | e.g., `22 March 2026` |
| **Firestore Time** | `'HH:mm'` | **STRICT 24h**. Never store AM/PM strings. |
| **Business Logic** | `HH:mm` | All sorting and comparisons must use 24h strings or Dates. |
| **View Layer** | `hh:mm a` | e.g., `02:30 PM`. Relegated **only** to the final render. |

### 8.2. Code-Level Centralization (Level 100)
To prevent logic fragmentation, **ALL** applications (Backend, Nurse, Clinic, Superadmin, and future Patient App) must orchestration time via:
- **Primary Package**: `@kloqo/shared-core`
- **Source File**: `packages/shared-core/src/utils/date-utils.ts`

**Mandatory Usage:**
- ❌ **Do NOT** write manual `format(date, 'hh:mm a')` or `parse(...)` in UI components.
- ✅ **DO** use shared helpers:
    - `displayTime12h(timeStr)`: Converts stored `HH:mm` to `hh:mm a` for display.
    - `displayTimeWithBuffer(timeStr, 15)`: Handles "Arrive By" display logic centrally.
    - `getClinicTimeString()`: Generates the current standard `HH:mm` string.

### 8.3. Timezone Principle
- All time operations assume **Asia/Kolkata (IST)**.
- Use `getClinicNow()` or `parseClinicTime()` from `@kloqo/shared-core` to ensure timezone offsets are handled correctly, regardless of where the server or client is running.
- The Backend bridge in `backend/src/domain/services/DateUtils.ts` must always re-export from `shared-core`.

---

## 9. Dependency Injection & Composition Root

All object instantiation is centralized. Controllers and Use Cases NEVER use `new`.

> [!IMPORTANT]
> **The Wiring Rule:**
> 1.  **Repositories** are instantiated once in `Container.ts` (Layer 1).
> 2.  **Use Cases** receive repositories via Constructor Injection (Layer 3).
> 3.  **Controllers** receive Use Cases via Constructor Injection (Layer 4).
> 4.  **Routes** import the `container` singleton to bind paths to controller methods.
> 
> *Constraint:* If a file outside of `Container.ts` contains the `new` keyword for a class in `src/`, it is an architectural violation.

---

## 10. The "Check-then-Act" Transaction Rule

Atomic business flows skip the "No I/O in Use Case" rule to prevent race conditions.

> [!TIP]
> **Atomic Execution:**
> While Use Cases are generally pure, any logic requiring "Read-then-Write" consistency (like Patient Upserts or Token Increments) **MUST** be wrapped in `db.runTransaction()`.
> 
> *Rule:* Do not rely on sequential `await` calls for logic where two simultaneous requests could cause data duplication. Use Firestore transactions to ensure the "Check" phase is locked until the "Act" phase completes.

---

## 11. Error Handling & Sanitization

Use Cases throw; Express catches; Global Handler sanitizes.

> [!WARNING]
> **Sanitization Boundary:**
> 1.  **Use Cases:** Throw standard `Error` objects with semantic messages (e.g., `Error('Clinic not found')`).
> 2.  **Controllers:** Use `try/catch` or let the error bubble to the top.
> 3.  **Global Handler:** Located at the bottom of `infrastructure/webserver/express/index.ts`. It is the **only** place responsible for:
>     *   Logging the `err.stack` to internal server logs.
>     *   Stripping the stack trace from the JSON response.
>     *   Returning a consistent `{ error: string, code: string }` object.

---

## 12. Route Security & RBAC Standard

Security is a middleware concern, not a controller concern.

> [!IMPORTANT]
> **The Security Chain:**
> Every routing file MUST use the `createMiddleware` factory. Routes follow a strict hierarchy:
> 1.  **Public:** No middleware (e.g., `/discovery`).
> 2.  **Protected:** `auth` middleware only (e.g., `/appointments/me`).
> 3.  **Role-Restricted:** `auth` + `checkRole(...roles)` chain (e.g., `/superadmin/*`).
> 
> *Constraint:* Permission checks must NOT live inside Controller methods. They must be visible in the route definition for auditability. All backend role evaluations MUST utilize the `RBACUtils` shared utility from `@kloqo/shared` to ensure Dual-Read safety (Phase 4).

---

## 13. External Webhook Integrity

No external data is trusted without a cryptographic signature.

> [!CAUTION]
> **Webhook Verification:**
> Any endpoint receiving external pushes (Razorpay, WhatsApp Cloud API, etc.) MUST verify the payload signature using the appropriate provider secret.
> 
> *Standard Implementation:*

---

## 14. FinOps & Database Cost Optimization (Strict Read Limits)

Our database charges per document read. All backend and frontend code MUST adhere to strict FinOps rules to prevent billing explosions. AI Agents MUST audit their generated queries against these rules before completing a task.

* **Rule 14.1: Zero Unbounded Queries:** You are strictly forbidden from writing `collection.get()` or `findAll()` without a `limit()` or strict `where()` clauses (like `clinicId` and `dateRange`). 
* **Rule 14.2: No N+1 Queries:** Never execute a database query inside a `for` loop, `map`, or `forEach`. You must batch IDs and use `where('id', 'in', [...])` to fetch related data in a single query.
* **Rule 14.3: Use Server Aggregation:** Never download documents just to count them. You must use Firestore's native `.count().get()` aggregation for all metrics and dashboard stats.
* **Rule 14.4: Hook Stability (Frontend):** Any React hook that manages data fetching, SSE connections, or database state MUST strictly wrap its return objects in `useMemo` and its functions in `useCallback` to prevent infinite render/read loops.

---

## 15. Strict Tenant Isolation (Multi-Tenancy Security)

Kloqo is a multi-tenant SaaS. Data bleed between clinics is a company-killing event. 

* **Rule 15.1: Never Trust the Body:** Controllers MUST NEVER blindly execute a Use Case using `req.body.clinicId` or `req.query.clinicId`. 
* **Rule 15.2: The Verification Chain:** Before any clinic-specific data is read or written, the Controller MUST verify that the requested `clinicId` matches the authenticated user's authorized clinics (`req.user.clinicId` / `req.user.clinicIds`).
* **Rule 15.3: Backend Enforced Scope:** All Database Repositories must enforce the tenant boundary at the query level (e.g., `where('clinicId', '==', targetClinicId)`).

---

## 16. Component Slicing & File Size Limits

To maintain readability, testability, and prevent React render loops, we enforce strict file size limits across the monorepo.

* **The 300-Line Soft Limit:** If a frontend file exceeds 300 lines, it is doing too much. The developer/agent MUST pause and decompose the file.
* **Separation of Concerns:** Complex state, math, and API calls must be extracted into custom hooks (e.g., `hooks/use-feature.ts`). Massive UI blocks must be extracted into "dumb" child components that only receive props.
* **The Orchestrator Rule:** Next.js `page.tsx` files should act only as orchestrators. They should ideally remain under 100 lines, calling hooks for data and passing that data to UI components.

---

## 17. Monorepo Shared Types (`@kloqo/shared`)

Kloqo utilizes a monorepo structure to share domain knowledge across 4 frontends and 1 backend.

*   **Single Source of Truth:** Core domain entities (`Appointment`, `Patient`, `User`, `Doctor`), Zod Schemas, and API Request/Response payloads MUST be defined in the `@kloqo/shared` package.
*   **No Local Redundancy:** Individual applications (`clinic-admin`, `nurse-app`, `backend`) are strictly forbidden from defining their own local versions of core types. If a type needs a new property, update it globally in the shared package.
*   **Deprecation of `user.role`:** The use of the singular `user.role` string for any new routing or authorization logic is strictly forbidden. Developers MUST use the `roles` array and the shared `Role` union type via `RBACUtils`.

---

## 18. Resource Consumption & OOM Prevention (SRE Protocol)

Kloqo is designed to run efficiently on scaled cloud infrastructure (e.g., Render free-tier). 

* **The OOM Fix (`ts-node --transpile-only`):** The backend MUST run using `ts-node --transpile-only` in production/staging to bypass heavy TypeScript compiler memory allocations that cause Out-of-Memory (OOM) crashes.
* **The Shared-Core Mandate:** To protect database read quotas and reduce API surface area, any business logic that could result in multiple simultaneous reads/writes (e.g., Walk-in scheduling, appointment booking) MUST be centralized in `@kloqo/shared-core` and executed as atomic transactions. Fragments of business logic isolated in the Next.js apps or standard route controllers lead to "Database Hammering" and are strictly prohibited.
