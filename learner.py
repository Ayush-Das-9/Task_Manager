"""
Smart Task Manager — Learning Engine
Predicts categories and time estimates from completed task history.
"""

import re
import math
from collections import defaultdict
from datetime import datetime, timedelta


STOP_WORDS = {
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'not', 'no', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
    'about', 'up', 'out', 'my', 'your', 'this', 'that', 'it', 'its',
    'i', 'me', 'we', 'us', 'he', 'she', 'they', 'them', 'what', 'which',
    'who', 'when', 'where', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
    'same', 'also', 'new', 'one', 'two', 'get', 'make', 'go', 'need',
    'task', 'work', 'thing', 'stuff', 'do', 'done'
}


def tokenize(text):
    """Split text into meaningful lowercase tokens, removing stop words."""
    words = re.findall(r'[a-zA-Z]{2,}', text.lower())
    return [w for w in words if w not in STOP_WORDS]


def build_category_model(completed_tasks):
    """
    Build keyword→category frequency model from completed tasks.
    Returns: {keyword: {category: count}}
    """
    model = defaultdict(lambda: defaultdict(int))
    for task in completed_tasks:
        category = task.get('category', '').strip()
        title = task.get('title', '')
        if not category:
            continue
        tokens = tokenize(title)
        for token in tokens:
            model[token][category] += 1
    return model


def predict_category(title, completed_tasks, available_categories=None):
    """
    Predict the best category for a task title based on keyword scoring.
    Returns: {'category': str, 'confidence': float, 'alternatives': list}
    """
    model = build_category_model(completed_tasks)
    tokens = tokenize(title)

    if not tokens or not model:
        return {'category': None, 'confidence': 0, 'alternatives': []}

    # Score each category
    category_scores = defaultdict(float)
    total_tasks = len(completed_tasks)

    for token in tokens:
        if token in model:
            token_categories = model[token]
            # IDF-like weighting: rare keywords across categories matter more
            idf = math.log(1 + total_tasks / (1 + sum(token_categories.values())))
            for cat, count in token_categories.items():
                category_scores[cat] += count * idf

    if not category_scores:
        return {'category': None, 'confidence': 0, 'alternatives': []}

    # Sort by score
    sorted_cats = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
    best_cat, best_score = sorted_cats[0]

    # Confidence = best score / total score
    total_score = sum(s for _, s in sorted_cats)
    confidence = round(best_score / total_score, 2) if total_score > 0 else 0

    alternatives = [
        {'category': cat, 'score': round(score, 2)}
        for cat, score in sorted_cats[1:4]
    ]

    return {
        'category': best_cat,
        'confidence': confidence,
        'alternatives': alternatives
    }


def predict_time(category, completed_tasks):
    """
    Predict time for a task in the given category using weighted median
    of actual durations from similar completed tasks.
    Returns: {'estimated_minutes': int|None, 'data_points': int}
    """
    # Get completed tasks in this category with actual time
    relevant = [
        t for t in completed_tasks
        if t.get('category', '').lower() == category.lower()
        and t.get('actual_time') is not None
        and t['actual_time'] > 0
    ]

    if len(relevant) < 2:
        return {'estimated_minutes': None, 'data_points': len(relevant)}

    # Use recent tasks weighted more heavily (last 20)
    relevant = sorted(relevant, key=lambda x: x.get('completed_at', ''), reverse=True)[:20]
    times = [t['actual_time'] for t in relevant]

    # Weighted median (recent tasks count double)
    weighted_times = []
    for i, t in enumerate(times):
        weight = 2 if i < len(times) // 2 else 1
        weighted_times.extend([t] * weight)

    weighted_times.sort()
    mid = len(weighted_times) // 2
    if len(weighted_times) % 2 == 0:
        median = (weighted_times[mid - 1] + weighted_times[mid]) / 2
    else:
        median = weighted_times[mid]

    return {
        'estimated_minutes': round(median),
        'data_points': len(relevant)
    }


def get_daily_insights(completed_tasks):
    """
    Analyze daily patterns: what categories the user works on at different
    times and days of week.
    Returns: {suggestions: list, patterns: dict}
    """
    now = datetime.now()
    current_hour = now.hour
    current_day = now.strftime('%A')

    # Group by day of week + hour
    day_hour_cats = defaultdict(lambda: defaultdict(int))
    day_cats = defaultdict(lambda: defaultdict(int))
    hour_cats = defaultdict(lambda: defaultdict(int))

    for task in completed_tasks:
        completed_at = task.get('completed_at')
        category = task.get('category', '')
        if not completed_at or not category:
            continue
        try:
            dt = datetime.fromisoformat(completed_at)
        except (ValueError, TypeError):
            continue

        day = dt.strftime('%A')
        hour_block = (dt.hour // 3) * 3  # 3-hour blocks

        day_hour_cats[f"{day}_{hour_block}"][category] += 1
        day_cats[day][category] += 1
        hour_cats[hour_block][category] += 1

    suggestions = []

    # What do you usually do at this time on this day?
    current_block = (current_hour // 3) * 3
    key = f"{current_day}_{current_block}"
    if key in day_hour_cats:
        top_cat = max(day_hour_cats[key].items(), key=lambda x: x[1])
        suggestions.append({
            'type': 'time_pattern',
            'message': f"You usually work on '{top_cat[0]}' tasks around this time on {current_day}s",
            'category': top_cat[0]
        })

    # Most productive category today
    if current_day in day_cats:
        top_day_cat = max(day_cats[current_day].items(), key=lambda x: x[1])
        suggestions.append({
            'type': 'day_pattern',
            'message': f"On {current_day}s, you complete the most '{top_day_cat[0]}' tasks",
            'category': top_day_cat[0]
        })

    # General time-of-day pattern
    if current_block in hour_cats:
        top_hour_cat = max(hour_cats[current_block].items(), key=lambda x: x[1])
        time_label = f"{current_block}:00-{current_block+3}:00"
        suggestions.append({
            'type': 'hour_pattern',
            'message': f"Between {time_label}, you typically focus on '{top_hour_cat[0]}'",
            'category': top_hour_cat[0]
        })

    # Category frequency summary
    all_cats = defaultdict(int)
    for task in completed_tasks:
        cat = task.get('category', '')
        if cat:
            all_cats[cat] += 1

    patterns = {
        'category_frequency': dict(all_cats),
        'total_completed': len(completed_tasks)
    }

    return {'suggestions': suggestions, 'patterns': patterns}
