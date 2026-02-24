"""
Smart Task Manager — Flask Server + MongoDB
"""

import os
import threading
import time
import urllib.request
from datetime import datetime, timedelta
from bson import ObjectId
from flask import Flask, request, jsonify, send_from_directory
from pymongo import MongoClient
from learner import predict_category, predict_time, get_daily_insights

app = Flask(__name__, static_folder='dist', static_url_path='')

# ── MongoDB Connection ────────────────────────────────────────────────

MONGO_URI = os.environ.get('MONGO_URI', 'mongodb+srv://ayush:Ayush_108@cluster0.sj8se91.mongodb.net/')
client = MongoClient(MONGO_URI)
db = client['task_manager'] 
tasks_col = db['tasks']
categories_col = db['categories']
stars_col = db['stars']
task_notes_col = db['task_notes']
lifetime_tracking_col = db['lifetime_tracking']

# ── Init defaults ─────────────────────────────────────────────────────

def init_defaults():
    if categories_col.count_documents({}) == 0:
        defaults = [
            {'name': 'Study',      'color': '#3b82f6', 'is_default': True},
            {'name': 'Work',       'color': '#f59e0b', 'is_default': True},
            {'name': 'Assignment', 'color': '#10b981', 'is_default': True},
            {'name': 'Reminder',   'color': '#ef4444', 'is_default': True},
            {'name': 'Personal',   'color': '#8b5cf6', 'is_default': True},
        ]
        categories_col.insert_many(defaults)

init_defaults()


# ── Helpers ───────────────────────────────────────────────────────────

def serialize(doc):
    """Convert MongoDB doc to JSON-safe dict."""
    if doc is None:
        return None
    doc['id'] = str(doc.pop('_id'))
    return doc

def serialize_list(docs):
    return [serialize(d) for d in docs]

def get_category_info(category_id):
    """Look up category name and color by id string."""
    if not category_id:
        return None, None
    try:
        cat = categories_col.find_one({'_id': ObjectId(category_id)})
        if cat:
            return cat['name'], cat['color']
    except:
        pass
    return None, None

def enrich_task(task):
    """Add category_name and category_color to a task dict."""
    doc = serialize(task)
    name, color = get_category_info(doc.get('category_id'))
    doc['category_name'] = name
    doc['category_color'] = color
    return doc

def enrich_tasks(cursor):
    return [enrich_task(t) for t in cursor]


# ── Serve Frontend ───────────────────────────────────────────────────

# Debug: Check if dist folder exists
if not os.path.exists('dist'):
    print("WARNING: dist/ folder not found! React build may have failed.")
    print(f"Current directory: {os.getcwd()}")
    print(f"Files in current directory: {os.listdir('.')}")
elif not os.path.exists('dist/index.html'):
    print("WARNING: dist/index.html not found! React build incomplete.")
    print(f"Files in dist/: {os.listdir('dist')}")
else:
    print(f"✓ React build found: dist/index.html exists")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve React app from dist/ folder."""
    if path and (path.startswith('api/') or os.path.exists(os.path.join(app.static_folder, path))):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')


# ── Task API ─────────────────────────────────────────────────────────

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    query = {}
    status = request.args.get('status')
    category_id = request.args.get('category_id')

    if status:
        query['status'] = status
    if category_id:
        query['category_id'] = category_id

    cursor = tasks_col.find(query).sort('created_at', -1)
    return jsonify(enrich_tasks(cursor))


@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    timer_type = data.get('timer_type', 'stopwatch')
    estimated_time = data.get('estimated_time')
    
    # For countdown tasks, initialize timer to estimated duration in seconds
    if timer_type == 'countdown' and estimated_time:
        initial_seconds = int(estimated_time) * 60
    else:
        initial_seconds = 0

    task = {
        'title': title,
        'category_id': data.get('category_id'),
        'status': 'active',
        'created_at': datetime.now().isoformat(),
        'completed_at': None,
        'due_date': data.get('due_date'),
        'estimated_time': estimated_time,
        'actual_time': None,
        'timer_type': timer_type,
        'timer_seconds': initial_seconds,
        'timer_running': 0,
        'timer_started_at': None,
        'countdown_completed': False,
        'is_important': data.get('is_important', False),
        'notes': data.get('notes', ''),
    }

    result = tasks_col.insert_one(task)
    task['_id'] = result.inserted_id
    return jsonify(enrich_task(task)), 201


@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.json
    update = {}

    allowed = ['title', 'category_id', 'status', 'due_date', 'estimated_time',
               'actual_time', 'timer_type', 'timer_seconds', 'timer_running',
               'timer_started_at', 'notes', 'countdown_completed', 'is_important',
               'lifetime_tracked']

    for field in allowed:
        if field in data:
            update[field] = data[field]

    if data.get('status') == 'completed':
        update['completed_at'] = datetime.now().isoformat()
    elif data.get('status') == 'active':
        update['completed_at'] = None

    if not update:
        return jsonify({'error': 'No fields to update'}), 400

    tasks_col.update_one({'_id': ObjectId(task_id)}, {'$set': update})
    task = tasks_col.find_one({'_id': ObjectId(task_id)})

    if not task:
        return jsonify({'error': 'Task not found'}), 404

    return jsonify(enrich_task(task))


@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks_col.delete_one({'_id': ObjectId(task_id)})
    return jsonify({'ok': True})


# ── Category API ─────────────────────────────────────────────────────

@app.route('/api/categories', methods=['GET'])
def get_categories():
    cats = categories_col.find().sort([('is_default', -1), ('name', 1)])
    return jsonify(serialize_list(cats))


@app.route('/api/categories', methods=['POST'])
def create_category():
    data = request.json
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1')

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    if categories_col.find_one({'name': name}):
        return jsonify({'error': 'Category already exists'}), 409

    doc = {'name': name, 'color': color, 'is_default': False}
    result = categories_col.insert_one(doc)
    doc['_id'] = result.inserted_id
    return jsonify(serialize(doc)), 201


@app.route('/api/categories/<cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    categories_col.delete_one({'_id': ObjectId(cat_id), 'is_default': False})
    return jsonify({'ok': True})


# ── Prediction API ───────────────────────────────────────────────────

@app.route('/api/predict', methods=['GET'])
def predict():
    title = request.args.get('title', '').strip()
    if not title:
        return jsonify({'category': None, 'time': None})

    # Get available category names for direct matching
    all_cats = list(categories_col.find())
    available_cat_names = [c['name'] for c in all_cats]

    # Include ALL tasks (active + completed) for better learning
    training_data = []
    for t in tasks_col.find():
        name, _ = get_category_info(t.get('category_id'))
        if name:
            training_data.append({
                'title': t['title'],
                'category': name,
                'actual_time': t.get('actual_time'),
                'estimated_time': t.get('estimated_time'),
                'completed_at': t.get('completed_at'),
            })

    cat_prediction = predict_category(title, training_data, available_categories=available_cat_names)

    time_prediction = None
    if cat_prediction['category']:
        time_prediction = predict_time(cat_prediction['category'], training_data)
        # If no actual_time data exists, fall back to estimated_time from similar tasks
        if time_prediction['estimated_minutes'] is None:
            relevant = [
                t for t in training_data
                if t.get('category', '').lower() == cat_prediction['category'].lower()
                and t.get('estimated_time') is not None
                and t['estimated_time'] > 0
            ]
            if relevant:
                est_times = [t['estimated_time'] for t in relevant]
                time_prediction = {
                    'estimated_minutes': round(sum(est_times) / len(est_times)),
                    'data_points': len(relevant)
                }

    cat_id = None
    if cat_prediction['category']:
        cat_doc = categories_col.find_one({'name': cat_prediction['category']})
        if cat_doc:
            cat_id = str(cat_doc['_id'])

    return jsonify({
        'category': cat_prediction,
        'category_id': cat_id,
        'time': time_prediction
    })


# ── Reminders API ────────────────────────────────────────────────────

@app.route('/api/reminders', methods=['GET'])
def get_reminders():
    now = datetime.now()
    soon = (now + timedelta(hours=24)).isoformat()
    ago = (now - timedelta(hours=1)).isoformat()
    now_iso = now.isoformat()

    due_soon = list(tasks_col.find({
        'status': 'active',
        'due_date': {'$ne': None, '$lte': soon, '$gte': ago}
    }).sort('due_date', 1))

    overdue = list(tasks_col.find({
        'status': 'active',
        'due_date': {'$ne': None, '$lt': ago}
    }).sort('due_date', 1))

    return jsonify({
        'due_soon': enrich_tasks(due_soon),
        'overdue': enrich_tasks(overdue)
    })


# ── Insights API ─────────────────────────────────────────────────────

@app.route('/api/insights', methods=['GET'])
def insights():
    completed = []
    for t in tasks_col.find({'status': 'completed'}):
        name, _ = get_category_info(t.get('category_id'))
        if name:
            completed.append({
                'title': t['title'],
                'category': name,
                'actual_time': t.get('actual_time'),
                'completed_at': t.get('completed_at'),
                'created_at': t.get('created_at'),
                'estimated_time': t.get('estimated_time'),
            })

    daily = get_daily_insights(completed)

    active_count = tasks_col.count_documents({'status': 'active'})
    done_count = tasks_col.count_documents({'status': 'completed'})

    return jsonify({
        'suggestions': daily['suggestions'],
        'patterns': daily['patterns'],
        'stats': {
            'active_tasks': active_count,
            'completed_tasks': done_count,
        }
    })


# ── Stars API ────────────────────────────────────────────────────────

@app.route('/api/stars/earn', methods=['POST'])
def earn_stars():
    """Award stars for completing a countdown task before deadline."""
    data = request.json
    task_id = data.get('task_id')

    if not task_id:
        return jsonify({'error': 'task_id is required'}), 400

    task = tasks_col.find_one({'_id': ObjectId(task_id)})
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    # Validate: must be countdown timer
    if task.get('timer_type') != 'countdown':
        return jsonify({'error': 'Only countdown tasks earn stars'}), 400

    # Validate: countdown must have been completed (reached 0)
    if not task.get('countdown_completed'):
        return jsonify({'error': 'Countdown was not fully completed'}), 400

    # Validate: must be completed before deadline (if deadline exists)
    if task.get('due_date'):
        completed_at = task.get('completed_at', datetime.now().isoformat())
        if completed_at > task['due_date']:
            return jsonify({'error': 'Task completed after deadline, no stars'}), 400

    # Validate: not already awarded stars for this task
    existing = stars_col.find_one({'task_id': task_id})
    if existing:
        return jsonify({'error': 'Stars already earned for this task'}), 409

    # Calculate stars: countdown_minutes / 60
    # estimated_time stores the original countdown minutes
    countdown_mins = task.get('estimated_time', 0) or 0
    if countdown_mins <= 0:
        return jsonify({'error': 'Invalid countdown duration'}), 400

    stars = round(countdown_mins / 60, 1)

    now = datetime.now()
    star_doc = {
        'task_id': task_id,
        'task_title': task.get('title', ''),
        'stars': stars,
        'countdown_minutes': countdown_mins,
        'earned_at': now.isoformat(),
        'date': now.strftime('%Y-%m-%d'),
    }

    stars_col.insert_one(star_doc)

    return jsonify({
        'stars_earned': stars,
        'task_title': task.get('title', ''),
        'total_today': get_today_star_total()
    }), 201


@app.route('/api/stars/today', methods=['GET'])
def today_stars():
    """Get total stars earned today."""
    today = datetime.now().strftime('%Y-%m-%d')
    entries = list(stars_col.find({'date': today}).sort('earned_at', -1))
    total = sum(e.get('stars', 0) for e in entries)

    return jsonify({
        'total_stars': total,
        'entries': [{
            'task_title': e.get('task_title', ''),
            'stars': e.get('stars', 0),
            'countdown_minutes': e.get('countdown_minutes', 0),
            'earned_at': e.get('earned_at', ''),
        } for e in entries]
    })


def get_today_star_total():
    """Helper to get today's total stars."""
    today = datetime.now().strftime('%Y-%m-%d')
    entries = stars_col.find({'date': today})
    return sum(e.get('stars', 0) for e in entries)


@app.route('/api/stars/week', methods=['GET'])
def week_stars():
    """Get star totals per day for the last 7 days + completed tasks per day."""
    today = datetime.now()
    days = []
    best_day = None
    best_stars = -1

    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        date_str = d.strftime('%Y-%m-%d')
        day_label = d.strftime('%a')  # Mon, Tue, ...

        # Stars for this day
        star_entries = list(stars_col.find({'date': date_str}))
        day_total = sum(e.get('stars', 0) for e in star_entries)

        # Completed tasks for this day
        day_start = d.replace(hour=0, minute=0, second=0).isoformat()
        day_end = d.replace(hour=23, minute=59, second=59).isoformat()
        completed_tasks = list(tasks_col.find({
            'status': 'completed',
            'completed_at': {'$gte': day_start, '$lte': day_end}
        }))

        tasks_list = []
        for t in completed_tasks:
            name, color = get_category_info(t.get('category_id'))
            tasks_list.append({
                'title': t.get('title', ''),
                'category': name or '',
                'category_color': color or '#888',
                'actual_time': t.get('actual_time'),
                'estimated_time': t.get('estimated_time'),
            })

        day_data = {
            'date': date_str,
            'day': day_label,
            'stars': round(day_total, 1),
            'tasks': tasks_list,
            'task_count': len(tasks_list),
        }
        days.append(day_data)

        if day_total > best_stars:
            best_stars = day_total
            best_day = day_data

    return jsonify({
        'days': days,
        'best_day': best_day,
    })


# ── Progress API ─────────────────────────────────────────────────────

@app.route('/api/progress', methods=['GET'])
def get_progress():
    """Get daily time totals for completed tasks matching a keyword."""
    keyword = request.args.get('keyword', '').strip().lower()
    if not keyword:
        return jsonify({'error': 'keyword is required'}), 400

    # Find all completed tasks containing the keyword
    all_tasks = list(tasks_col.find({'status': 'completed'}))
    matching = [t for t in all_tasks if keyword in t.get('title', '').lower()]

    # Group time by date (last 14 days)
    today = datetime.now()
    daily = {}
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        daily[d.strftime('%Y-%m-%d')] = {'date': d.strftime('%Y-%m-%d'), 'day': d.strftime('%a'), 'minutes': 0, 'tasks': []}

    total_minutes = 0
    for t in matching:
        completed_at = t.get('completed_at', '')
        if not completed_at:
            continue
        try:
            dt = datetime.fromisoformat(completed_at)
        except (ValueError, TypeError):
            continue
        date_key = dt.strftime('%Y-%m-%d')
        mins = t.get('actual_time') or t.get('estimated_time') or 0
        total_minutes += mins
        if date_key in daily:
            daily[date_key]['minutes'] += mins
            name, _ = get_category_info(t.get('category_id'))
            daily[date_key]['tasks'].append({
                'title': t.get('title', ''),
                'minutes': mins,
                'category': name or '',
            })

    days_list = list(daily.values())
    active_days = sum(1 for d in days_list if d['minutes'] > 0)

    # Streak: consecutive days with time spent (from today backwards)
    streak = 0
    for d in reversed(days_list):
        if d['minutes'] > 0:
            streak += 1
        else:
            break

    return jsonify({
        'keyword': keyword,
        'days': days_list,
        'total_minutes': total_minutes,
        'total_tasks': len(matching),
        'active_days': active_days,
        'avg_per_day': round(total_minutes / max(active_days, 1)),
        'streak': streak,
    })



# ── Task Notes API ───────────────────────────────────────────────────

@app.route('/api/task-notes/<task_name_key>', methods=['GET'])
def get_task_notes(task_name_key):
    """Get all notes for a task name (case-insensitive key)."""
    key = task_name_key.strip().lower()
    doc = task_notes_col.find_one({'task_name_key': key})
    if not doc:
        return jsonify({'task_name_key': key, 'notes': []})
    doc['id'] = str(doc.pop('_id'))
    return jsonify(doc)


@app.route('/api/task-notes/<task_name_key>', methods=['POST'])
def add_task_note(task_name_key):
    """Add a note to a task name."""
    key = task_name_key.strip().lower()
    data = request.json
    text = data.get('text', '').strip()
    if not text:
        return jsonify({'error': 'Note text is required'}), 400

    note_entry = {
        'text': text,
        'date': datetime.now().isoformat()
    }

    existing = task_notes_col.find_one({'task_name_key': key})
    if existing:
        task_notes_col.update_one(
            {'task_name_key': key},
            {'$push': {'notes': note_entry}}
        )
    else:
        task_notes_col.insert_one({
            'task_name_key': key,
            'notes': [note_entry]
        })

    doc = task_notes_col.find_one({'task_name_key': key})
    doc['id'] = str(doc.pop('_id'))
    return jsonify(doc), 201


# ── Task Name Search API (Autocomplete) ──────────────────────────────

@app.route('/api/task-names/search', methods=['GET'])
def search_task_names():
    """Search past task names for autocomplete (partial, case-insensitive)."""
    query = request.args.get('q', '').strip().lower()
    if not query or len(query) < 2:
        return jsonify([])

    all_tasks = tasks_col.find({}, {'title': 1})
    seen = set()
    results = []
    for t in all_tasks:
        title = t.get('title', '')
        key = title.lower()
        if key not in seen and query in key:
            seen.add(key)
            results.append(title)
        if len(results) >= 10:
            break

    return jsonify(results)


# ── Lifetime Tracking API ────────────────────────────────────────────

@app.route('/api/lifetime-track', methods=['POST'])
def set_lifetime_tracked():
    """Mark a task name as lifetime-tracked."""
    data = request.json
    task_name_key = data.get('task_name_key', '').strip().lower()
    display_name = data.get('display_name', '').strip()
    if not task_name_key:
        return jsonify({'error': 'task_name_key is required'}), 400

    existing = lifetime_tracking_col.find_one({'task_name_key': task_name_key})
    if not existing:
        lifetime_tracking_col.insert_one({
            'task_name_key': task_name_key,
            'display_name': display_name or task_name_key,
            'total_seconds': 0,
            'sessions': 0
        })

    doc = lifetime_tracking_col.find_one({'task_name_key': task_name_key})
    doc['id'] = str(doc.pop('_id'))
    return jsonify(doc), 201


@app.route('/api/lifetime-track/<task_name_key>', methods=['DELETE'])
def remove_lifetime_tracked(task_name_key):
    """Remove lifetime tracking for a task name."""
    key = task_name_key.strip().lower()
    lifetime_tracking_col.delete_one({'task_name_key': key})
    return jsonify({'ok': True})


@app.route('/api/lifetime-tracking', methods=['GET'])
def get_lifetime_tracking():
    """Get all lifetime-tracked tasks with accumulated times."""
    docs = list(lifetime_tracking_col.find().sort('total_seconds', -1))
    result = []
    for d in docs:
        d['id'] = str(d.pop('_id'))
        result.append(d)
    return jsonify(result)


@app.route('/api/lifetime-track/accumulate', methods=['POST'])
def accumulate_time():
    """Add elapsed seconds to a lifetime-tracked task."""
    data = request.json
    task_name_key = data.get('task_name_key', '').strip().lower()
    seconds = data.get('seconds', 0)

    if not task_name_key or seconds <= 0:
        return jsonify({'error': 'Valid task_name_key and positive seconds required'}), 400

    existing = lifetime_tracking_col.find_one({'task_name_key': task_name_key})
    if not existing:
        return jsonify({'error': 'Task is not lifetime-tracked'}), 404

    lifetime_tracking_col.update_one(
        {'task_name_key': task_name_key},
        {'$inc': {'total_seconds': int(seconds), 'sessions': 1}}
    )

    doc = lifetime_tracking_col.find_one({'task_name_key': task_name_key})
    doc['id'] = str(doc.pop('_id'))
    return jsonify(doc)


# ── Keep alive (ping self every 14 min) ──────────────────────────────

def keep_alive():
    url = os.environ.get('RENDER_EXTERNAL_URL')
    if not url:
        return
    while True:
        time.sleep(840)  # 14 minutes
        try:
            urllib.request.urlopen(url)
        except:
            pass

threading.Thread(target=keep_alive, daemon=True).start()


# ── Start Server ─────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
