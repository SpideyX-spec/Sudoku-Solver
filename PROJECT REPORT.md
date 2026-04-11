# SUDOKU SAGE — PROJECT REPORT

<div align="center">
  <img src="images/adamas-logo.png" alt="Adamas University Logo" width="280" />
  <h2>Adamas University</h2>
  <p><strong>CSE SEC A, 2nd Year, 4th Semester</strong></p>
  <p><strong>Course:</strong> Introduction to AI</p>
</div>

> Note: Place the official Adamas logo file at `images/adamas-logo.png` (requested report front-page logo path).

---

## 1) Project Overview

**Sudoku Sage** is a full-stack Sudoku platform with:
- Manual and AI-assisted play.
- Three board sizes: **4×4, 9×9, 16×16**.
- Daily puzzle endpoint and persistent leaderboard.
- Day/Night theme, timer, streak, and resume progress.

The app is built using:
- **Frontend:** HTML, CSS, JavaScript.
- **Backend:** Flask (Python).
- **Database:** SQLite.

---

## 2) Team Members and Responsibilities

| Member | Roll Number | Responsibility |
|---|---|---|
| **Sulagna Dutta** | **UG/SOET/30/24/045** | JavaScript logic + Backend integration |
| **Mitra Sarkar** | **UG/SOET/30/24/039** | Frontend UI design |
| **Adarsha Biswas** | **UG/SOET/30/24/044** | Frontend support + Deployment + GitHub workflow |
| **Arnab Kar** | **UG/SOET/30/24/084** | Database design and local database handling |

**Project Coordinator:** **Dr. Tamal Ghosh**  
**Section:** **CSE SEC A**  
**Semester:** **2nd Year, 4th Sem**

---

## 3) System Architecture

### Frontend
- `index.html`: App layout, pages, controls, leaderboard table, team/about section.
- `style.css`: Responsive layout, visual themes, board styling, sidebar, components.
- `script.js`: Game state, Sudoku generation/validation, CSP solver, timer/streak, API calls.

### Backend
- `app.py`: Flask routes and DB operations.
  - `POST /save_score`
  - `GET /leaderboard`
  - `GET /daily`

### Database
- `schema.sql`: `scores` table definition.
- `sudoku.db`: SQLite runtime database (auto-created).

---

## 4) Code Documentation (Function-Level Summary)

### `app.py`
- `ensure_schema(db)`: Ensures required `scores` table and runtime-safe columns (`region`, `time_seconds`) exist.
- `get_db()`: App-context DB connection provider.
- `init_db()`: Initializes DB from `schema.sql` and enforces schema upgrades.
- `daily_puzzle(size, holes)`: Deterministic daily board generation by date seed.
- `save_score()`: Accepts score payload (`username`, `region`, `score`, `timeSeconds`, `difficulty`, `size`) and persists it.
- `leaderboard()`: Returns top 10 scores with region and completion time.

### `script.js`
- Puzzle/Solver:
  - `generatePuzzle`, `isSolvable`, `solveCSP`, `selectMRV`, `getCandidates`.
- Game/UI:
  - `renderGrid`, `onInput`, `startNewGame`, `checkWin`, `solveWithTime`.
- Timing/Scoring:
  - `startManualTimer`, `formatTime`, `formatDuration`, `saveScore`.
- Persistence/API:
  - `saveProgress`, `resumeProgress`, `loadLeaderboard`, `loadDaily`.
- Navigation:
  - `bindSidebar`, `showPage`, loading-screen entry to Home.

---

## 5) Data Model

`scores` table fields:
- `id` (PK)
- `username`
- `region`
- `score`
- `time_seconds`
- `difficulty`
- `size`
- `created_at`

---

## 6) API Documentation

### `POST /save_score`
**JSON Body (example):**
```json
{
  "username": "Player1",
  "region": "India",
  "score": 950,
  "timeSeconds": 87,
  "difficulty": "medium",
  "size": 9
}
```

### `GET /leaderboard`
Returns top leaderboard rows including `username`, `score`, `region`, `time_seconds`.

### `GET /daily?size=9`
Returns deterministic puzzle for selected size (4, 9, 16).

---

## 7) Run Instructions

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open: `http://localhost:5000`

---

## 8) Key Enhancements Delivered

- Sidebar and page navigation fixes.
- 16×16 board readability and numeric symbol support (1..16).
- Leaderboard upgraded with **Region** and **Completion Time**.
- About page styling enhanced with team identity icons.

