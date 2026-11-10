# Kodewar Digital Learn (Kodewar LMS)

> **Single-Company Digital Learning, Cohort Operations & Training Management Platform**  
> A three-portal web application unifying Super Administrators, Instructors/Tutors, and Enrolled Candidates across academic cohorts, gated live classes, attendance compliance, learning materials, leave governance, and automated onboarding.

---

## 🎯 Project Objective

**Kodewar Digital Learn (Kodewar LMS / KDL)** replaces fragmented spreadsheets and disconnected training workflows with a centralized platform tailored for single-organization cohort delivery:

1. **Candidate Lifecycle & Onboarding**: Register candidates individually (`KDL-YYYY-XXX`) with optional **n8n webhook** onboarding email automation, perform pre-validated bulk Excel/CSV imports, track batch transfers, and enforce first-login password replacement.
2. **Dynamic Course & Batch Operations**: Configure courses and batches with capacity indicators, cascade-safe deletions, and immutable candidate batch-transfer assignment histories.
3. **Granular Tutor Portals & RBAC**: Empower instructors with assigned batch views, live session access toggles, attendance roll calls with time-bounded corrections, resource publishing, and 11 Admin-configurable permission flags.
4. **Access-Gated Live Sessions**: Schedule single or recurring training sessions (Google Meet, Zoom, MS Teams) where candidate join links stay masked and disabled until explicitly enabled by an Admin or authorized Tutor.
5. **Attendance Tracking & Auditability**: Mark `present`, `absent`, `late`, and `excused` statuses per session, configure calculation rules (`lateCountsAsAttended`, `excludeExcusedFromDenominator`), and require reasons for historical edits.
6. **Unified Leave Management**: Support policy-enforced leave applications (`working_days` vs `calendar_days`, overlap checks, conditional document attachments) for both **Candidates** and **Tutors**, with Admin Approve/Reject/Revoke workflows and Excel/CSV exports.

---

## 👥 Portals & Implemented Features

### 1. 🛡️ Super Admin Portal (`src/admin/`)
- **Operational Overview (`Dashboard`)**: Real-time candidate/batch/attendance/meeting KPIs plus same-day meeting access controls.
- **Course & Batch Management**: Full CRUD, batch roster inspection, cross-batch candidate transfers, and cascade cleanup options.
- **Tutor Directory & Permissions**: Manage instructor records (`TUT-XXX`), batch/course allocations, password resets, activity metrics, CSV exports, and granular portal permissions.
- **Candidate Registry**: Add candidates (triggers n8n onboarding webhook), run 3-step Excel/CSV bulk imports (`SheetJS`), resend activation credentials, view batch transfer histories, and manage account statuses.
- **Meeting Scheduler**: Schedule single sessions or multi-occurrence series, cancel with reason, mark completed, and toggle live candidate join access.
- **Attendance Control**: Submit batch roll calls, bulk mark present, apply audited corrections, delete records, or wipe session attendance.
- **Leave Management**: Dedicated multi-tab suite (`Dashboard`, `Applications`, `Reports & Export`, `Leave Types & Policy`) supporting Approve, Reject, Revoke, Remarks, and `.xlsx`/`.csv` reporting.
- **Learning Resources**: Publish external links or Base64 file assets (`<= 15 MB` JSON payload) scoped to `all`, `course`, or `batch`.
- **Announcements & Email Outbox**: Broadcast targeted announcements alongside a simulated `emailLogs` outbox inspector (`create`, `edit`, `retry`, `delete`, `clear`).
- **Reports & System Settings**: View summary metrics, last 10 audit events, and configure company timezone, attendance formulas, email toggle, and upload caps. *(Note: Full [`AuditLogsView`](src/admin/AuditLogsView.tsx) and `GET /api/audit-logs` exist in source while the dedicated sidebar link is currently commented out; direct `<a href>` CSV export buttons in [`ReportsView`](src/admin/ReportsView.tsx) currently require Bearer auth fixes.)*

### 2. 👨‍🏫 Tutor / Instructor Portal (`src/tutor/`)
- **Dashboard**: Assigned batches overview, upcoming sessions count, permission badges, and recent alerts.
- **Assigned Batches (`My Batches`)**: Access assigned cohorts and enrolled student rosters.
- **Live Sessions**: Inspect assigned classes, jump directly into session roll call, and enable/disable live candidate join access (when `canManageMeetingAccess` is granted).
- **Attendance**: Mark session roll calls (`canRecordAttendance`) and edit past entries with mandatory correction reasons inside `attendanceEditWindowHours` (`canEditAttendance`).
- **Learning Resources**: View cohort resources and upload/delete instructor materials (when `canUploadResources` / `canManageOwnResources` are enabled).
- **Leave Requests**: Submit policy-validated instructor leave applications with supporting documents and cancel pending requests.
- **Notifications & Profile**: Read inbox updates, update instructor profile metadata (`name`, `phone`, `specialization`, `designation`), and change password.

### 3. 🎓 Candidate Learning Portal (`src/candidate/`)
- **Dashboard**: Personal attendance percentage, upcoming sessions, published materials count, and live join status card.
- **My Meetings**: View batch schedule with gated join controls (external conference links remain hidden and blocked by the backend until access is enabled).
- **Documents & Resources**: Filter and download/open published materials scoped to Global, Course, or Batch audiences.
- **My Attendance**: Review policy-weighted compliance metrics and per-session attendance logs.
- **My Leave**: View global leave policy rules, live working/calendar day calculations, overlap checks, submit leave with attachments, inspect decision timelines, and self-cancel pending requests.
- **Notifications & Profile**: Read inbox notices, inspect strictly read-only course/batch profile details, change password (including mandatory first-login reset), and sign out.

---

## 🛠️ Technology Stack

| Layer | Technologies Used in Codebase |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Lucide React |
| **Data Import / Export** | SheetJS (`xlsx`) for Excel/CSV candidate bulk import, tutor CSV export, and leave reports |
| **Backend API** | Node.js, Express 4 (`112` endpoints in `server/api.ts`), TSX runtime (`server.ts` local & `api/index.ts` Vercel adapter) |
| **Database & Sync** | Local JSON store (`data/database.json` + `.backup.json`) + Supabase Cloud PostgreSQL (`@supabase/supabase-js` storing `public.lms_state` JSONB) |
| **Automation** | n8n Webhook integration (`server/n8n.ts`, `workflow.json`) with Gemini + Gmail candidate onboarding template |
| **Authentication** | Stateless HMAC-SHA256 Bearer tokens (14-day expiry), PBKDF2-SHA512 salted password hashing (`crypto`) |

---

## 📁 Project Structure

```text
kodewar-digital-learn/
├── api/
│   └── index.ts                 # Vercel serverless Express entry (Supabase load/flush hooks)
├── data/
│   ├── database.json            # Primary local JSON data store
│   └── database.backup.json     # Automated local JSON mirror backup
├── scripts/
│   ├── migrate-to-supabase.ts   # Push local database.json into Supabase lms_state
│   ├── test-leave-management.ts # API integration test suite for Leave module (13 tests)
│   └── test-tutor-portal.ts     # API integration test suite for Tutor Portal (15 tests)
├── server/
│   ├── api.ts                   # Monolithic Express router (112 REST endpoints across 15 domains)
│   ├── auth.ts                  # Token signing/verification & role-guard middlewares
│   ├── db.ts                    # DatabaseManager singleton, integrity reconciliation, audit/email logs
│   ├── n8n.ts                   # Candidate onboarding webhook dispatcher (30s timeout protection)
│   └── supabase.ts              # Supabase client wrapper & connection test helpers
├── src/
│   ├── admin/                   # Super Admin Portal views & leave-management feature components
│   ├── tutor/                   # Instructor / Tutor Portal views
│   ├── candidate/               # Candidate Portal views & my-leave feature components
│   ├── auth/                    # LoginPage.tsx
│   ├── common/validation/       # Shared leave date, working-day, and overlap validators
│   ├── components/common/       # Shared Header.tsx & first-login ChangePasswordModal.tsx
│   ├── context/                 # AuthContext.tsx (token persistence & session bootstrap)
│   ├── services/                # Typed frontend API client (src/services/api.ts)
│   └── types/                   # Shared TypeScript domain interfaces (src/types/index.ts)
├── supabase/
│   └── schema.sql               # PostgreSQL table & RLS setup for public.lms_state
├── server.ts                    # Local Node + Vite dev/production server
├── vercel.json                  # Vercel SPA & /api rewrite rules
├── workflow.json                # Exported n8n AI onboarding workflow
└── N8N_CANDIDATE_ONBOARDING_SETUP.md
```

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (`v18+` recommended)
- [npm](https://www.npmjs.com/)

### Installation & Startup
```bash
# 1. Clone the repository
git clone https://github.com/Nagendra061/kodewar_LMS.git
cd kodewar_LMS

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. (Optional) Configure environment variables
cp .env.example .env

# 4. Start Express backend + Vite dev server
npm run dev
```

The application runs at **`http://localhost:3000`** (`PORT` env var configurable).

### Environment Variables (`.env.example`)

| Variable | Purpose |
| :--- | :--- |
| `SUPABASE_URL` | Supabase Project URL (`https://<project-id>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase API key (`anon` or `service_role` server key) |
| `N8N_WEBHOOK_URL` | Optional active n8n webhook URL for single-candidate onboarding emails |
| `N8N_WEBHOOK_SECRET` | Optional shared secret sent in `x-webhook-secret` & `Authorization: Bearer` headers |
| `APP_URL` | Public base URL included as `login_url` in n8n webhook payloads |
| `SESSION_SECRET` | Recommended production HMAC secret for signing session tokens (falls back cleanly in dev) |

---

## 🗄️ Supabase Cloud Database Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Execute [`supabase/schema.sql`](supabase/schema.sql) in the **Supabase SQL Editor** to initialize the `public.lms_state` table.
3. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) to `.env` or Vercel Environment Variables.
4. Push existing local data into Supabase at any time with:
   ```bash
   npm run migrate:supabase
   ```

> **Note:** Local `server.ts` persists primarily to `data/database.json` and `data/database.backup.json` (with manual sync via `/api/supabase/sync` or `migrate:supabase`), whereas Vercel `api/index.ts` checks `updated_at` and flushes state to Supabase on every mutating request.

---

## 📦 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Express server + Vite dev middleware on port `3000` (`tsx watch server.ts`) |
| `npm run build` | Builds frontend SPA production assets into `dist/` (`vite build`) |
| `npm run start` | Runs Express server serving the compiled `dist/` bundle (`NODE_ENV=production`) |
| `npm run preview` | Previews the built Vite bundle locally |
| `npm run lint` | Runs static TypeScript type checking (`tsc --noEmit`) |
| `npm run test:leave` | Runs integration verification tests against `/api/leave/*` and `/api/candidate/leave` |
| `npm run test:tutor` | Runs integration verification tests against `/api/tutor/*` endpoints |
| `npm run migrate:supabase` | Uploads local `data/database.json` state into Supabase `public.lms_state` |
| `npm run clean` | Removes generated `dist` and `server.js` build artifacts |

---

## 🔐 Demo Credentials & Evaluation Mode

Default accounts visible on the sign-in screen ([`src/auth/LoginPage.tsx`](src/auth/LoginPage.tsx)):

| Role | Identifier (`email` or ID) | Default Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@kodewar.com` | `admin123` |
| **Assigned Tutor** | `vinay@kodewar.com` *(or created `TUT-XXX`)* | `tutor123` |
| **Candidate** | Registered Email or `KDL-YYYY-XXX` | Temporary password issued on onboarding |

> **Important Security / Evaluation Behavior:** For instant evaluation, [`AuthContext.tsx`](src/context/AuthContext.tsx) automatically initializes unauthenticated browser sessions via `/api/auth/quick-switch` into the Super Admin Portal (clicking **Sign Out** in Settings/Profile opens [`LoginPage`](src/auth/LoginPage.tsx) for credential sign-in). Before deploying to an untrusted production environment, review the full security audit in Section 34 of [`KODEWAR_DIGITAL_LEARN_COMPLETE_SYSTEM_DOCUMENTATION.md`](KODEWAR_DIGITAL_LEARN_COMPLETE_SYSTEM_DOCUMENTATION.md).

---

## 🌐 Deployment (Vercel)

1. Import the repository into [Vercel](https://vercel.com) (framework preset: **Vite**, configured via [`vercel.json`](vercel.json)).
2. Configure environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and optional `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET`, `APP_URL`).
3. Vercel serves static SPA assets from `dist/` and rewrites `/api/*` traffic to the serverless Express handler in [`api/index.ts`](api/index.ts).

---

## 📚 Additional Documentation

- **[Complete System Workflow, Architecture & UML Reference](KODEWAR_DIGITAL_LEARN_COMPLETE_SYSTEM_DOCUMENTATION.md)** — Exhaustive 40-section technical blueprint covering all 3 portals, all 112 REST endpoints, role/permission audits, action specs, failure/edge matrices, ERD, and 15 Mermaid UML diagrams.
- **[n8n Candidate Onboarding Automation Setup](N8N_CANDIDATE_ONBOARDING_SETUP.md)** & **[`workflow.json`](workflow.json)** — Step-by-step configuration guide for webhook-driven candidate welcome emails via Gemini and Gmail.
