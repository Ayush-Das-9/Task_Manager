import { useState, useEffect } from 'react'
import * as API from './services/api'
import TaskCard from './components/TaskCard'
import AddTaskForm from './components/AddTaskForm'
import CategoryTabs from './components/CategoryTabs'
import ReminderBanner from './components/ReminderBanner'
import InsightsPanel from './components/InsightsPanel'
import CategoryModal from './components/CategoryModal'
import CompleteTaskModal from './components/CompleteTaskModal'

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

    // Load data
    useEffect(() => {
        loadCategories()
        loadTasks()
        checkReminders()

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
            setCompletingTask(null)
        } catch (e) {
            alert(e.message)
        }
    }

    async function handleReopenTask(id) {
        try {
            const updated = await API.updateTask(id, { status: 'active', timer_seconds: 0 })
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

    function openCompleteModal(task) {
        setCompletingTask(task)
        setShowCompleteModal(true)
    }

    // Filter tasks
    const activeTasks = tasks.filter(t => t.status === 'active')
    const completedTasks = tasks.filter(t => t.status === 'completed')

    const filteredActive = activeFilter === 'all'
        ? activeTasks
        : activeTasks.filter(t => t.category_id == activeFilter)

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

            <div className="app-container">
                <header className="app-header">
                    <h1>📋 Task Manager</h1>
                    <div className="header-stats">
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
                        {filteredActive.length > 0 ? (
                            filteredActive.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onComplete={() => openCompleteModal(task)}
                                    onDelete={() => handleDeleteTask(task.id)}
                                    onTimerUpdate={handleTimerUpdate}
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
        </>
    )
}

export default App
