import { useEffect, useState } from 'react'

export default function StarBurst({ starsEarned, taskTitle, onDone }) {
    const [phase, setPhase] = useState('enter') // enter → show → exit
    const [particles, setParticles] = useState([])

    useEffect(() => {
        // Generate random star particles
        const p = []
        for (let i = 0; i < 30; i++) {
            p.push({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                size: Math.random() * 20 + 8,
                delay: Math.random() * 0.5,
                duration: Math.random() * 1.5 + 1,
                rotation: Math.random() * 360,
                emoji: i % 5 === 0 ? '✨' : i % 3 === 0 ? '🌟' : '⭐',
            })
        }
        setParticles(p)

        // Phase transitions
        const showTimer = setTimeout(() => setPhase('show'), 100)
        const exitTimer = setTimeout(() => setPhase('exit'), 2200)
        const doneTimer = setTimeout(() => {
            if (onDone) onDone()
        }, 3000)

        return () => {
            clearTimeout(showTimer)
            clearTimeout(exitTimer)
            clearTimeout(doneTimer)
        }
    }, [])

    function formatStars(n) {
        if (n % 1 === 0) return String(n)
        return n.toFixed(1)
    }

    return (
        <div className={`star-burst-overlay ${phase}`}>
            {/* Background particles */}
            {particles.map(p => (
                <span
                    key={p.id}
                    className="star-particle"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        fontSize: `${p.size}px`,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        transform: `rotate(${p.rotation}deg)`,
                    }}
                >
                    {p.emoji}
                </span>
            ))}

            {/* Center content */}
            <div className="star-burst-center">
                <div className="star-burst-big-star">⭐</div>
                <div className="star-burst-count">+{formatStars(starsEarned)}</div>
                <div className="star-burst-label">
                    {starsEarned === 1 ? 'Star Earned!' : 'Stars Earned!'}
                </div>
                <div className="star-burst-task">{taskTitle}</div>
                <div className="star-burst-motivational">
                    {starsEarned >= 2 ? '🔥 Amazing focus!' : starsEarned >= 1 ? '💪 Great job!' : '✨ Nice work!'}
                </div>
            </div>
        </div>
    )
}
