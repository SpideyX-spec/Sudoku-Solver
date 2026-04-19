from __future__ import annotations

import json
import os
import sqlite3
from datetime import date
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory, render_template, session
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "sudoku.db"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
app.secret_key = "super_secret_sudoku_key"  # Required for session-based login


# -----------------------------
# DATABASE SETUP
# -----------------------------
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

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
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

    schema_file = BASE_DIR / "schema.sql"
    if schema_file.exists():
        schema = schema_file.read_text(encoding="utf-8")
        db.executescript(schema)

    ensure_schema(db)
    db.commit()
    db.close()


# -----------------------------
# SUDOKU HELPERS
# -----------------------------
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


# -----------------------------
# PAGE ROUTE
# -----------------------------
@app.get("/")
def root():
    return send_from_directory(BASE_DIR, "index.html")


# -----------------------------
# SCORE ROUTES
# -----------------------------
@app.post("/save_score")
def save_score():
    payload = request.get_json(force=True, silent=True) or {}

    username = str(payload.get("username", "Guest")).strip()[:24] or "Guest"
    region = str(payload.get("region", "Global")).strip()[:24] or "Global"
    score = int(payload.get("score", 0))
    time_seconds = max(0, int(payload.get("timeSeconds", payload.get("time_seconds", 0))))
    difficulty = str(payload.get("difficulty", "medium")).strip()[:16] or "medium"
    size = int(payload.get("size", 9))

    db = get_db()
    db.execute(
        """
        INSERT INTO scores (username, region, score, time_seconds, difficulty, size)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (username, region, score, time_seconds, difficulty, size),
    )
    db.commit()

    return jsonify({"ok": True})


@app.get("/leaderboard")
def leaderboard():
    db = get_db()
    rows = db.execute(
        """
        SELECT username, region, score, time_seconds, difficulty, size, created_at
        FROM scores
        ORDER BY score DESC, created_at ASC
        LIMIT 10
        """
    ).fetchall()

    return jsonify([dict(row) for row in rows])


# -----------------------------
# DAILY PUZZLE ROUTE
# -----------------------------
@app.get("/daily")
def daily():
    size = int(request.args.get("size", 9))
    if size not in (4, 9, 16):
        size = 9

    holes = {4: 7, 9: 45, 16: 120}[size]
    puzzle = daily_puzzle(size, holes)

    return jsonify({
        "date": date.today().isoformat(),
        "size": size,
        "puzzle": puzzle
    })


# -----------------------------
# AUTH ROUTES
# -----------------------------
@app.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if len(username) < 3 or len(password) < 4:
        return jsonify({"error": "Username > 3 chars, Password > 4 chars"}), 400

    password_hash = generate_password_hash(password)
    db = get_db()

    try:
        db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        db.commit()
        session["username"] = username
        return jsonify({"success": True, "username": username}), 200
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists!"}), 400


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    db = get_db()
    row = db.execute(
        "SELECT password_hash FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    if row and check_password_hash(row["password_hash"], password):
        session["username"] = username
        return jsonify({"success": True, "username": username}), 200

    return jsonify({"error": "Invalid username or password"}), 401


@app.post("/logout")
def logout():
    session.pop("username", None)
    return jsonify({"success": True}), 200


@app.get("/check_auth")
def check_auth():
    if "username" in session:
        return jsonify({"logged_in": True, "username": session["username"]}), 200
    return jsonify({"logged_in": False}), 200


# -----------------------------
# APP START
# -----------------------------
if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
