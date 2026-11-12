# FitTrack — Fitness Tracking & Management System

FitTrack is a full-stack fitness application built with **FastAPI, SQLAlchemy, SQLite, React, and Vite**. This project contains Phases 1–3 (Modules 1–19).

## Modules

| Module | Feature | Main capabilities |
|---|---|---|
| 1 | Authentication | Registration, login, bcrypt password hashing, JWT-protected APIs |
| 2 | Workout Management | Create, list, edit, delete workouts |
| 3 | Daily Progress | Daily workout count, calories, active minutes |
| 4 | Fitness Goals | Create, update, delete, completion status |
| 5 | Reports & Analytics | Weekly and monthly reports |
| 6 | Notifications | In-app notifications, unread count, mark read |
| 7 | Workout Plans | Schedule, list, delete plans |
| 8 | Exercise Library | Search, category filter, add exercise to workouts |
| 9 | Progress Comparison | Weekly and monthly comparisons |
| 10 | Workout Streak | Current and longest consecutive workout days |
| 11 | Achievements | First Workout, Workout Explorer, Consistency 3/7, Goal Achiever |
| 12 | Personalized Dashboard | Daily summary, upcoming plans, goals, streak, badges |
| 13 | Nutrition & Meals | Meal entries and daily calorie/macronutrient summary |
| 14 | Water Tracker | Water entries and 2,000 ml default daily target |
| 15 | Smart Suggestions | Rule-based recommendations using recent workouts and active goals |
| 16 | Workout Timer | Start/stop timer, save a workout, approximate calories |
| 17 | Activity Integration | Integration status and manual activity import; provider OAuth is not configured |
| 18 | Advanced Analytics | Goal completion, workout consistency, 7–90 day trends |
| 19 | Reminders | Create workout/meal/water reminders and convert due reminders into notifications |

## Technology stack

**Backend:** Python, FastAPI, SQLAlchemy 2, Pydantic 2, SQLite, JWT, bcrypt, Uvicorn  
**Frontend:** React 19, Vite, React Router, Axios, Recharts  
**Tools:** VS Code, Swagger UI, Git/GitHub

## Folder structure

```text
FitTrack/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── security.py
│   ├── .env.example
│   ├── requirements.txt
│   └── fittrack.db              # your working database (restore/copy locally)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Phase3.jsx
│   │   ├── api.js
│   │   ├── main.jsx
│   │   └── style.css
│   ├── .env.example
│   └── package.json
└── README.md
```

## Important database note — read before starting

The ZIP you supplied contained `backend/fittrack_backup.db`, but inspection showed that this backup has **zero user records and zero workout records** (it contains the reference exercise and badge rows only). It is therefore **not the populated database you were using during your Module 1–12 testing**.

To preserve your actual existing users, workouts, goals, plans, notifications, streaks, and badges:

1. Make a separate backup copy of your currently working `fittrack.db`.
2. Copy that actual `fittrack.db` into this project's `backend` folder.
3. Do not replace it with `fittrack_backup.db`.
4. Keep the database filename `fittrack.db`.

The new Phase 3 tables (`meals`, `water_tracking`, `workout_sessions`, `reminders`, `activity_syncs`) are created additively by SQLAlchemy `create_all`. Existing tables are not dropped or recreated. Still, always keep a backup before first startup.

If your old working database is on another computer/folder, copy it from that old project's `backend` folder. The uploaded ZIP does not contain its populated copy.

## Setup in VS Code (Windows PowerShell)

### 1. Extract the ZIP

Extract the archive. The top-level project folder is named **FitTrack**. Open that `FitTrack` folder in VS Code using **File → Open Folder**.

### 2. Restore your populated database

Before running the backend, copy your old populated `fittrack.db` into:

```text
FitTrack/backend/fittrack.db
```

Do not copy the empty `fittrack_backup.db` over it. If you do not have the old database file available, pause and recover it from your original project before continuing.

### 3. Configure backend environment

Open a PowerShell terminal in VS Code:

```powershell
cd backend
Copy-Item .env.example .env
```

Open `backend/.env` and set a long, private random `SECRET_KEY`. Keep `DATABASE_URL=sqlite:///./fittrack.db` when running the backend from the `backend` folder.

Never commit `.env` to GitHub.

### 4. Create Python environment and install packages

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation, run this for the current terminal only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### 5. Start backend

Stay in the `backend` folder:

```powershell
uvicorn app.main:app --reload
```

Backend base URL: `http://127.0.0.1:8000`  
Swagger documentation: `http://127.0.0.1:8000/docs`

Keep this terminal running.

### 6. Start frontend in a second terminal

Open another VS Code terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## Phase 3 frontend pages

After login, the navigation includes:

- Nutrition
- Water
- Suggestions
- Timer
- Integrations
- Analytics
- Reminders

These pages use the logged-in JWT token from the existing Axios API client.

## Phase 3 API testing (Swagger)

Open `http://127.0.0.1:8000/docs`, click **Authorize**, and authenticate with your existing account. Then test:

| Module | Method | Endpoint | Test |
|---|---|---|---|
| 13 | POST | `/api/meals` | Add a meal |
| 13 | GET | `/api/meals` | List today's meals |
| 13 | GET | `/api/nutrition/summary` | Check calories and macros |
| 13 | DELETE | `/api/meals/{meal_id}` | Delete your meal |
| 14 | POST | `/api/water` | Add water quantity in ml |
| 14 | GET | `/api/water` | Check daily total and progress |
| 15 | GET | `/api/recommendations` | Get personalized rule-based suggestions |
| 16 | POST | `/api/timer/start` | Start a timer |
| 16 | GET | `/api/timer/active` | Check running timer |
| 16 | POST | `/api/timer/{session_id}/stop` | Stop and save a workout |
| 17 | GET | `/api/integrations/status` | Check provider setup status |
| 17 | POST | `/api/integrations/manual-sync` | Import sample/manual steps |
| 17 | GET | `/api/integrations/activity` | View imported activity |
| 18 | GET | `/api/analytics/overview` | Check summary metrics |
| 18 | GET | `/api/analytics/trends?days=30` | Check trend data |
| 19 | POST | `/api/reminders` | Create a reminder |
| 19 | GET | `/api/reminders` | List reminders |
| 19 | GET | `/api/reminders/check-due` | Turn due reminders into in-app notifications |
| 19 | DELETE | `/api/reminders/{reminder_id}` | Delete a reminder |

### Example request bodies

**Add meal (`POST /api/meals`)**

```json
{
  "meal_type": "Breakfast",
  "food_name": "Oats and banana",
  "calories": 350,
  "protein": 12,
  "carbs": 55,
  "fats": 8
}
```

**Add water (`POST /api/water`)**

```json
{
  "quantity": 250,
  "date": "2026-11-11"
}
```

**Start timer (`POST /api/timer/start`)**

```json
{
  "workout_name": "Morning Cardio"
}
```

**Manual activity import (`POST /api/integrations/manual-sync`)**

```json
{
  "provider": "MANUAL",
  "steps": 4500,
  "active_minutes": 35
}
```

**Create reminder (`POST /api/reminders`)**

```json
{
  "reminder_type": "Water",
  "message": "Drink a glass of water",
  "remind_at": "2026-11-11T18:30:00"
}
```

Use a future local date/time when creating a reminder.

## Important implementation notes

- **Ownership and security:** Phase 3 data endpoints use the existing JWT-authenticated user and filter records by that user's ID.
- **Nutrition:** Calories and macros are values entered by the user; the app does not identify food or calculate nutrients automatically.
- **Water:** The starter daily target is 2,000 ml. It is a configurable product default, not individualized medical advice.
- **AI suggestions:** Module 15 uses transparent rule-based personalization from recent workouts and active goals. It does not call an external generative AI service.
- **Timer calories:** Module 16 saves an approximate estimate of 5 kcal/minute. Actual calorie expenditure varies by person and exercise intensity.
- **Google Fit / Apple Health:** Module 17 includes status and manual activity import. Real provider synchronization requires separate OAuth/HealthKit setup, credentials, platform permissions, and provider configuration.
- **Reminders:** Module 19 creates in-app reminders. The `/api/reminders/check-due` endpoint checks due reminders when called. Automatic background delivery while the app is closed requires a scheduler/worker and deployment configuration.
- **Migrations:** `create_all` adds missing tables but does not migrate changed columns in existing tables. Use a backup and a migration tool for future schema changes.

## Troubleshooting

**Backend import or missing package error**

```powershell
pip install -r requirements.txt
```

**Swagger OAuth form error**

Ensure `python-multipart` is installed and restart Uvicorn.

**Frontend API connection error**

- Confirm backend is running at `http://127.0.0.1:8000`.
- Confirm `frontend/.env` contains `VITE_API_URL=http://127.0.0.1:8000/api`.
- Restart Vite after changing `.env`.

**Login fails after replacing project files**

Make sure you restored the original populated `fittrack.db` and are using the same database that contains your registered account.

**New tables are missing**

Confirm the backend started without errors and that it is using the intended `backend/fittrack.db` file.

## Git safety

Before pushing to GitHub, verify that `.env`, `.venv`, `node_modules`, and database files are excluded by `.gitignore`. Do not publish passwords, JWT secrets, or private user data.

## Project status

Phase 1 (Modules 1–6), Phase 2 (Modules 7–12), and Phase 3 (Modules 13–19) are included in this codebase. Run the backend and frontend tests above in your own environment before describing the entire application as production-ready.
