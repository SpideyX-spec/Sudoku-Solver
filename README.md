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

<img width="1897" height="837" alt="image" src="https://github.com/user-attachments/assets/7a67a7e4-9c98-4c7f-a5ae-7ab911330fcb" />
<img width="1919" height="820" alt="image" src="https://github.com/user-attachments/assets/2335face-4501-4e7a-87fd-c43538be751d" />
<img width="1919" height="829" alt="image" src="https://github.com/user-attachments/assets/dee3f6d5-6d62-4f3a-91aa-f02dc56ac653" />
<img width="1893" height="837" alt="image" src="https://github.com/user-attachments/assets/7c3353f2-6375-4acb-97f5-8db830b4c10c" />


## API
- `POST /save_score`
- `GET /leaderboard`
- `GET /daily?size=9`
