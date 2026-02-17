export default function ReminderBanner({ reminders, onClose }) {
    const all = [...(reminders.overdue || []), ...(reminders.due_soon || [])]

    if (all.length === 0) return null

    const hasOverdue = reminders.overdue && reminders.overdue.length > 0

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

    return (
        <div className={`reminder-banner ${hasOverdue ? 'overdue' : ''}`}>
            <div className="reminder-content">
                <span className="reminder-icon">⏰</span>
                <div className="reminder-list">
                    {all.map(t => {
                        const due = new Date(t.due_date)
                        const isOver = due < new Date()
                        return (
                            <div key={t.id} className="reminder-item">
                                <span className="due-label">{isOver ? '🔴' : '🟡'}</span>
                                <span>{t.title} — {formatDue(t.due_date)}</span>
                            </div>
                        )
                    })}
                </div>
                <button className="reminder-close" onClick={onClose}>✕</button>
            </div>
        </div>
    )
}
