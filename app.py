"""
Smart Task Manager — Flask Server + MongoDB
"""

import os
from datetime import datetime, timedelta
from bson import ObjectId
from flask import Flask, request, jsonify, send_from_directory
from pymongo import MongoClient
from learner import predict_category, predict_time, get_daily_insights

app = Flask(__name__, static_folder='.', static_url_path='')

# ── MongoDB Connection ────────────────────────────────────────────────

MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017')
client = MongoClient(MONGO_URI)
db = client['task_manager']
tasks_col = db['tasks']
categories_col = db['categories']

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

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


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

    task = {
        'title': title,
        'category_id': data.get('category_id'),
        'status': 'active',
        'created_at': datetime.now().isoformat(),
        'completed_at': None,
        'due_date': data.get('due_date'),
        'estimated_time': data.get('estimated_time'),
        'actual_time': None,
        'timer_type': data.get('timer_type', 'stopwatch'),
        'timer_seconds': 0,
        'timer_running': 0,
        'timer_started_at': None,
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
               'timer_started_at', 'notes']

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

    completed = []
    for t in tasks_col.find({'status': 'completed'}):
        name, _ = get_category_info(t.get('category_id'))
        if name:
            completed.append({
                'title': t['title'],
                'category': name,
                'actual_time': t.get('actual_time'),
                'completed_at': t.get('completed_at'),
            })

    cat_prediction = predict_category(title, completed)

    time_prediction = None
    if cat_prediction['category']:
        time_prediction = predict_time(cat_prediction['category'], completed)

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


# ── Start Server ─────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
