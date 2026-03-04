import { useState, useEffect, useRef } from 'react'
import * as API from '../services/api'
import { useTracking } from '../hooks/useTrackingStore.jsx'

export default function TaskCard({ task, isCompleted = false, onComplete, onReopen, onDelete, onTimerUpdate, onCountdownComplete, onToggleImportant }) {
    const { accumulateTime } = useTracking()

    // Timestamp-based timer state
    const initialSeconds = (task.timer_type === 'countdown' && !task.timer_seconds && task.estimated_time)
        ? task.estimated_time * 60
        : (task.timer_seconds || 0)

    const [timerBase, setTimerBase] = useState(initialSeconds)
    const [isRunning, setIsRunning] = useState(task.timer_running || false)
    const [startedAt, setStartedAt] = useState(
        task.timer_running && task.timer_started_at
            ? new Date(task.timer_started_at).getTime()
            : null
    )
    const [countdownDone, setCountdownDone] = useState(task.countdown_completed || false)
    const [tick, setTick] = useState(0)

    // Notes state
    const [showNotes, setShowNotes] = useState(false)
    const [notes, setNotes] = useState([])
    const [noteText, setNoteText] = useState('')
    const [notesLoading, setNotesLoading] = useState(false)

    const tickRef = useRef(null)

    // Compute current display seconds from timestamps
    function getCurrentSeconds() {
        if (!isRunning || !startedAt) return timerBase
        const elapsedSinceStart = (Date.now() - startedAt) / 1000
        if (task.timer_type === 'countdown') {
            return Math.max(timerBase - elapsedSinceStart, 0)
        }
        return timerBase + elapsedSinceStart
    }

    // Get raw elapsed seconds for this session (always positive, for registry)
    function getSessionElapsed() {
        if (!startedAt) return 0
        return (Date.now() - startedAt) / 1000
    }

    // UI refresh interval — only triggers re-renders, never increments state
    useEffect(() => {
        if (isRunning && !isCompleted) {
            tickRef.current = setInterval(() => {
                setTick(t => t + 1)
                if (task.timer_type === 'countdown') {
                    const current = getCurrentSeconds()
                    if (current <= 0 && !countdownDone) {
                        handleCountdownFinished()
                    }
                }
            }, 1000)
        } else {
            if (tickRef.current) {
                clearInterval(tickRef.current)
                tickRef.current = null
            }
        }
        return () => { if (tickRef.current) clearInterval(tickRef.current) }
    }, [isRunning, isCompleted, countdownDone])

    // Recalculate on tab visibility change
    useEffect(() => {
        function handleVisibility() {
            if (document.visibilityState === 'visible') {
                setTick(t => t + 1)
                if (isRunning && task.timer_type === 'countdown' && !countdownDone) {
                    const current = getCurrentSeconds()
                    if (current <= 0) handleCountdownFinished()
                }
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        return () => document.removeEventListener('visibilitychange', handleVisibility)
    }, [isRunning, countdownDone, timerBase, startedAt])

    async function handleCountdownFinished() {
        // Accumulate session time to matching registry entries
        const elapsed = getSessionElapsed()
        if (elapsed > 0) {
            accumulateTime(task.title, elapsed)
        }

        setIsRunning(false)
        setCountdownDone(true)
        setStartedAt(null)
        setTimerBase(0)
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
        try {
            await API.updateTask(task.id, {
                timer_running: 0, timer_seconds: 0,
                timer_started_at: null, countdown_completed: true
            })
            if (onCountdownComplete) onCountdownComplete(task)
            if (onTimerUpdate) onTimerUpdate()
        } catch (e) { console.error(e) }
    }

    async function handleToggleTimer() {
        try {
            const newRunning = !isRunning
            if (newRunning) {
                // START
                const now = Date.now()
                setStartedAt(now)
                setIsRunning(true)
                await API.updateTask(task.id, {
                    timer_running: 1,
                    timer_started_at: new Date(now).toISOString(),
                    timer_seconds: timerBase
                })
            } else {
                // STOP — compute elapsed from timestamps, write to registry
                const elapsed = getSessionElapsed()
                let newBase
                if (task.timer_type === 'countdown') {
                    newBase = Math.max(timerBase - elapsed, 0)
                } else {
                    newBase = timerBase + elapsed
                }

                // Write elapsed session time to the tracking registry
                if (elapsed > 0) {
                    accumulateTime(task.title, elapsed)
                }

                setTimerBase(newBase)
                setStartedAt(null)
                setIsRunning(false)
                await API.updateTask(task.id, {
                    timer_running: 0,
                    timer_started_at: null,
                    timer_seconds: Math.floor(newBase)
                })
            }
            if (onTimerUpdate) onTimerUpdate()
        } catch (e) { console.error(e) }
    }

    async function handleResetTimer() {
        try {
            // If running, accumulate before reset
            if (isRunning && startedAt) {
                const elapsed = getSessionElapsed()
                if (elapsed > 0) accumulateTime(task.title, elapsed)
            }
            const resetSeconds = task.timer_type === 'countdown' && task.estimated_time
                ? task.estimated_time * 60 : 0
            await API.updateTask(task.id, {
                timer_seconds: resetSeconds, timer_running: 0,
                timer_started_at: null, countdown_completed: false
            })
            setTimerBase(resetSeconds)
            setCountdownDone(false)
            setIsRunning(false)
            setStartedAt(null)
            if (onTimerUpdate) onTimerUpdate()
        } catch (e) { console.error(e) }
    }

    // ── Notes ──
    async function loadNotes() {
        setNotesLoading(true)
        try {
            const data = await API.getTaskNotes(task.title.toLowerCase())
            setNotes(data.notes || [])
        } catch (e) { console.error(e) }
        setNotesLoading(false)
    }

    function toggleNotes() {
        const next = !showNotes
        setShowNotes(next)
        if (next) loadNotes()
    }

    async function saveNote() {
        if (!noteText.trim()) return
        try {
            const data = await API.addTaskNote(task.title.toLowerCase(), noteText.trim())
            setNotes(data.notes || [])
            setNoteText('')
        } catch (e) { console.error(e) }
    }

    function formatNoteDate(dateStr) {
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    function groupNotesByDate(notesList) {
        const groups = {}
        for (const note of notesList) {
            const dateKey = formatNoteDate(note.date)
            if (!groups[dateKey]) groups[dateKey] = []
            groups[dateKey].push(note)
        }
        return groups
    }

    function formatTime(seconds) {
        const absSeconds = Math.abs(Math.floor(seconds))
        const hrs = Math.floor(absSeconds / 3600)
        const mins = Math.floor((absSeconds % 3600) / 60)
        const secs = absSeconds % 60
        if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
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
        if (hrs < 24) return diff < 0 ? `${Math.round(hrs)}h ago` : `in ${Math.round(hrs)}h`
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    // Due status
    let dueClass = '', dueText = ''
    if (task.due_date && !isCompleted) {
        const due = new Date(task.due_date)
        const diff = due - new Date()
        const hrs = diff / 3.6e6
        if (diff < 0) { dueClass = 'overdue'; dueText = formatDue(task.due_date) }
        else if (hrs < 24 && hrs > 0) { dueClass = 'due-soon'; dueText = formatDue(task.due_date) }
        else { dueText = formatDue(task.due_date) }
    }

    const displaySeconds = getCurrentSeconds()
    const isCountdownDone = (task.timer_type === 'countdown' && (displaySeconds <= 0 || countdownDone)) && !isCompleted
    const timerCls = isCountdownDone ? 'timer-display countdown-done'
        : isRunning ? 'timer-display timer-active' : 'timer-display'

    const potentialStars = task.timer_type === 'countdown' && task.estimated_time
        ? Math.round((task.estimated_time / 60) * 10) / 10 : 0

    const noteGroups = groupNotesByDate(notes)

    return (
        <div className="task-card-wrapper">
            <div className={`task-card ${isCompleted ? 'completed' : ''} ${dueClass} ${task.is_important && !isCompleted ? 'important' : ''}`}>
                {!isCompleted && (
                    <button
                        className={`task-important-btn ${task.is_important ? 'active' : ''}`}
                        onClick={onToggleImportant}
                        title={task.is_important ? 'Remove priority' : 'Mark as important'}
                    >
                        {task.is_important ? '🔥' : '○'}
                    </button>
                )}
                <div className="task-check" onClick={isCompleted ? onReopen : onComplete}>
                    {isCompleted && '✓'}
                </div>
                <div className="task-info">
                    <div className="task-title">
                        {task.is_important && !isCompleted && <span className="important-label">PRIORITY</span>}
                        {task.title}
                    </div>
                    <div className="task-meta">
                        {task.category_name && (
                            <span className="task-category-tag" style={{
                                background: `${task.category_color}18`, color: task.category_color
                            }}>{task.category_name}</span>
                        )}
                        {dueText && <span className={`task-due ${dueClass}`}>{dueText}</span>}
                        {task.estimated_time && <span className="task-estimate">~{task.estimated_time}m</span>}
                        {isCompleted && task.actual_time && <span className="task-estimate">{task.actual_time}m</span>}
                    </div>
                </div>

                <div className="task-actions-row">
                    <button className={`task-notes-btn ${showNotes ? 'active' : ''}`} onClick={toggleNotes} title="Notes">📝</button>
                </div>

                {!isCompleted && (
                    <div className="task-timer">
                        <div className={`timer-ring ${isRunning ? 'spinning' : ''} ${isCountdownDone ? 'countdown-complete-ring' : ''}`}>
                            <span className={timerCls}>{formatTime(displaySeconds)}</span>
                        </div>
                        {isCountdownDone && potentialStars > 0 && (
                            <span className="star-ready-badge" title={`Complete to earn ${potentialStars} star${potentialStars !== 1 ? 's' : ''}!`}>
                                ⭐ {potentialStars}
                            </span>
                        )}
                        <button className={`timer-btn ${isRunning ? 'pause' : 'play'}`} onClick={handleToggleTimer}>
                            {isRunning ? '⏸' : '▶'}
                        </button>
                        <button className="timer-btn reset" onClick={handleResetTimer}>↺</button>
                    </div>
                )}
                <button className="task-delete" onClick={onDelete}>✕</button>
            </div>

            {showNotes && (
                <div className="task-notes-panel">
                    {notesLoading ? (
                        <p className="notes-loading">Loading notes...</p>
                    ) : (
                        <>
                            {notes.length > 0 && (
                                <div className="notes-history">
                                    {Object.entries(noteGroups).map(([date, dateNotes]) => (
                                        <div key={date} className="notes-date-group">
                                            <div className="notes-date-divider"><span>{date}</span></div>
                                            {dateNotes.map((note, i) => (
                                                <div key={i} className="note-entry">
                                                    <span className="note-time">
                                                        {new Date(note.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="note-text">{note.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="notes-input-area">
                                <textarea placeholder="Add a note..." value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} />
                                <button className="notes-save-btn" onClick={saveNote}>Save note</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
