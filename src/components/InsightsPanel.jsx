import { useState, useEffect } from 'react'
import * as API from '../services/api'

export default function InsightsPanel({ show, onToggle }) {
    const [insights, setInsights] = useState(null)

    useEffect(() => {
        if (show && !insights) {
            loadInsights()
        }
    }, [show])

    async function loadInsights() {
        try {
            const data = await API.getInsights()
            setInsights(data)
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <section className="insights-section">
            <button className="insights-toggle" onClick={onToggle}>
                💡 Insights <span>{show ? '▾' : '▸'}</span>
            </button>
            {show && insights && (
                <div className="insights-panel">
                    {insights.suggestions && insights.suggestions.length > 0 && (
                        insights.suggestions.map((s, i) => (
                            <div key={i} className="insight-item">
                                <span className="insight-icon">
                                    {s.type === 'time_pattern' ? '🕐' : s.type === 'day_pattern' ? '📅' : '💡'}
                                </span>
                                <span>{s.message}</span>
                            </div>
                        ))
                    )}
                    <div className="insight-stats">
                        <div className="insight-stat">
                            <div className="insight-stat-value">{insights.stats.active_tasks}</div>
                            <div className="insight-stat-label">Active</div>
                        </div>
                        <div className="insight-stat">
                            <div className="insight-stat-value">{insights.stats.completed_tasks}</div>
                            <div className="insight-stat-label">Done</div>
                        </div>
                        <div className="insight-stat">
                            <div className="insight-stat-value">
                                {Object.keys(insights.patterns.category_frequency || {}).length}
                            </div>
                            <div className="insight-stat-label">Categories</div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
