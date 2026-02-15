/**
 * Smart Task Manager — Main App
 */

let tasks = [];
let categories = [];
let activeFilter = 'all';
let completingTaskId = null;
let predictionTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadTasks();
    await checkReminders();
    await loadInsights();

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    document.getElementById('add-task-form').addEventListener('submit', handleAddTask);
    document.getElementById('task-title').addEventListener('input', handleTitleInput);
    document.getElementById('task-timer-type').addEventListener('change', (e) => {
        document.getElementById('task-countdown-mins').classList.toggle('hidden', e.target.value !== 'countdown');
    });

    // Auto-refresh
    setInterval(checkReminders, 60000);
    setInterval(syncTasks, 10000);
});


// ── Data ─────────────────────────────────────────────────────────────

async function loadCategories() {
    try {
        categories = await API.getCategories();
        renderCategoryTabs();
        renderCategorySelect();
    } catch (e) { console.error(e); }
}

async function loadTasks() {
    try {
        tasks = await API.getTasks();
        renderTasks();
        updateStats();
        tasks.forEach(t => {
            if (t.timer_running && t.status === 'active') {
                TimerManager.startTicking(t.id, t);
            }
        });
    } catch (e) { console.error(e); }
}

async function syncTasks() {
    try {
        const fresh = await API.getTasks();
        if (JSON.stringify(fresh) !== JSON.stringify(tasks)) {
            tasks = fresh;
            renderTasks();
            updateStats();
        }
    } catch (e) { }
}


// ── Category Tabs ────────────────────────────────────────────────────

function renderCategoryTabs() {
    const c = document.getElementById('category-tabs');
    c.innerHTML = `<button class="cat-tab ${activeFilter === 'all' ? 'active' : ''}" onclick="filterByCategory('all')">All</button>`;
    categories.forEach(cat => {
        const active = activeFilter == cat.id;
        c.innerHTML += `<button class="cat-tab ${active ? 'active' : ''}" onclick="filterByCategory(${cat.id})"
            style="${active ? '' : `border-color:${cat.color};color:${cat.color}`}">${cat.name}</button>`;
    });
}

function renderCategorySelect() {
    const s = document.getElementById('task-category');
    s.innerHTML = '<option value="">Category...</option>';
    categories.forEach(cat => {
        s.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
}

function filterByCategory(id) {
    activeFilter = id;
    renderCategoryTabs();
    renderTasks();
}


// ── Render Tasks ─────────────────────────────────────────────────────

function renderTasks() {
    const activeC = document.getElementById('active-tasks');
    const doneC = document.getElementById('completed-tasks');

    const active = tasks.filter(t => t.status === 'active');
    const done = tasks.filter(t => t.status === 'completed');

    const fActive = activeFilter === 'all' ? active : active.filter(t => t.category_id == activeFilter);
    const fDone = activeFilter === 'all' ? done : done.filter(t => t.category_id == activeFilter);

    activeC.innerHTML = fActive.length
        ? fActive.map(t => taskCard(t, false)).join('')
        : '<p style="text-align:center;color:#ccc;padding:30px;">—</p>';

    doneC.innerHTML = fDone.length
        ? fDone.map(t => taskCard(t, true)).join('')
        : '';

    fActive.forEach(t => { if (t.timer_running) TimerManager.startTicking(t.id, t); });
}

function taskCard(task, isDone) {
    const now = new Date();
    let dueClass = '', dueText = '';

    if (task.due_date) {
        const due = new Date(task.due_date);
        const diff = due - now;
        const hrs = diff / 3.6e6;
        if (diff < 0 && !isDone) { dueClass = 'overdue'; dueText = formatDue(due); }
        else if (hrs < 24 && hrs > 0 && !isDone) { dueClass = 'due-soon'; dueText = formatDue(due); }
        else { dueText = formatDue(due); }
    }

    const cat = task.category_name
        ? `<span class="task-category-tag" style="background:${task.category_color}18;color:${task.category_color}">${task.category_name}</span>` : '';
    const due = dueText ? `<span class="task-due ${dueClass}">${dueText}</span>` : '';
    const est = task.estimated_time ? `<span class="task-estimate">~${task.estimated_time}m</span>` : '';
    const actual = isDone && task.actual_time ? `<span class="task-estimate">${task.actual_time}m</span>` : '';

    const secs = TimerManager.getDisplaySeconds(task);
    const cdDone = TimerManager.isCountdownDone(task);
    const timerCls = cdDone ? 'timer-display countdown-done' : task.timer_running ? 'timer-display timer-active' : 'timer-display';

    const timer = !isDone ? `
        <div class="task-timer" data-timer-id="${task.id}">
            <div class="timer-ring ${task.timer_running ? 'spinning' : ''}">
                <span class="${timerCls}">${TimerManager.formatTime(secs)}</span>
            </div>
            <button class="timer-btn ${task.timer_running ? 'pause' : 'play'}" onclick="toggleTimer(${task.id})">
                ${task.timer_running ? '⏸' : '▶'}
            </button>
            <button class="timer-btn reset" onclick="resetTimer(${task.id})">↺</button>
        </div>` : '';

    return `
        <div class="task-card ${isDone ? 'completed' : ''} ${dueClass}" data-task-id="${task.id}">
            <div class="task-check" onclick="${isDone ? `reopenTask(${task.id})` : `showCompleteModal(${task.id})`}">
                ${isDone ? '✓' : ''}
            </div>
            <div class="task-info">
                <div class="task-title">${esc(task.title)}</div>
                <div class="task-meta">${cat}${due}${est}${actual}</div>
            </div>
            ${timer}
            <button class="task-delete" onclick="deleteTask(${task.id})">✕</button>
        </div>`;
}


// ── Add Task ─────────────────────────────────────────────────────────

async function handleAddTask(e) {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;

    const catId = document.getElementById('task-category').value || null;
    const due = document.getElementById('task-due').value || null;
    const timerType = document.getElementById('task-timer-type').value;
    const cdMins = document.getElementById('task-countdown-mins').value || null;

    try {
        const t = await API.createTask({
            title, category_id: catId, due_date: due, timer_type: timerType,
            estimated_time: timerType === 'countdown' && cdMins ? parseInt(cdMins) : null
        });
        tasks.unshift(t);
        renderTasks();
        updateStats();
        // Reset
        document.getElementById('task-title').value = '';
        document.getElementById('task-category').value = '';
        document.getElementById('task-due').value = '';
        document.getElementById('task-timer-type').value = 'stopwatch';
        document.getElementById('task-countdown-mins').classList.add('hidden');
        document.getElementById('task-countdown-mins').value = '';
        document.getElementById('prediction-bar').classList.add('hidden');
    } catch (e) { alert('Failed: ' + e.message); }
}


// ── Complete / Reopen ────────────────────────────────────────────────

function showCompleteModal(id) {
    completingTaskId = id;
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const mins = Math.round(TimerManager.getCurrentSeconds(t) / 60);
    document.getElementById('complete-task-title').textContent = t.title;
    document.getElementById('actual-time-input').value = mins > 0 ? mins : '';
    document.getElementById('complete-modal').classList.remove('hidden');
}

function closeCompleteModal() {
    document.getElementById('complete-modal').classList.add('hidden');
    completingTaskId = null;
}

async function confirmComplete() {
    if (!completingTaskId) return;
    const actual = document.getElementById('actual-time-input').value;
    const data = { status: 'completed', timer_running: 0 };
    if (actual) data.actual_time = parseInt(actual);
    try {
        const u = await API.updateTask(completingTaskId, data);
        TimerManager.stopTicking(completingTaskId);
        const i = tasks.findIndex(t => t.id === completingTaskId);
        if (i !== -1) tasks[i] = u;
        renderTasks(); updateStats(); closeCompleteModal();
    } catch (e) { alert(e.message); }
}

async function reopenTask(id) {
    try {
        const u = await API.updateTask(id, { status: 'active', timer_seconds: 0 });
        const i = tasks.findIndex(t => t.id === id);
        if (i !== -1) tasks[i] = u;
        renderTasks(); updateStats();
    } catch (e) { alert(e.message); }
}


// ── Delete ───────────────────────────────────────────────────────────

async function deleteTask(id) {
    if (!confirm('Delete?')) return;
    try {
        await API.deleteTask(id);
        TimerManager.stopTicking(id);
        tasks = tasks.filter(t => t.id !== id);
        renderTasks(); updateStats();
    } catch (e) { alert(e.message); }
}


// ── Timers ───────────────────────────────────────────────────────────

async function toggleTimer(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    await TimerManager.toggle(id, t);
    tasks = await API.getTasks();
    renderTasks();
}

async function resetTimer(id) {
    await TimerManager.reset(id);
    tasks = await API.getTasks();
    renderTasks();
}


// ── Predictions (silent — just fills the form) ──────────────────────

function handleTitleInput(e) {
    const title = e.target.value.trim();
    clearTimeout(predictionTimeout);

    if (title.length < 3) {
        document.getElementById('prediction-bar').classList.add('hidden');
        return;
    }

    predictionTimeout = setTimeout(async () => {
        try {
            const p = await API.predict(title);
            const bar = document.getElementById('prediction-bar');

            if (p.category && p.category.category) {
                const catChip = document.getElementById('pred-category');
                const timeChip = document.getElementById('pred-time');

                catChip.textContent = `${p.category.category}`;
                catChip.onclick = () => {
                    if (p.category_id) document.getElementById('task-category').value = p.category_id;
                };

                if (p.time && p.time.estimated_minutes) {
                    timeChip.textContent = `~${p.time.estimated_minutes}m`;
                    timeChip.classList.remove('hidden');
                } else {
                    timeChip.classList.add('hidden');
                }
                bar.classList.remove('hidden');
            } else {
                bar.classList.add('hidden');
            }
        } catch (e) { }
    }, 400);
}


// ── Categories Modal ─────────────────────────────────────────────────

function showCategoryModal() {
    document.getElementById('category-modal').classList.remove('hidden');
    renderCategoryList();
}
function closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
}

function renderCategoryList() {
    const c = document.getElementById('category-list');
    c.innerHTML = categories.map(cat => `
        <div class="cat-list-item">
            <span class="cat-color-dot" style="background:${cat.color}"></span>
            <span class="cat-name">${esc(cat.name)}</span>
            ${cat.is_default ? '' : `<button class="cat-delete" onclick="deleteCategory(${cat.id})">✕</button>`}
        </div>`).join('');
}

async function addCategory() {
    const name = document.getElementById('new-cat-name').value.trim();
    const color = document.getElementById('new-cat-color').value;
    if (!name) return;
    try {
        await API.createCategory({ name, color });
        document.getElementById('new-cat-name').value = '';
        await loadCategories();
        renderCategoryList();
    } catch (e) { alert(e.message); }
}

async function deleteCategory(id) {
    try {
        await API.deleteCategory(id);
        await loadCategories();
        renderCategoryList();
    } catch (e) { alert(e.message); }
}


// ── Reminders ────────────────────────────────────────────────────────

async function checkReminders() {
    try {
        const d = await API.getReminders();
        const banner = document.getElementById('reminder-banner');
        const list = document.getElementById('reminder-list');
        const all = [...(d.overdue || []), ...(d.due_soon || [])];

        if (!all.length) { banner.classList.add('hidden'); return; }

        list.innerHTML = all.map(t => {
            const due = new Date(t.due_date);
            const over = due < new Date();
            return `<div class="reminder-item">
                <span class="due-label">${over ? '🔴' : '🟡'}</span>
                <span>${esc(t.title)} — ${formatDue(due)}</span>
            </div>`;
        }).join('');

        banner.classList.remove('hidden');
        banner.classList.toggle('overdue', d.overdue && d.overdue.length > 0);
    } catch (e) { }
}

function closeReminders() {
    document.getElementById('reminder-banner').classList.add('hidden');
}


// ── Insights ─────────────────────────────────────────────────────────

async function loadInsights() {
    try {
        const d = await API.getInsights();
        const c = document.getElementById('insights-content');
        let html = '';

        if (d.suggestions && d.suggestions.length > 0) {
            html += d.suggestions.map(s =>
                `<div class="insight-item">
                    <span class="insight-icon">${s.type === 'time_pattern' ? '🕐' : s.type === 'day_pattern' ? '📅' : '💡'}</span>
                    <span>${s.message}</span>
                </div>`
            ).join('');
        }

        html += `<div class="insight-stats">
            <div class="insight-stat"><div class="insight-stat-value">${d.stats.active_tasks}</div><div class="insight-stat-label">Active</div></div>
            <div class="insight-stat"><div class="insight-stat-value">${d.stats.completed_tasks}</div><div class="insight-stat-label">Done</div></div>
            <div class="insight-stat"><div class="insight-stat-value">${Object.keys(d.patterns.category_frequency || {}).length}</div><div class="insight-stat-label">Categories</div></div>
        </div>`;

        c.innerHTML = html;
    } catch (e) { }
}

function toggleInsights() {
    const p = document.getElementById('insights-panel');
    const a = document.getElementById('insights-arrow');
    p.classList.toggle('hidden');
    a.textContent = p.classList.contains('hidden') ? '▸' : '▾';
    if (!p.classList.contains('hidden')) loadInsights();
}

function toggleCompleted() {
    const c = document.getElementById('completed-tasks');
    const a = document.getElementById('completed-arrow');
    c.classList.toggle('hidden');
    a.textContent = c.classList.contains('hidden') ? '▸' : '▾';
}

function updateStats() {
    const a = tasks.filter(t => t.status === 'active').length;
    const d = tasks.filter(t => t.status === 'completed').length;
    document.getElementById('stat-active').textContent = `${a} active`;
    document.getElementById('stat-completed').textContent = `${d} done`;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function formatDue(date) {
    const now = new Date();
    const diff = date - now;
    const hrs = Math.abs(diff) / 3.6e6;
    if (hrs < 1) { const m = Math.round(Math.abs(diff) / 60000); return diff < 0 ? `${m}m ago` : `in ${m}m`; }
    if (hrs < 24) { return diff < 0 ? `${Math.round(hrs)}h ago` : `in ${Math.round(hrs)}h`; }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
