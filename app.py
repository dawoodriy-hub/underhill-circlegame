from flask import Flask, render_template, request, jsonify
import sqlite3
import json
from datetime import datetime
import os

app = Flask(__name__)


# Initialize database
def init_db():
    conn = sqlite3.connect("scores.db")
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS scores
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  class TEXT NOT NULL,
                  score REAL NOT NULL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)""")
    conn.commit()
    conn.close()


init_db()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/submit_score", methods=["POST"])
def submit_score():
    data = request.json
    name = data.get("name", "").strip()
    student_class = data.get("class", "").strip()
    score = float(data.get("score", 0))

    if not name or not student_class:
        return jsonify({"error": "Name and class are required"}), 400

    conn = sqlite3.connect("scores.db")
    c = conn.cursor()
    c.execute(
        "INSERT INTO scores (name, class, score) VALUES (?, ?, ?)",
        (name, student_class, score),
    )
    score_id = c.lastrowid
    conn.commit()
    conn.close()

    return jsonify({"success": True, "id": score_id})


@app.route("/leaderboard")
def leaderboard():
    conn = sqlite3.connect("scores.db")
    c = conn.cursor()

    # Get total participants
    c.execute("SELECT COUNT(DISTINCT name) FROM scores")
    total = c.fetchone()[0]

    # Get top 10 scores
    c.execute("""SELECT id, name, class, score 
                 FROM scores 
                 ORDER BY score DESC 
                 LIMIT 7""")
    scores = c.fetchall()
    conn.close()

    return jsonify(
        {
            "total": total,
            "scores": [
                {"id": s[0], "name": s[1], "class": s[2], "score": s[3]} for s in scores
            ],
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
