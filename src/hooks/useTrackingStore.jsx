/**
 * Tracking Registry — a simple keyword registry for lifetime time tracking.
 * 
 * NOT a timer system. Just a registry of keywords + accumulated stats.
 * TaskCard timers write to this registry when they stop/pause.
 * 
 * localStorage key: 'tracking_registry'
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const RegistryContext = createContext(null)
const STORAGE_KEY = 'tracking_registry'

function loadRegistry() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    } catch {
        return []
    }
}

function saveRegistry(entries) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch (e) {
        console.error('Failed to save tracking registry:', e)
    }
}

export function TrackingProvider({ children }) {
    const [registry, setRegistry] = useState(() => loadRegistry())

    // Persist on change
    useEffect(() => {
        saveRegistry(registry)
    }, [registry])

    // Add a keyword to the registry
    const addKeyword = useCallback((keyword) => {
        const key = keyword.trim().toLowerCase()
        if (!key) return
        setRegistry(prev => {
            if (prev.some(e => e.keyword === key)) return prev // no duplicates
            return [...prev, {
                id: `reg-${Date.now()}`,
                keyword: key,
                displayName: keyword.trim(),
                lifetimeSeconds: 0,
                sessionCount: 0,
                lastActive: null,
            }]
        })
    }, [])

    // Remove a keyword from the registry
    const removeKeyword = useCallback((id) => {
        setRegistry(prev => prev.filter(e => e.id !== id))
    }, [])

    // Called by TaskCard when a timer stops — accumulates time to matching registry entries
    const accumulateTime = useCallback((taskTitle, elapsedSeconds) => {
        if (elapsedSeconds <= 0) return
        const titleLower = taskTitle.toLowerCase()
        setRegistry(prev => {
            let changed = false
            const updated = prev.map(entry => {
                if (titleLower.includes(entry.keyword)) {
                    changed = true
                    return {
                        ...entry,
                        lifetimeSeconds: entry.lifetimeSeconds + Math.floor(elapsedSeconds),
                        sessionCount: entry.sessionCount + 1,
                        lastActive: Date.now(),
                    }
                }
                return entry
            })
            return changed ? updated : prev
        })
    }, [])

    // Check if a task title matches any registry keyword
    const getMatchingKeywords = useCallback((taskTitle) => {
        const titleLower = taskTitle.toLowerCase()
        return registry.filter(e => titleLower.includes(e.keyword))
    }, [registry])

    const value = {
        registry,
        addKeyword,
        removeKeyword,
        accumulateTime,
        getMatchingKeywords,
    }

    return (
        <RegistryContext.Provider value={value}>
            {children}
        </RegistryContext.Provider>
    )
}

export function useTracking() {
    const ctx = useContext(RegistryContext)
    if (!ctx) throw new Error('useTracking must be used within a TrackingProvider')
    return ctx
}

export default RegistryContext
