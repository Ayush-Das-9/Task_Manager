import { useState, useEffect } from 'react'
import * as API from './services/api'
import TaskCard from './components/TaskCard'
import AddTaskForm from './components/AddTaskForm'
import CategoryTabs from './components/CategoryTabs'
import ReminderBanner from './components/ReminderBanner'
import InsightsPanel from './components/InsightsPanel'
import CategoryModal from './components/CategoryModal'
import CompleteTaskModal from './components/CompleteTaskModal'
import StarCounter from './components/StarCounter'
import StarBurst from './components/StarBurst'
import StarHistory from './components/StarHistory'
import ProgressPanel from './components/ProgressPanel'
import SidePanel from './components/SidePanel'

function App() {
    const [tasks, setTasks] = useState([])
    const [categories, setCategories] = useState([])
    const [activeFilter, setActiveFilter] = useState('all')
    const [reminders, setReminders] = useState({ overdue: [], due_soon: [] })
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [showCompleteModal, setShowCompleteModal] = useState(false)
    const [completingTask, setCompletingTask] = useState(null)
    const [showInsights, setShowInsights] = useState(false)
    const [showCompleted, setShowCompleted] = useState(false)

    // ⭐ Star system state
    const [todayStars, setTodayStars] = useState(0)
    const [starAnimating, setStarAnimating] = useState(false)
    const [starBurst, setStarBurst] = useState(null) // { starsEarned, taskTitle }
    const [showStarHistory, setShowStarHistory] = useState(false)
    const [showProgress, setShowProgress] = useState(false)

    // Load data
    useEffect(() => {
        loadCategories()
        loadTasks()
        checkReminders()
        loadTodayStars()

        const reminderInterval = setInterval(checkReminders, 60000)
        const syncInterval = setInterval(syncTasks, 10000)

        return () => {
            clearInterval(reminderInterval)
            clearInterval(syncInterval)
        }
    }, [])

    async function loadCategories() {
        try {
            const cats = await API.getCategories()
            setCategories(cats)
        } catch (e) { console.error(e) }
    }

    async function loadTasks() {
        try {
            const t = await API.getTasks()
            setTasks(t)
        } catch (e) { console.error(e) }
    }

    async function syncTasks() {
        try {
            const fresh = await API.getTasks()
            setTasks(prev => JSON.stringify(fresh) !== JSON.stringify(prev) ? fresh : prev)
        } catch (e) { }
    }

    async function checkReminders() {
        try {
            const r = await API.getReminders()
            setReminders(r)
        } catch (e) { }
    }

    async function loadTodayStars() {
        try {
            const data = await API.getTodayStars()
            setTodayStars(data.total_stars || 0)
        } catch (e) { console.error(e) }
    }

    // Task actions
    async function handleAddTask(taskData) {
        try {
            const t = await API.createTask(taskData)
            setTasks(prev => [t, ...prev])
        } catch (e) {
            alert('Failed: ' + e.message)
        }
    }

    async function handleCompleteTask(id, actualTime) {
        try {
            const data = { status: 'completed', timer_running: 0 }
            if (actualTime) data.actual_time = parseInt(actualTime)
            const updated = await API.updateTask(id, data)
            setTasks(prev => prev.map(t => t.id === id ? updated : t))
            setShowCompleteModal(false)

            // ⭐ Try to earn stars — use fresh task data from state, not stale completingTask
            const freshTask = tasks.find(t => t.id === id) || completingTask
            if (freshTask && freshTask.timer_type === 'countdown') {
                try {
                    const result = await API.earnStars(id)
                    // Trigger star burst animation!
                    setStarBurst({
                        starsEarned: result.stars_earned,
                        taskTitle: result.task_title
                    })
                    setStarAnimating(true)
                    setTodayStars(result.total_today)
                    setTimeout(() => setStarAnimating(false), 2000)
                } catch (starErr) {
                    // No stars earned (didn't meet conditions) — that's fine
                    console.log('No stars earned:', starErr.message)
                }
            }

            setCompletingTask(null)
        } catch (e) {
            alert(e.message)
        }
    }

    async function handleReopenTask(id) {
        try {
            const updated = await API.updateTask(id, {
                status: 'active',
                timer_seconds: 0,
                countdown_completed: false
            })
            setTasks(prev => prev.map(t => t.id === id ? updated : t))
        } catch (e) {
            alert(e.message)
        }
    }

    async function handleDeleteTask(id) {
        if (!confirm('Delete?')) return
        try {
            await API.deleteTask(id)
            setTasks(prev => prev.filter(t => t.id !== id))
        } catch (e) {
            alert(e.message)
        }
    }

    async function handleTimerUpdate() {
        await loadTasks()
    }

    function handleCountdownComplete(task) {
        // Refresh task data to get updated countdown_completed flag
        loadTasks()
    }

    function openCompleteModal(task) {
        setCompletingTask(task)
        setShowCompleteModal(true)
    }

    async function handleToggleImportant(id) {
        try {
            const task = tasks.find(t => t.id === id)
            if (!task) return
            const updated = await API.updateTask(id, { is_important: !task.is_important })
            setTasks(prev => prev.map(t => t.id === id ? updated : t))
        } catch (e) {
            console.error(e)
        }
    }

    // Filter tasks
    const activeTasks = tasks.filter(t => t.status === 'active')
    const completedTasks = tasks.filter(t => t.status === 'completed')

    const filteredActive = activeFilter === 'all'
        ? activeTasks
        : activeTasks.filter(t => t.category_id == activeFilter)

    // Sort: important tasks first, then by created_at
    const sortedActive = [...filteredActive].sort((a, b) => {
        if (a.is_important && !b.is_important) return -1
        if (!a.is_important && b.is_important) return 1
        return 0
    })

    const filteredCompleted = activeFilter === 'all'
        ? completedTasks
        : completedTasks.filter(t => t.category_id == activeFilter)

    const stats = {
        active: activeTasks.length,
        completed: completedTasks.length
    }

    return (
        <>
            <ReminderBanner
                reminders={reminders}
                onClose={() => setReminders({ overdue: [], due_soon: [] })}
            />

            <div className="app-layout">
                <div className="app-container">
                    <header className="app-header">
                        <div className="header-left">
                            <button
                                className="progress-btn"
                                onClick={() => setShowProgress(true)}
                            >
                                📈 Progress
                            </button>
                        </div>
                        <h1>📋 Task Manager</h1>
                        <div className="header-stats">
                            <div onClick={() => setShowStarHistory(true)} style={{ cursor: 'pointer' }}>
                                <StarCounter
                                    totalStars={todayStars}
                                    isAnimating={starAnimating}
                                />
                            </div>
                            <span className="stat-badge">{stats.active} active</span>
                            <span className="stat-badge">{stats.completed} done</span>
                        </div>
                    </header>

                    <AddTaskForm
                        categories={categories}
                        onAdd={handleAddTask}
                    />

                    <InsightsPanel
                        show={showInsights}
                        onToggle={() => setShowInsights(!showInsights)}
                    />

                    <CategoryTabs
                        categories={categories}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        onManageCategories={() => setShowCategoryModal(true)}
                    />

                    <section className="tasks-section">
                        <div className="task-list">
                            {sortedActive.length > 0 ? (
                                sortedActive.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onComplete={() => openCompleteModal(task)}
                                        onDelete={() => handleDeleteTask(task.id)}
                                        onTimerUpdate={handleTimerUpdate}
                                        onCountdownComplete={handleCountdownComplete}
                                        onToggleImportant={() => handleToggleImportant(task.id)}
                                    />
                                ))
                            ) : (
                                <p style={{ textAlign: 'center', color: '#ccc', padding: '30px' }}>—</p>
                            )}
                        </div>

                        <div
                            className="completed-header"
                            onClick={() => setShowCompleted(!showCompleted)}
                        >
                            <span>✓ Completed</span>
                            <span>{showCompleted ? '▾' : '▸'}</span>
                        </div>

                        {!showCompleted ? null : (
                            <div className="task-list">
                                {filteredCompleted.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        isCompleted={true}
                                        onReopen={() => handleReopenTask(task.id)}
                                        onDelete={() => handleDeleteTask(task.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <SidePanel />
            </div>

            {showCategoryModal && (
                <CategoryModal
                    categories={categories}
                    onClose={() => setShowCategoryModal(false)}
                    onUpdate={loadCategories}
                />
            )}

            {showCompleteModal && completingTask && (
                <CompleteTaskModal
                    task={completingTask}
                    onClose={() => {
                        setShowCompleteModal(false)
                        setCompletingTask(null)
                    }}
                    onConfirm={handleCompleteTask}
                />
            )}

            {/* ⭐ Star Burst Animation Overlay */}
            {starBurst && (
                <StarBurst
                    starsEarned={starBurst.starsEarned}
                    taskTitle={starBurst.taskTitle}
                    onDone={() => setStarBurst(null)}
                />
            )}

            {/* Star History Panel */}
            {showStarHistory && (
                <StarHistory onClose={() => setShowStarHistory(false)} />
            )}

            {/* Progress Panel */}
            {showProgress && (
                <ProgressPanel onClose={() => setShowProgress(false)} />
            )}
        </>
    )
}

export default App
