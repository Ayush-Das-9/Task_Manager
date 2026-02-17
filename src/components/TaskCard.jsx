import { useState, useEffect, useRef } from 'react'
import * as API from '../services/api'

export default function TaskCard({ task, isCompleted = false, onComplete, onReopen, onDelete, onTimerUpdate }) {
    const [timerSeconds, setTimerSeconds] = useState(task.timer_seconds || 0)
    const [isRunning, setIsRunning] = useState(task.timer_running || false)
    const intervalRef = useRef(null)

    useEffect(() => {
        if (isRunning && !isCompleted) {
            intervalRef.current = setInterval(() => {
                setTimerSeconds(prev => {
                    const next = task.timer_type === 'countdown'
                        ? prev - 1
                        : prev + 1

                    // Stop countdown at 0
                    if (task.timer_type === 'countdown' && next <= 0) {
                        handleToggleTimer()
                        return 0
                    }
                    return next
                })
            }, 1000)
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [isRunning, isCompleted])

    async function handleToggleTimer() {
        try {
            const newState = !isRunning
            const data = {
                timer_running: newState ? 1 : 0,
                timer_started_at: newState ? new Date().toISOString() : null,
                timer_seconds: timerSeconds
            }
            await API.updateTask(task.id, data)
            setIsRunning(newState)
            if (onTimerUpdate) onTimerUpdate()
        } catch (e) {
            console.error(e)
        }
    }

    async function handleResetTimer() {
        try {
            await API.updateTask(task.id, {
                timer_seconds: 0,
                timer_running: 0,
                timer_started_at: null
            })
            setTimerSeconds(0)
            setIsRunning(false)
            if (onTimerUpdate) onTimerUpdate()
        } catch (e) {
            console.error(e)
        }
    }

    function formatTime(seconds) {
        const absSeconds = Math.abs(seconds)
        const hrs = Math.floor(absSeconds / 3600)
        const mins = Math.floor((absSeconds % 3600) / 60)
        const secs = absSeconds % 60
        if (hrs > 0) {
            return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        }
        return `${mins}:${String(secs).padStart(2, '0')}`
    }

    function formatDue(dateStr) {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = date - now
        const hrs = Math.abs(diff) / 3.6e6
        if (hrs < 1) {
            const m = Math.round(Math.abs(diff) / 60000)
            return diff < 0 ? `${m}m ago` : `in ${m}m`
        }
        if (hrs < 24) {
            return diff < 0 ? `${Math.round(hrs)}h ago` : `in ${Math.round(hrs)}h`
        }
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
    }

    // Calculate due status
    let dueClass = ''
    let dueText = ''
    if (task.due_date && !isCompleted) {
        const due = new Date(task.due_date)
        const now = new Date()
        const diff = due - now
        const hrs = diff / 3.6e6
        if (diff < 0) {
            dueClass = 'overdue'
            dueText = formatDue(task.due_date)
        } else if (hrs < 24 && hrs > 0) {
            dueClass = 'due-soon'
            dueText = formatDue(task.due_date)
        } else {
            dueText = formatDue(task.due_date)
        }
    }

    const isCountdownDone = task.timer_type === 'countdown' && timerSeconds <= 0 && !isCompleted
    const timerCls = isCountdownDone
        ? 'timer-display countdown-done'
        : isRunning
            ? 'timer-display timer-active'
            : 'timer-display'

    return (
        <div className={`task-card ${isCompleted ? 'completed' : ''} ${dueClass}`}>
            <div
                className="task-check"
                onClick={isCompleted ? onReopen : onComplete}
            >
                {isCompleted && '✓'}
            </div>
            <div className="task-info">
                <div className="task-title">{task.title}</div>
                <div className="task-meta">
                    {task.category_name && (
                        <span
                            className="task-category-tag"
                            style={{
                                background: `${task.category_color}18`,
                                color: task.category_color
                            }}
                        >
                            {task.category_name}
                        </span>
                    )}
                    {dueText && (
                        <span className={`task-due ${dueClass}`}>{dueText}</span>
                    )}
                    {task.estimated_time && (
                        <span className="task-estimate">~{task.estimated_time}m</span>
                    )}
                    {isCompleted && task.actual_time && (
                        <span className="task-estimate">{task.actual_time}m</span>
                    )}
                </div>
            </div>
            {!isCompleted && (
                <div className="task-timer">
                    <div className={`timer-ring ${isRunning ? 'spinning' : ''}`}>
                        <span className={timerCls}>{formatTime(timerSeconds)}</span>
                    </div>
                    <button
                        className={`timer-btn ${isRunning ? 'pause' : 'play'}`}
                        onClick={handleToggleTimer}
                    >
                        {isRunning ? '⏸' : '▶'}
                    </button>
                    <button className="timer-btn reset" onClick={handleResetTimer}>
                        ↺
                    </button>
                </div>
            )}
            <button className="task-delete" onClick={onDelete}>✕</button>
        </div>
    )
}
