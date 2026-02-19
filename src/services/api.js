/**
 * API wrapper — all backend communication goes through here.
 */

const base = '';

async function request(method, path, body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(base + path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || 'Request failed');
        }
        return res.json();
    } catch (err) {
        console.error(`API ${method} ${path}:`, err);
        throw err;
    }
}

// Tasks
export function getTasks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/api/tasks' + (qs ? '?' + qs : ''));
}
export function createTask(data) { return request('POST', '/api/tasks', data); }
export function updateTask(id, data) { return request('PUT', `/api/tasks/${id}`, data); }
export function deleteTask(id) { return request('DELETE', `/api/tasks/${id}`); }

// Categories
export function getCategories() { return request('GET', '/api/categories'); }
export function createCategory(data) { return request('POST', '/api/categories', data); }
export function deleteCategory(id) { return request('DELETE', `/api/categories/${id}`); }

// Predictions
export function predict(title) {
    return request('GET', `/api/predict?title=${encodeURIComponent(title)}`);
}

// Reminders
export function getReminders() { return request('GET', '/api/reminders'); }

// Insights
export function getInsights() { return request('GET', '/api/insights'); }

// Stars
export function earnStars(taskId) { return request('POST', '/api/stars/earn', { task_id: taskId }); }
export function getTodayStars() { return request('GET', '/api/stars/today'); }

