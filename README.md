# AttendAI — KIT Kanpur

AttendAI is a faculty-first attendance management system for **Kanpur Institute of Technology (KIT Kanpur)**. It brings together a real student roster, photo and live-camera attendance capture, reviewable recognition, subject-based classes, timetable-driven sessions, attendance reports, and an auditable workflow.

Designed and authored by **Kanshika Sharma**.

## Live deployment

The current Railway deployment is available at **[AttendAI — KIT Kanpur](https://frontend-production-eb5a1633.up.railway.app)**.

The live deployment includes the current student roster, face-enrollment records, database-backed attendance, and the repaired KIT Kanpur timetable. From **Timetable**, select a subject section or an instructor view, then use **Take attendance** on a scheduled period to open the correct attendance session.

## What is included

- Secure faculty/admin sign-in with role-based access control.
- Student directory with searchable records, profile photos, face-enrollment status, import preview, validation, and audit history.
- Classroom-photo and live-camera attendance flows. Recognition results are reviewed before attendance records are saved.
- Stored attendance sessions and records that drive the dashboard, reports, attendance rate, and trend signal.
- A timetable workspace with subject, room, period, and conflict-aware class slots.
- KIT Kanpur MCA Section A timetable setup with these subjects:
  - Computer Network (BMC303) — Subodh Kumar
  - Python Programming (BMC301) — Prabhat Kumar Sharma
  - Software Engineering (BMC302) — Neha Patel
  - Cloud Computing (BMC014) — Mohammad Waseem
  - Artificial Intelligence (BMC021) — Ajeet Singh
  - Python Programming Lab (BMC351) — Prabhat Kumar Sharma
  - Software Engineering Lab (BMC352) — Neha Patel
- The timetable setup keeps the same active MCA student roster enrolled across every subject class.
- Premium dark/light UI with an accessible theme toggle, responsive layouts, and a session-aware attendance chart. Dates without a session are intentionally not plotted as `0%` attendance.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, Pydantic, Alembic |
| Recognition | OpenCV YuNet + SFace embeddings |
| Database | SQLite for local development; PostgreSQL supported for deployment |
| Exports | CSV and Excel via `openpyxl` |

## Local setup

### 1. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The API is available at `http://127.0.0.1:8000`; Swagger documentation is at `http://127.0.0.1:8000/docs`.

### 2. Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### Local administrator

| Email | Password |
| --- | --- |
| `ajeet.singh@kit.ac.in` | `password123` |

Change this password and set a strong `JWT_SECRET` before any deployment.

## Student and timetable data

Student data is managed from **Students → Import data** or **Add student**. The application validates roll numbers, normalizes emails and phone values, identifies duplicates, supports import previews, and stores import history.

The repository deliberately excludes local databases, face crops, uploaded images, and environment files. Do not commit student photos, biometric data, production database files, or credentials to Git.

When the backend starts, the KIT timetable synchronizer creates or updates the seven MCA Section A subject classes and timetable slots. Existing active MCA students are enrolled into every subject class; their underlying personal records are not changed.

## Environment

Copy `.env.example` to `.env` and set deployment-specific values:

```env
APP_ENV=development
DATABASE_URL=sqlite:///./attendai.db
JWT_SECRET=replace-with-a-long-random-secret
FACE_MATCH_THRESHOLD=0.70
FACE_REVIEW_THRESHOLD=0.52
BACKEND_URL=http://127.0.0.1:8000
```

For production, use a managed PostgreSQL database, a unique secret, HTTPS, and a restricted `CORS_ORIGINS` value.

## Testing and quality checks

```powershell
# Backend
cd backend
.\venv\Scripts\python -m pytest -o pythonpath=. -v

# Frontend type check
cd frontend
npx tsc --noEmit

# Production build
npm run build
```

## Project structure

```text
backend/
  app/api/          FastAPI routes
  app/services/     attendance, recognition, roster, and timetable services
  alembic/          database migrations
frontend/
  app/              Next.js screens and global visual system
  components/       shared UI, attendance, student, and layout components
```

## Privacy note

Face enrollment and attendance are sensitive academic data. Obtain appropriate institutional consent, restrict access by role, protect backups, and retain data only as long as required by policy.
