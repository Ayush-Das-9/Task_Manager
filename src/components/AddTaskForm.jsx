import { useState, useEffect } from 'react'
import * as API from '../services/api'

export default function AddTaskForm({ categories, onAdd }) {
    const [title, setTitle] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [timerType, setTimerType] = useState('stopwatch')
    const [countdownMins, setCountdownMins] = useState('')
    const [predictions, setPredictions] = useState(null)
    const [predictionTimeout, setPredictionTimeout] = useState(null)

    useEffect(() => {
        if (title.length < 3) {
            setPredictions(null)
            return
        }

        if (predictionTimeout) clearTimeout(predictionTimeout)

        const timeout = setTimeout(async () => {
            try {
                const p = await API.predict(title)
                if (p.category && p.category.category) {
                    setPredictions(p)
                } else {
                    setPredictions(null)
                }
            } catch (e) {
                console.error(e)
            }
        }, 400)

        setPredictionTimeout(timeout)

        return () => clearTimeout(timeout)
    }, [title])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!title.trim()) return

        const taskData = {
            title: title.trim(),
            category_id: categoryId || null,
            due_date: dueDate || null,
            timer_type: timerType,
            estimated_time: timerType === 'countdown' && countdownMins ? parseInt(countdownMins) : null
        }

        await onAdd(taskData)

        // Reset form
        setTitle('')
        setCategoryId('')
        setDueDate('')
        setTimerType('stopwatch')
        setCountdownMins('')
        setPredictions(null)
    }

    function applyCategoryPrediction() {
        if (predictions && predictions.category_id) {
            setCategoryId(predictions.category_id)
        }
    }

    return (
        <section className="add-task-section">
            <form className="add-task-form" onSubmit={handleSubmit}>
                <div className="form-row">
                    <input
                        type="text"
                        id="task-title"
                        placeholder="Add a task..."
                        autoComplete="off"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <button type="submit" className="btn-add">Add</button>
                </div>
                <div className="form-row form-details">
                    <select
                        id="task-category"
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                    >
                        <option value="">Category...</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                    <input
                        type="datetime-local"
                        id="task-due"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                    />
                    <select
                        id="task-timer-type"
                        value={timerType}
                        onChange={(e) => setTimerType(e.target.value)}
                    >
                        <option value="stopwatch">⏱ Stopwatch</option>
                        <option value="countdown">⏳ Countdown</option>
                    </select>
                    {timerType === 'countdown' && (
                        <input
                            type="number"
                            placeholder="Minutes"
                            min="1"
                            className="countdown-input"
                            value={countdownMins}
                            onChange={(e) => setCountdownMins(e.target.value)}
                        />
                    )}
                </div>
                {predictions && predictions.category && (
                    <div className="prediction-bar">
                        <span
                            className="pred-chip"
                            onClick={applyCategoryPrediction}
                        >
                            {predictions.category.category}
                        </span>
                        {predictions.time && predictions.time.estimated_minutes && (
                            <span className="pred-chip">
                                ~{predictions.time.estimated_minutes}m
                            </span>
                        )}
                    </div>
                )}
            </form>
        </section>
    )
}
