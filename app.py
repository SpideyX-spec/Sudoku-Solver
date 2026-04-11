from __future__ import annotations

import json
import sqlite3
from datetime import date
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "sudoku.db"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")

def ensure_schema(db: sqlite3.Connection) -> None:
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          region TEXT NOT NULL DEFAULT 'Global',
          score INTEGER NOT NULL,
          time_seconds INTEGER NOT NULL DEFAULT 0,
          difficulty TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    columns = {row["name"] for row in db.execute("PRAGMA table_info(scores)").fetchall()}
    if "region" not in columns:
        db.execute("ALTER TABLE scores ADD COLUMN region TEXT NOT NULL DEFAULT 'Global'")
    if "time_seconds" not in columns:
        db.execute("ALTER TABLE scores ADD COLUMN time_seconds INTEGER NOT NULL DEFAULT 0")
    db.commit()


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        ensure_schema(g.db)
    return g.db


@app.teardown_appcontext
def close_db(exception: Exception | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    schema = (BASE_DIR / "schema.sql").read_text(encoding="utf-8")
    db.executescript(schema)
    ensure_schema(db)
    db.commit()
    db.close()


def symbols_for_size(size: int) -> list[str]:
    if size == 4:
        return list("1234")
    if size == 9:
        return list("123456789")
    return [str(i) for i in range(1, 17)]


def base_grid(size: int) -> list[list[str]]:
    symbols = symbols_for_size(size)
    box = int(size ** 0.5)
    return [[symbols[(c + (r * box + r // box)) % size] for c in range(size)] for r in range(size)]


def daily_puzzle(size: int, holes: int) -> list[list[str]]:
    import random

    seed = int(date.today().strftime("%Y%m%d")) + size
    random.seed(seed)
    grid = base_grid(size)
    empties = set()
    while len(empties) < holes:
        empties.add((random.randrange(size), random.randrange(size)))
    for r, c in empties:
        grid[r][c] = ""
    return grid


@app.get("/")
def root():
    return send_from_directory(BASE_DIR, "index.html")


@app.post("/save_score")
def save_score():
    payload = request.get_json(force=True, silent=True) or {}
    username = str(payload.get("username", "Guest"))[:24]
    region = str(payload.get("region", "Global"))[:24] or "Global"
    score = int(payload.get("score", 0))
    time_seconds = max(0, int(payload.get("timeSeconds", payload.get("time_seconds", 0))))
    difficulty = str(payload.get("difficulty", "medium"))[:16]
    size = int(payload.get("size", 9))

    db = get_db()
    db.execute(
        "INSERT INTO scores (username, region, score, time_seconds, difficulty, size) VALUES (?, ?, ?, ?, ?, ?)",
        (username, region, score, time_seconds, difficulty, size),
    )
    db.commit()
    return jsonify({"ok": True})


@app.get("/leaderboard")
def leaderboard():
    db = get_db()
    rows = db.execute(
        "SELECT username, region, score, time_seconds, difficulty, size, created_at FROM scores "
        "ORDER BY score DESC, created_at ASC LIMIT 10"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/daily")
def daily():
    size = int(request.args.get("size", 9))
    if size not in (4, 9, 16):
        size = 9
    holes = {4: 7, 9: 45, 16: 120}[size]
    puzzle = daily_puzzle(size, holes)
    return jsonify({"date": date.today().isoformat(), "size": size, "puzzle": puzzle})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
