# Kodewar LMS (KDL)

> **Single-Company Digital Learning & Candidate Management Platform**  
> Streamlining cohort training, curriculum delivery, interactive live classes, and candidate lifecycle management.

---

## 🎯 Project Objective

The primary objective of **Kodewar LMS (KDL)** is to provide an end-to-end, single-company learning management system (LMS) and candidate tracking portal. It replaces fragmented spreadsheets and disconnected tools with a unified platform that connects administrators, instructors, and student candidates.

### Core Goals:
1. **Streamline Candidate Administration**: Manage the complete lifecycle of candidates from registration, bulk CSV/Excel import, and automated candidate ID generation (`KDL-YYYY-XXX`) to course enrollment and batch transfers.
2. **Dynamic Academic Management**: Create, update, and manage modular courses, cohorts (batches), and assigned tutors with live enrollment capacity tracking.
3. **Controlled Live Class Delivery**: Schedule recurring and one-off live training sessions (Google Meet, Zoom, MS Teams) with administrator-controlled live join access.
4. **Attendance Tracking & Compliance**: Record session attendance (Present, Late, Excused, Absent), calculate compliance rates, and maintain an audit log for attendance corrections.
5. **Secure Learning Resource Hub**: Centralize lecture notes, source code repositories, assignments, and study materials organized by course and batch.
6. **Dual-Role Experience**: Provide a Super Admin dashboard for operations and a dedicated Candidate Portal for learning activities.

---

## 👥 Portals & Key Features

### 1. 🛡️ Super Admin Portal
- **Dashboard & Analytics**: Real-time summary of active candidates, running cohorts, scheduled meetings, and attendance percentages.
- **Candidate Directory**: Add single candidates, perform bulk Excel/CSV imports with pre-validation, reset activation credentials, and manage batch allocations.
- **Course & Batch Management**: Configure curricula, course durations, and start/end timelines; create and assign batches to specific courses.
- **Tutor Management**: Maintain instructor profiles, contact details, and course specializations.
- **Meeting Scheduler**: Schedule single or recurring sessions with date, time, platform URL, and toggle live session access for candidates.
- **Attendance Management**: Mark session rosters, re-calculate attendance metrics, and apply audit-logged corrections.
- **Resource Center**: Upload and categorize learning assets (documents, videos, code repositories, notes) with audience targeting.
- **Announcements & Notifications**: Broadcast real-time announcements to specific courses, batches, or all candidates.
- **Audit Logging**: Trace administrative actions (logins, deletions, updates, transfers) for security compliance.
- **System Settings**: Configure company branding, timezones, attendance weighting, and reminder preferences.

### 2. 🎓 Candidate Learning Portal
- **Personalized Dashboard**: View active batch progress, enrolled course details, attendance status, and today's schedule.
- **Live Class Schedule**: Timetable of upcoming classes with a dynamic "Join Session" link enabled when the instructor activates access.
- **My Resources**: Filter and download assigned course slides, syllabus, reference materials, and recording links.
- **Attendance Insights**: View detailed personal attendance percentage and session-by-session history.
- **Notification Inbox**: Read company updates and cohort-specific notices.
- **Profile & Security**: Manage account credentials with mandatory first-login password updates.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Motion |
| **Backend** | Node.js, Express, TSX, Serverless API adapter (`api/index.ts`) |
| **Data & Storage** | Supabase Cloud PostgreSQL (with local JSON fallback and automated mirror backups) |
| **Authentication** | Bearer Token session management, PBKDF2 password hashing with unique salts |
| **Deployment** | Vercel (Frontend SPA + Serverless Express API), Cross-platform Windows/Linux support |

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (v9 or higher)

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/Nagendra061/kodewar_LMS.git
cd kodewar_LMS

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Start development server
npm run dev
```

The application will be live at:
👉 **`http://localhost:3000`**

---

## 🔐 Default Admin Credentials

For initial testing and setup:

| Field | Value |
| :--- | :--- |
| **Email** | `admin@kodewar.com` |
| **Password** | `admin123` |
| **Role** | Super Admin |

---

## 🗄️ Supabase Cloud Database Setup

To enable persistent cloud database synchronization with Supabase:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the script found in [`supabase/schema.sql`](supabase/schema.sql).
3. Copy your **Project URL** and **API Key (anon or service_role)** from **Project Settings > API**.
4. Configure either:
   - In `.env`:
     ```env
     SUPABASE_URL="https://your-project-id.supabase.co"
     SUPABASE_ANON_KEY="your-anon-or-service-role-key"
     ```
   - OR directly inside the **Super Admin Portal > Settings > Supabase Cloud Database** section and click **Connect & Sync**.

---

## 📦 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Express backend server + Vite middleware on port 3000 |
| `npm run build` | Compiles client-side TypeScript and creates optimized production bundle in `dist/` |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |
| `npm run preview` | Previews production build locally with Vite |

---

## 🌐 Deployment (Vercel)

The project includes `vercel.json` and `api/index.ts` configured for full-stack deployment on Vercel:

1. Import the repository on [Vercel](https://vercel.com).
2. The framework preset is automatically detected as **Vite**.
3. Vercel automatically routes `/api/*` requests to the serverless Express backend and serves the frontend from `dist/`.
