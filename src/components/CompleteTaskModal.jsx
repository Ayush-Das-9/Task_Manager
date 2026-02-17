import { useState } from 'react'
import * as API from '../services/api'

export default function CompleteTaskModal({ task, onClose, onConfirm }) {
    const [actualTime, setActualTime] = useState('')

    function handleConfirm() {
        onConfirm(task.id, actualTime)
    }

    return (
        <div className="modal" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Done!</h3>
                <p>{task.title}</p>
                <label>Time spent (min)</label>
                <input
                    type="number"
                    min="0"
                    placeholder="30"
                    value={actualTime}
                    onChange={(e) => setActualTime(e.target.value)}
                />
                <div className="modal-buttons">
                    <button onClick={handleConfirm} className="btn-add">Done</button>
                    <button onClick={onClose} className="btn-close">Cancel</button>
                </div>
            </div>
        </div>
    )
}
