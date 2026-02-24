import { useState, useEffect } from 'react'

const DEFAULT_STATE = {
    sections: [
        {
            id: 'section-1',
            title: 'BUY',
            collapsed: false,
            items: []
        },
        {
            id: 'section-2',
            title: 'Reminder',
            collapsed: false,
            items: []
        }
    ]
}

function loadState() {
    try {
        const saved = localStorage.getItem('sidePanel')
        return saved ? JSON.parse(saved) : DEFAULT_STATE
    } catch {
        return DEFAULT_STATE
    }
}

export default function SidePanel() {
    const [state, setState] = useState(loadState)
    const [inputs, setInputs] = useState({})
    const [editingTitle, setEditingTitle] = useState(null)
    const [titleDraft, setTitleDraft] = useState('')

    useEffect(() => {
        localStorage.setItem('sidePanel', JSON.stringify(state))
    }, [state])

    function toggleCollapse(sectionId) {
        setState(prev => ({
            ...prev,
            sections: prev.sections.map(s =>
                s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s
            )
        }))
    }

    function addItem(sectionId) {
        const text = (inputs[sectionId] || '').trim()
        if (!text) return
        setState(prev => ({
            ...prev,
            sections: prev.sections.map(s =>
                s.id === sectionId
                    ? { ...s, items: [...s.items, { id: Date.now(), text }] }
                    : s
            )
        }))
        setInputs(prev => ({ ...prev, [sectionId]: '' }))
    }

    function deleteItem(sectionId, itemId) {
        setState(prev => ({
            ...prev,
            sections: prev.sections.map(s =>
                s.id === sectionId
                    ? { ...s, items: s.items.filter(i => i.id !== itemId) }
                    : s
            )
        }))
    }

    function startEditTitle(sectionId, currentTitle) {
        setEditingTitle(sectionId)
        setTitleDraft(currentTitle)
    }

    function saveTitle(sectionId) {
        if (titleDraft.trim()) {
            setState(prev => ({
                ...prev,
                sections: prev.sections.map(s =>
                    s.id === sectionId ? { ...s, title: titleDraft.trim() } : s
                )
            }))
        }
        setEditingTitle(null)
    }

    function handleKeyDown(e, sectionId) {
        if (e.key === 'Enter') {
            e.preventDefault()
            addItem(sectionId)
        }
    }

    return (
        <aside className="side-panel">
            {state.sections.map(section => (
                <div key={section.id} className={`side-section ${section.collapsed ? 'collapsed' : ''}`}>
                    <div
                        className="side-section-header"
                        onClick={() => toggleCollapse(section.id)}
                    >
                        {editingTitle === section.id ? (
                            <input
                                className="side-title-input"
                                value={titleDraft}
                                onChange={e => setTitleDraft(e.target.value)}
                                onBlur={() => saveTitle(section.id)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') saveTitle(section.id)
                                    e.stopPropagation()
                                }}
                                onClick={e => e.stopPropagation()}
                                autoFocus
                            />
                        ) : (
                            <span
                                className="side-section-title"
                                onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    startEditTitle(section.id, section.title)
                                }}
                                title="Double-click to rename"
                            >
                                {section.title}
                            </span>
                        )}
                        <span className="side-collapse-icon">
                            {section.collapsed ? '▸' : '▾'}
                        </span>
                    </div>

                    {!section.collapsed && (
                        <div className="side-section-body">
                            <div className="side-items">
                                {section.items.map(item => (
                                    <div key={item.id} className="side-item">
                                        <span className="side-item-text">{item.text}</span>
                                        <button
                                            className="side-item-delete"
                                            onClick={() => deleteItem(section.id, item.id)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {section.items.length === 0 && (
                                    <p className="side-empty">No items yet</p>
                                )}
                            </div>
                            <div className="side-add">
                                <input
                                    type="text"
                                    placeholder="Add item..."
                                    value={inputs[section.id] || ''}
                                    onChange={e => setInputs(prev => ({ ...prev, [section.id]: e.target.value }))}
                                    onKeyDown={e => handleKeyDown(e, section.id)}
                                />
                                <button onClick={() => addItem(section.id)}>+</button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </aside>
    )
}
