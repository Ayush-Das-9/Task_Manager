import { useState, useEffect, useRef } from 'react'
import * as API from '../services/api'

export default function AddTaskForm({ categories, onAdd }) {
    const [title, setTitle] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [timerType, setTimerType] = useState('stopwatch')
    const [countdownMins, setCountdownMins] = useState('')
    const [predictions, setPredictions] = useState(null)
    const [predictionTimeout, setPredictionTimeout] = useState(null)

    // Autocomplete state
    const [suggestions, setSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestTimeout, setSuggestTimeout] = useState(null)
    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)

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
                    // Auto-apply predicted category
                    if (p.category_id) {
                        setCategoryId(p.category_id)
                    }
                    // Auto-apply predicted time as countdown
                    if (p.time && p.time.estimated_minutes) {
                        setTimerType('countdown')
                        setCountdownMins(String(p.time.estimated_minutes))
                    }
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

    // Autocomplete effect
    useEffect(() => {
        if (title.length < 2) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        if (suggestTimeout) clearTimeout(suggestTimeout)

        const timeout = setTimeout(async () => {
            try {
                const results = await API.searchTaskNames(title)
                setSuggestions(results)
                setShowSuggestions(results.length > 0)
            } catch (e) {
                console.error(e)
            }
        }, 300)

        setSuggestTimeout(timeout)
        return () => clearTimeout(timeout)
    }, [title])

    // Close suggestions on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
                inputRef.current && !inputRef.current.contains(e.target)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    function selectSuggestion(name) {
        setTitle(name)
        setShowSuggestions(false)
    }

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
        setSuggestions([])
        setShowSuggestions(false)
    }

    function applyCategoryPrediction() {
        if (predictions && predictions.category_id) {
            setCategoryId(predictions.category_id)
        }
    }

    return (
        <section className="add-task-section">
            <form className="add-task-form" onSubmit={handleSubmit}>
                <div className="form-row" style={{ position: 'relative' }}>
                    <input
                        ref={inputRef}
                        type="text"
                        id="task-title"
                        placeholder="Add a task..."
                        autoComplete="off"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    />
                    <button type="submit" className="btn-add">Add</button>

                    {/* Autocomplete dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="autocomplete-dropdown" ref={suggestionsRef}>
                            {suggestions.map((name, i) => (
                                <div
                                    key={i}
                                    className="autocomplete-item"
                                    onClick={() => selectSuggestion(name)}
                                >
                                    <span className="autocomplete-icon">🕐</span>
                                    <span className="autocomplete-text">{name}</span>
                                </div>
                            ))}
                        </div>
                    )}
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
