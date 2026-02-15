/**
 * Timer module — Stopwatch & Countdown per task.
 * Manages timer state client-side with periodic sync to backend.
 */

const TimerManager = {
    intervals: {},  // taskId -> intervalId

    formatTime(totalSeconds) {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        if (hrs > 0) {
            return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },

    getElapsedSince(startedAt) {
        if (!startedAt) return 0;
        const start = new Date(startedAt).getTime();
        const now = Date.now();
        return Math.max(0, Math.floor((now - start) / 1000));
    },

    getCurrentSeconds(task) {
        let seconds = task.timer_seconds || 0;
        if (task.timer_running && task.timer_started_at) {
            seconds += this.getElapsedSince(task.timer_started_at);
        }
        return seconds;
    },

    getDisplaySeconds(task) {
        const current = this.getCurrentSeconds(task);
        if (task.timer_type === 'countdown' && task.estimated_time) {
            const total = task.estimated_time * 60;
            return Math.max(0, total - current);
        }
        return current;
    },

    isCountdownDone(task) {
        if (task.timer_type !== 'countdown' || !task.estimated_time) return false;
        return this.getCurrentSeconds(task) >= task.estimated_time * 60;
    },

    startTicking(taskId, task) {
        if (this.intervals[taskId]) return;

        this.intervals[taskId] = setInterval(() => {
            const display = document.querySelector(`[data-timer-id="${taskId}"] .timer-display`);
            if (!display) {
                this.stopTicking(taskId);
                return;
            }

            const seconds = this.getDisplaySeconds(task);
            display.textContent = this.formatTime(seconds);

            // Check countdown completion
            if (this.isCountdownDone(task)) {
                display.classList.add('countdown-done');
                this.stopTicking(taskId);
                // Play a subtle notification
                if (Notification.permission === 'granted') {
                    new Notification('Timer Done!', { body: task.title });
                }
            }
        }, 1000);
    },

    stopTicking(taskId) {
        if (this.intervals[taskId]) {
            clearInterval(this.intervals[taskId]);
            delete this.intervals[taskId];
        }
    },

    async toggle(taskId, task) {
        const isRunning = task.timer_running;

        if (isRunning) {
            // Pause: accumulate elapsed time
            const elapsed = this.getElapsedSince(task.timer_started_at);
            const newSeconds = (task.timer_seconds || 0) + elapsed;

            await API.updateTask(taskId, {
                timer_running: 0,
                timer_seconds: newSeconds,
                timer_started_at: null
            });
            this.stopTicking(taskId);
        } else {
            // Start
            await API.updateTask(taskId, {
                timer_running: 1,
                timer_started_at: new Date().toISOString()
            });
        }
    },

    async reset(taskId) {
        await API.updateTask(taskId, {
            timer_running: 0,
            timer_seconds: 0,
            timer_started_at: null
        });
        this.stopTicking(taskId);
    },

    stopAll() {
        Object.keys(this.intervals).forEach(id => this.stopTicking(id));
    }
};
