import { useState } from 'react'
import * as API from '../services/api'

export default function CategoryModal({ categories, onClose, onUpdate }) {
    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState('#6366f1')

    async function handleAddCategory() {
        if (!newName.trim()) return
        try {
            await API.createCategory({ name: newName.trim(), color: newColor })
            setNewName('')
            setNewColor('#6366f1')
            await onUpdate()
        } catch (e) {
            alert(e.message)
        }
    }

    async function handleDeleteCategory(id) {
        try {
            await API.deleteCategory(id)
            await onUpdate()
        } catch (e) {
            alert(e.message)
        }
    }

    return (
        <div className="modal" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Manage Categories</h3>
                <div className="modal-form">
                    <input
                        type="text"
                        placeholder="Category name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <input
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                    />
                    <button onClick={handleAddCategory} className="btn-add">Add</button>
                </div>
                <div className="category-list">
                    {categories.map(cat => (
                        <div key={cat.id} className="cat-list-item">
                            <span
                                className="cat-color-dot"
                                style={{ background: cat.color }}
                            />
                            <span className="cat-name">{cat.name}</span>
                            {!cat.is_default && (
                                <button
                                    className="cat-delete"
                                    onClick={() => handleDeleteCategory(cat.id)}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button onClick={onClose} className="btn-close">Close</button>
            </div>
        </div>
    )
}
