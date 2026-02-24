import { useState, useEffect } from 'react'
import * as API from '../services/api'

export default function ProgressPanel({ onClose }) {
    const [keyword, setKeyword] = useState('')
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    // Lifetime tracking state
    const [trackedTasks, setTrackedTasks] = useState([])
    const [trackingLoading, setTrackingLoading] = useState(true)

    useEffect(() => {
        loadTrackedTasks()
    }, [])

    async function loadTrackedTasks() {
        setTrackingLoading(true)
        try {
            const result = await API.getLifetimeTracking()
            setTrackedTasks(result)
        } catch (err) {
            console.error(err)
        }
        setTrackingLoading(false)
    }

    async function handleSearch(e) {
        e.preventDefault()
        if (!keyword.trim()) return
        setLoading(true)
        setSearched(true)
        try {
            const result = await API.getProgress(keyword.trim())
            setData(result)
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }

    function formatTotalTime(seconds) {
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        if (hrs > 0) return `${hrs}h ${mins}m`
        return `${mins}m`
    }

    const maxMins = data ? Math.max(...data.days.map(d => d.minutes), 1) : 1
    const maxTrackedSeconds = trackedTasks.length > 0
        ? Math.max(...trackedTasks.map(t => t.total_seconds), 1)
        : 1

    return (
        <div className="progress-overlay" onClick={onClose}>
            <div className="progress-panel" onClick={e => e.stopPropagation()}>
                <div className="prog-header">
                    <h3>📈 Progress Tracker</h3>
                    <button className="prog-close" onClick={onClose}>✕</button>
                </div>

                <form className="prog-search" onSubmit={handleSearch}>
                    <input
                        type="text"
                        placeholder='Search task keyword (e.g. "DSA")'
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="btn-add">Track</button>
                </form>

                {loading && <p className="prog-loading">Loading...</p>}

                {data && !loading && (
                    <>
                        <div className="prog-stats">
                            <div className="prog-stat">
                                <span className="prog-stat-value">{Math.round(data.total_minutes / 60 * 10) / 10}h</span>
                                <span className="prog-stat-label">Total Time</span>
                            </div>
                            <div className="prog-stat">
                                <span className="prog-stat-value">{data.total_tasks}</span>
                                <span className="prog-stat-label">Tasks</span>
                            </div>
                            <div className="prog-stat">
                                <span className="prog-stat-value">{data.avg_per_day}m</span>
                                <span className="prog-stat-label">Avg/Day</span>
                            </div>
                            <div className="prog-stat">
                                <span className="prog-stat-value">{data.streak}🔥</span>
                                <span className="prog-stat-label">Streak</span>
                            </div>
                        </div>

                        <div className="prog-chart">
                            <div className="prog-chart-title">
                                Daily time for "<strong>{data.keyword}</strong>" (last 14 days)
                            </div>
                            <div className="prog-bars">
                                {data.days.map((day, i) => (
                                    <div key={i} className="prog-bar-col" title={`${day.date}: ${day.minutes} min`}>
                                        <span className="prog-bar-value">
                                            {day.minutes > 0 ? `${day.minutes}m` : ''}
                                        </span>
                                        <div
                                            className="prog-bar"
                                            style={{
                                                height: `${Math.max((day.minutes / maxMins) * 100, 3)}%`,
                                                background: day.minutes > 0
                                                    ? 'linear-gradient(180deg, #4f46e5, #818cf8)'
                                                    : 'var(--border)'
                                            }}
                                        />
                                        <span className="prog-bar-label">{day.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {searched && !loading && data && data.total_tasks === 0 && (
                    <p className="prog-empty">No completed tasks found matching "{keyword}"</p>
                )}

                {/* ── Total Time Tracking Section ── */}
                <div className="lifetime-tracking-section">
                    <div className="lifetime-header">
                        <h4>🕐 Total Time Tracking</h4>
                        <span className="lifetime-subtitle">Lifetime-tracked tasks</span>
                    </div>

                    {trackingLoading ? (
                        <p className="prog-loading">Loading tracked tasks...</p>
                    ) : trackedTasks.length === 0 ? (
                        <p className="lifetime-empty">
                            No tasks are being tracked yet. Click the ⏱ button on any task to start lifetime tracking.
                        </p>
                    ) : (
                        <div className="lifetime-list">
                            {trackedTasks.map((task, i) => (
                                <div key={task.id} className="lifetime-item">
                                    <div className="lifetime-item-header">
                                        <span className="lifetime-rank">#{i + 1}</span>
                                        <span className="lifetime-name">{task.display_name}</span>
                                        <span className="lifetime-time">
                                            {formatTotalTime(task.total_seconds)}
                                        </span>
                                    </div>
                                    <div className="lifetime-bar-wrapper">
                                        <div
                                            className="lifetime-bar"
                                            style={{
                                                width: `${Math.max((task.total_seconds / maxTrackedSeconds) * 100, 2)}%`
                                            }}
                                        />
                                    </div>
                                    <span className="lifetime-sessions">{task.sessions} session{task.sessions !== 1 ? 's' : ''}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
