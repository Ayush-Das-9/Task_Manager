import { useEffect, useState } from 'react'

export default function StarCounter({ totalStars, isAnimating }) {
    const [displayStars, setDisplayStars] = useState(totalStars)
    const [bouncing, setBouncing] = useState(false)

    useEffect(() => {
        if (totalStars !== displayStars) {
            setBouncing(true)
            // Animate number counting up
            const diff = totalStars - displayStars
            const steps = Math.max(1, Math.ceil(Math.abs(diff) * 2))
            const stepSize = diff / steps
            let current = displayStars
            let step = 0

            const interval = setInterval(() => {
                step++
                current += stepSize
                if (step >= steps) {
                    setDisplayStars(totalStars)
                    clearInterval(interval)
                    setTimeout(() => setBouncing(false), 600)
                } else {
                    setDisplayStars(Math.round(current * 10) / 10)
                }
            }, 80)

            return () => clearInterval(interval)
        }
    }, [totalStars])

    function formatStars(n) {
        if (n === 0) return '0'
        if (n % 1 === 0) return String(n)
        return n.toFixed(1)
    }

    return (
        <div className={`star-counter ${bouncing ? 'star-counter-bounce' : ''} ${isAnimating ? 'star-counter-glow' : ''}`}>
            <span className="star-counter-icon">⭐</span>
            <span className="star-counter-value">{formatStars(displayStars)}</span>
            <span className="star-counter-label">today</span>
        </div>
    )
}
