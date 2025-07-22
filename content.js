class PomodoroOverlay {
    constructor() {
        this.overlay = null;
        this.isVisible = false;
        this.timeLeft = 0;
        this.isRunning = false;
        this.mode = 'focus';
        
        this.init();
        this.setupMessageListener();
    }

    init() {
        this.createOverlay();
        this.loadStoredState();
    }

    createOverlay() {
        // Check if overlay already exists
        if (document.getElementById('pomodoro-overlay')) {
            return;
        }

        this.overlay = document.createElement('div');
        this.overlay.id = 'pomodoro-overlay';
        this.overlay.innerHTML = `
            <div class="pomodoro-widget">
                <div class="pomodoro-time" id="pomodoro-time">25:00</div>
                <div class="pomodoro-status" id="pomodoro-status">Ready</div>
                <div class="pomodoro-controls">
                    <button class="pomodoro-btn" id="pomodoro-toggle" title="Play/Pause">▶</button>
                    <button class="pomodoro-btn" id="pomodoro-close" title="Close">×</button>
                </div>
            </div>
        `;
        
        // Add click handlers
        this.overlay.querySelector('#pomodoro-toggle').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleTimer();
        });
        
        this.overlay.querySelector('#pomodoro-close').addEventListener('click', (e) => {
            e.preventDefault();
            this.hideOverlay();
        });
        
        // Make draggable
        this.makeDraggable();
        
        document.body.appendChild(this.overlay);
    }

    makeDraggable() {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const widget = this.overlay.querySelector('.pomodoro-widget');

        widget.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                isDragging = true;
                widget.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                widget.style.cursor = 'grab';
                this.savePosition(xOffset, yOffset);
            }
        });

        widget.style.cursor = 'grab';
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'updateTimer') {
                this.updateTimer(message.data);
            }
        });
    }

    loadStoredState() {
        try {
            const saved = localStorage.getItem('pomodoro-overlay-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.isVisible = state.isVisible;
                this.timeLeft = state.timeLeft || 1500;
                this.isRunning = state.isRunning || false;
                this.mode = state.mode || 'focus';
                
                if (this.isVisible) {
                    this.showOverlay();
                }
                
                // Restore position
                if (state.position) {
                    const widget = this.overlay.querySelector('.pomodoro-widget');
                    widget.style.transform = `translate(${state.position.x}px, ${state.position.y}px)`;
                }
                
                this.updateDisplay();
            }
        } catch (error) {
            console.error('Error loading overlay state:', error);
        }
    }

    saveState() {
        try {
            const widget = this.overlay.querySelector('.pomodoro-widget');
            const transform = widget.style.transform;
            let position = { x: 0, y: 0 };
            
            if (transform) {
                const matches = transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
                if (matches) {
                    position.x = parseFloat(matches[1]);
                    position.y = parseFloat(matches[2]);
                }
            }

            localStorage.setItem('pomodoro-overlay-state', JSON.stringify({
                isVisible: this.isVisible,
                timeLeft: this.timeLeft,
                isRunning: this.isRunning,
                mode: this.mode,
                position: position
            }));
        } catch (error) {
            console.error('Error saving overlay state:', error);
        }
    }

    savePosition(x, y) {
        try {
            const saved = localStorage.getItem('pomodoro-overlay-state');
            const state = saved ? JSON.parse(saved) : {};
            state.position = { x, y };
            localStorage.setItem('pomodoro-overlay-state', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving position:', error);
        }
    }

    showOverlay() {
        this.isVisible = true;
        this.overlay.style.display = 'block';
        this.saveState();
    }

    hideOverlay() {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.saveState();
    }

    updateTimer(data) {
        this.timeLeft = data.timeLeft;
        this.isRunning = data.isRunning;
        this.mode = data.mode || 'focus';
        this.updateDisplay();
        
        if (this.isRunning && !this.isVisible) {
            this.showOverlay();
        }
        
        this.saveState();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timeElement = this.overlay.querySelector('#pomodoro-time');
        const statusElement = this.overlay.querySelector('#pomodoro-status');
        const toggleButton = this.overlay.querySelector('#pomodoro-toggle');
        
        if (timeElement) timeElement.textContent = timeString;
        if (statusElement) {
            const statusText = {
                'focus': this.isRunning ? 'Focusing' : 'Focus Ready',
                'shortBreak': this.isRunning ? 'Short Break' : 'Break Ready',
                'longBreak': this.isRunning ? 'Long Break' : 'Break Ready'
            };
            statusElement.textContent = statusText[this.mode] || 'Ready';
        }
        if (toggleButton) toggleButton.textContent = this.isRunning ? '⏸' : '▶';
        
        // Update widget style based on mode and state
        const widget = this.overlay.querySelector('.pomodoro-widget');
        if (this.isRunning) {
            widget.classList.add('running');
        } else {
            widget.classList.remove('running');
        }

        // Update color based on mode
        widget.setAttribute('data-mode', this.mode);
    }

    toggleTimer() {
        // Send message to background to toggle timer
        chrome.runtime.sendMessage({
            action: this.isRunning ? 'pauseTimer' : 'resumeTimer'
        }).catch(() => {
            // Fallback: just update visual state
            this.isRunning = !this.isRunning;
            this.updateDisplay();
        });
    }
}

// Initialize overlay when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PomodoroOverlay();
    });
} else {
    new PomodoroOverlay();
}
