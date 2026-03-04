import { useState, useEffect, useRef } from 'react'
import * as API from '../services/api'
import { useTracking } from '../hooks/useTrackingStore.jsx'

export default function ProgressPanel({ onClose }) {
    const { registry, addKeyword, removeKeyword } = useTracking()

    // Add keyword input
    const [input, setInput] = useState('')

    // History search state
    const [keyword, setKeyword] = useState('')
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    function handleAdd(e) {
        e.preventDefault()
        if (!input.trim()) return
        addKeyword(input.trim())
        setInput('')
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
        if (mins > 0) return `${mins}m`
        return `${seconds}s`
    }

    function formatLastActive(timestamp) {
        if (!timestamp) return 'never'
        const d = new Date(timestamp)
        const now = new Date()
        const diffMs = now - d
        const diffHrs = diffMs / 3.6e6
        if (diffHrs < 1) {
            const mins = Math.round(diffMs / 60000)
            return mins <= 1 ? 'just now' : `${mins}m ago`
        }
        if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`
        const days = Math.floor(diffHrs / 24)
        if (days === 1) return 'yesterday'
        if (days < 7) return `${days} days ago`
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const maxSeconds = registry.length > 0
        ? Math.max(...registry.map(e => e.lifetimeSeconds), 1)
        : 1

    const maxMins = data ? Math.max(...data.days.map(d => d.minutes), 1) : 1

    return (
        <div className="progress-overlay" onClick={onClose}>
            <div className="progress-panel" onClick={e => e.stopPropagation()}>
                <div className="prog-header">
                    <h3>📈 Progress Tracker</h3>
                    <button className="prog-close" onClick={onClose}>✕</button>
                </div>

                {/* ── Add Keyword ── */}
                <form className="tracker-add-form" onSubmit={handleAdd}>
                    <input
                        type="text"
                        placeholder='Add keyword to track (e.g. "DSA", "ML")...'
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="btn-add">+ Track</button>
                </form>

                {/* ── Registry Entries ── */}
                {registry.length > 0 ? (
                    <div className="registry-list">
                        {registry.map((entry, i) => (
                            <div key={entry.id} className="registry-item">
                                <div className="registry-item-main">
                                    <div className="registry-item-left">
                                        <span className="registry-rank">#{i + 1}</span>
                                        <span className="registry-keyword">{entry.displayName}</span>
                                    </div>
                                    <div className="registry-item-right">
                                        <span className="registry-time">{formatTotalTime(entry.lifetimeSeconds)}</span>
                                        <button
                                            className="registry-delete"
                                            onClick={() => removeKeyword(entry.id)}
                                            title="Remove from tracking"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <div className="registry-bar-wrapper">
                                    <div
                                        className="registry-bar"
                                        style={{ width: `${Math.max((entry.lifetimeSeconds / maxSeconds) * 100, 2)}%` }}
                                    />
                                </div>
                                <div className="registry-meta">
                                    <span>{entry.sessionCount} session{entry.sessionCount !== 1 ? 's' : ''}</span>
                                    <span>Last: {formatLastActive(entry.lastActive)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="tracker-empty">
                        <p>No keywords being tracked yet.</p>
                        <p className="tracker-empty-hint">
                            Add a keyword above (e.g. "DSA"). Any task with that word in its name will automatically accumulate time here.
                        </p>
                    </div>
                )}

                {/* ── Divider ── */}
                <div className="tracker-divider" />

                {/* ── History Search ── */}
                <div className="tracker-history-section">
                    <h4>📊 Completed Task History</h4>
                    <form className="prog-search" onSubmit={handleSearch}>
                        <input
                            type="text"
                            placeholder='Search completed tasks (e.g. "DSA")'
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                        />
                        <button type="submit" className="btn-add">Search</button>
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
                </div>
            </div>
        </div>
    )
}
