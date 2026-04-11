# Sudoku Sage

A responsive Sudoku app with manual mode and CSP AI mode (Backtracking + MRV + Forward Checking), supporting 4×4, 9×9, and 16×16 boards.

## Project Report
- Full documented report: `PROJECT_REPORT.md`

## Features
- Multi-size Sudoku board (4/9/16)
- Manual and AI mode
- Shuffle/New puzzle with solvable generation
- AI timing display
- Day/Night theme toggle
- Streak counter + Daily challenge
- Flask + SQLite backend for score saving and leaderboard

## Run
```bash
python -m venv .venv
source .venv/bin/activate
pip install flask
python app.py
```
Then open `http://localhost:5000`.

## API
- `POST /save_score`
- `GET /leaderboard`
- `GET /daily?size=9`
