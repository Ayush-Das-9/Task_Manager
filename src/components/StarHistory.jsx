import { useState, useEffect } from 'react'
import * as API from '../services/api'

export default function StarHistory({ onClose }) {
    const [data, setData] = useState(null)
    const [selectedDay, setSelectedDay] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        API.getWeekStars().then(d => {
            setData(d)
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    if (loading) return <div className="star-history-panel"><p>Loading...</p></div>
    if (!data) return null

    const maxStars = Math.max(...data.days.map(d => d.stars), 1)

    return (
        <div className="star-history-overlay" onClick={onClose}>
            <div className="star-history-panel" onClick={e => e.stopPropagation()}>
                <div className="sh-header">
                    <h3>⭐ Weekly Stars</h3>
                    <button className="sh-close" onClick={onClose}>✕</button>
                </div>

                {data.best_day && data.best_day.stars > 0 && (
                    <div className="sh-best-day">
                        <span className="sh-crown">👑</span>
                        Best day: <strong>{data.best_day.day}</strong> — {data.best_day.stars} stars
                    </div>
                )}

                <div className="sh-chart">
                    {data.days.map((day, i) => (
                        <div
                            key={i}
                            className={`sh-bar-col ${selectedDay === i ? 'selected' : ''} ${data.best_day && day.date === data.best_day.date && day.stars > 0 ? 'best' : ''}`}
                            onClick={() => setSelectedDay(selectedDay === i ? null : i)}
                        >
                            <span className="sh-bar-value">{day.stars > 0 ? day.stars : ''}</span>
                            <div
                                className="sh-bar"
                                style={{ height: `${Math.max((day.stars / maxStars) * 100, 4)}%` }}
                            />
                            <span className="sh-bar-label">{day.day}</span>
                        </div>
                    ))}
                </div>

                {selectedDay !== null && data.days[selectedDay] && (
                    <div className="sh-tasks">
                        <h4>
                            {data.days[selectedDay].day} — {data.days[selectedDay].date}
                            <span className="sh-task-count">{data.days[selectedDay].task_count} tasks</span>
                        </h4>
                        {data.days[selectedDay].tasks.length === 0 ? (
                            <p className="sh-empty">No tasks completed</p>
                        ) : (
                            <ul>
                                {data.days[selectedDay].tasks.map((t, j) => (
                                    <li key={j}>
                                        <span
                                            className="sh-task-dot"
                                            style={{ background: t.category_color }}
                                        />
                                        <span className="sh-task-title">{t.title}</span>
                                        {(t.actual_time || t.estimated_time) && (
                                            <span className="sh-task-time">
                                                {t.actual_time || t.estimated_time} min
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
