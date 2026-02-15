"""
Smart Task Manager — Flask Server
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, g
from learner import predict_category, predict_time, get_daily_insights

app = Flask(__name__, static_folder='.', static_url_path='')
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tasks.db')


# ── Database ──────────────────────────────────────────────────────────

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db = sqlite3.connect(DB_PATH)
    db.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#6366f1',
            is_default INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category_id INTEGER,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT,
            due_date TEXT,
            estimated_time INTEGER,
            actual_time INTEGER,
            timer_type TEXT DEFAULT 'stopwatch',
            timer_seconds INTEGER DEFAULT 0,
            timer_running INTEGER DEFAULT 0,
            timer_started_at TEXT,
            notes TEXT DEFAULT '',
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
    """)
    # Default categories
    defaults = [
        ('Study', '#3b82f6'),
        ('Work', '#f59e0b'),
        ('Assignment', '#10b981'),
        ('Reminder', '#ef4444'),
        ('Personal', '#8b5cf6'),
    ]
    for name, color in defaults:
        try:
            db.execute(
                "INSERT INTO categories (name, color, is_default) VALUES (?, ?, 1)",
                (name, color)
            )
        except sqlite3.IntegrityError:
            pass
    db.commit()
    db.close()


def row_to_dict(row):
    return dict(row) if row else None

def rows_to_list(rows):
    return [dict(r) for r in rows]


# ── Serve Frontend ───────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


# ── Task API ─────────────────────────────────────────────────────────

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    db = get_db()
    status = request.args.get('status', None)
    category_id = request.args.get('category_id', None)

    query = """
        SELECT t.*, c.name as category_name, c.color as category_color
        FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
    """
    conditions = []
    params = []

    if status:
        conditions.append("t.status = ?")
        params.append(status)
    if category_id:
        conditions.append("t.category_id = ?")
        params.append(category_id)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY t.created_at DESC"
    rows = db.execute(query, params).fetchall()
    return jsonify(rows_to_list(rows))


@app.route('/api/tasks', methods=['POST'])
def create_task():
    db = get_db()
    data = request.json
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    category_id = data.get('category_id')
    due_date = data.get('due_date')
    estimated_time = data.get('estimated_time')
    timer_type = data.get('timer_type', 'stopwatch')
    notes = data.get('notes', '')

    cursor = db.execute(
        """INSERT INTO tasks (title, category_id, due_date, estimated_time, timer_type, notes)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (title, category_id, due_date, estimated_time, timer_type, notes)
    )
    db.commit()

    task = db.execute(
        """SELECT t.*, c.name as category_name, c.color as category_color
           FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.id = ?""",
        (cursor.lastrowid,)
    ).fetchone()

    return jsonify(row_to_dict(task)), 201


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    db = get_db()
    data = request.json

    # Build dynamic update
    fields = []
    params = []

    allowed = ['title', 'category_id', 'status', 'due_date', 'estimated_time',
               'actual_time', 'timer_type', 'timer_seconds', 'timer_running',
               'timer_started_at', 'notes']

    for field in allowed:
        if field in data:
            fields.append(f"{field} = ?")
            params.append(data[field])

    # Auto-set completed_at
    if data.get('status') == 'completed':
        fields.append("completed_at = ?")
        params.append(datetime.now().isoformat())
    elif data.get('status') == 'active':
        fields.append("completed_at = NULL")

    if not fields:
        return jsonify({'error': 'No fields to update'}), 400

    params.append(task_id)
    db.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", params)
    db.commit()

    task = db.execute(
        """SELECT t.*, c.name as category_name, c.color as category_color
           FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.id = ?""",
        (task_id,)
    ).fetchone()

    if not task:
        return jsonify({'error': 'Task not found'}), 404

    return jsonify(row_to_dict(task))


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    return jsonify({'ok': True})


# ── Category API ─────────────────────────────────────────────────────

@app.route('/api/categories', methods=['GET'])
def get_categories():
    db = get_db()
    rows = db.execute("SELECT * FROM categories ORDER BY is_default DESC, name ASC").fetchall()
    return jsonify(rows_to_list(rows))


@app.route('/api/categories', methods=['POST'])
def create_category():
    db = get_db()
    data = request.json
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1')

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    try:
        cursor = db.execute(
            "INSERT INTO categories (name, color) VALUES (?, ?)",
            (name, color)
        )
        db.commit()
        cat = db.execute("SELECT * FROM categories WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return jsonify(row_to_dict(cat)), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Category already exists'}), 409


@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    db = get_db()
    db.execute("DELETE FROM categories WHERE id = ? AND is_default = 0", (cat_id,))
    db.commit()
    return jsonify({'ok': True})


# ── Prediction API ───────────────────────────────────────────────────

@app.route('/api/predict', methods=['GET'])
def predict():
    title = request.args.get('title', '').strip()
    if not title:
        return jsonify({'category': None, 'time': None})

    db = get_db()

    # Get completed tasks for learning
    completed = rows_to_list(db.execute(
        """SELECT t.title, c.name as category, t.actual_time, t.completed_at
           FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.status = 'completed' AND c.name IS NOT NULL"""
    ).fetchall())

    # Predict category
    cat_prediction = predict_category(title, completed)

    # Predict time if category found
    time_prediction = None
    if cat_prediction['category']:
        time_prediction = predict_time(cat_prediction['category'], completed)

    # Get category_id for the predicted category
    cat_id = None
    if cat_prediction['category']:
        row = db.execute(
            "SELECT id FROM categories WHERE name = ?",
            (cat_prediction['category'],)
        ).fetchone()
        if row:
            cat_id = row['id']

    return jsonify({
        'category': cat_prediction,
        'category_id': cat_id,
        'time': time_prediction
    })


# ── Reminders API ────────────────────────────────────────────────────

@app.route('/api/reminders', methods=['GET'])
def get_reminders():
    db = get_db()
    now = datetime.now()
    soon = now + timedelta(hours=24)

    rows = db.execute(
        """SELECT t.*, c.name as category_name, c.color as category_color
           FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.status = 'active' AND t.due_date IS NOT NULL
           AND t.due_date <= ? AND t.due_date >= ?
           ORDER BY t.due_date ASC""",
        (soon.isoformat(), (now - timedelta(hours=1)).isoformat())
    ).fetchall()

    # Also get overdue
    overdue = db.execute(
        """SELECT t.*, c.name as category_name, c.color as category_color
           FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.status = 'active' AND t.due_date IS NOT NULL
           AND t.due_date < ?
           ORDER BY t.due_date ASC""",
        ((now - timedelta(hours=1)).isoformat(),)
    ).fetchall()

    return jsonify({
        'due_soon': rows_to_list(rows),
        'overdue': rows_to_list(overdue)
    })


# ── Insights API ─────────────────────────────────────────────────────

@app.route('/api/insights', methods=['GET'])
def insights():
    db = get_db()
    completed = rows_to_list(db.execute(
        """SELECT t.title, c.name as category, t.actual_time, t.completed_at,
                  t.created_at, t.estimated_time
           FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.status = 'completed' AND c.name IS NOT NULL"""
    ).fetchall())

    daily = get_daily_insights(completed)

    # Add some stats
    total_active = db.execute(
        "SELECT COUNT(*) as cnt FROM tasks WHERE status = 'active'"
    ).fetchone()['cnt']

    total_completed = db.execute(
        "SELECT COUNT(*) as cnt FROM tasks WHERE status = 'completed'"
    ).fetchone()['cnt']

    return jsonify({
        'suggestions': daily['suggestions'],
        'patterns': daily['patterns'],
        'stats': {
            'active_tasks': total_active,
            'completed_tasks': total_completed,
        }
    })


# ── Init DB on import (needed for gunicorn) ──────────────────────────
init_db()

# ── Start Server ─────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
