/**
 * API wrapper — all backend communication goes through here.
 */

const API = {
    base: '',

    async request(method, path, body = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) opts.body = JSON.stringify(body);

        try {
            const res = await fetch(this.base + path, opts);
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || 'Request failed');
            }
            return res.json();
        } catch (err) {
            console.error(`API ${method} ${path}:`, err);
            throw err;
        }
    },

    // Tasks
    getTasks(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request('GET', '/api/tasks' + (qs ? '?' + qs : ''));
    },
    createTask(data) { return this.request('POST', '/api/tasks', data); },
    updateTask(id, data) { return this.request('PUT', `/api/tasks/${id}`, data); },
    deleteTask(id) { return this.request('DELETE', `/api/tasks/${id}`); },

    // Categories
    getCategories() { return this.request('GET', '/api/categories'); },
    createCategory(data) { return this.request('POST', '/api/categories', data); },
    deleteCategory(id) { return this.request('DELETE', `/api/categories/${id}`); },

    // Predictions
    predict(title) {
        return this.request('GET', `/api/predict?title=${encodeURIComponent(title)}`);
    },

    // Reminders
    getReminders() { return this.request('GET', '/api/reminders'); },

    // Insights
    getInsights() { return this.request('GET', '/api/insights'); },
};
