class PomodoroTimer {
    constructor() {
        this.defaultSettings = {
            focusTime: 25,
            shortBreak: 5,
            longBreak: 15,
            sessionsUntilLongBreak: 4,
            soundEnabled: true,
            selectedSound: 'bell'
        };

        this.currentSession = {
            timeLeft: 25 * 60, // seconds
            isRunning: false,
            mode: 'focus', // 'focus', 'shortBreak', 'longBreak'
            sessionCount: 0,
            currentTask: null
        };

        this.stats = {
            totalSessions: 0,
            totalFocusTime: 0,
            dailyCount: 0,
            currentStreak: 0,
            lastSessionDate: null
        };

        this.tasks = [];
        this.timer = null;

        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderUI();
        this.updateDisplay();
    }

    async loadData() {
        try {
            // Load settings
            const savedSettings = localStorage.getItem('pomodoro-settings');
            if (savedSettings) {
                this.settings = { ...this.defaultSettings, ...JSON.parse(savedSettings) };
            } else {
                this.settings = { ...this.defaultSettings };
            }

            // Load current session
            const savedSession = localStorage.getItem('pomodoro-session');
            if (savedSession) {
                this.currentSession = { ...this.currentSession, ...JSON.parse(savedSession) };
            }

            // Load stats
            const savedStats = localStorage.getItem('pomodoro-stats');
            if (savedStats) {
                this.stats = { ...this.stats, ...JSON.parse(savedStats) };
            }

            // Load tasks
            const savedTasks = localStorage.getItem('pomodoro-tasks');
            if (savedTasks) {
                this.tasks = JSON.parse(savedTasks);
            }

            // Check if it's a new day
            this.checkNewDay();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    saveData() {
        try {
            localStorage.setItem('pomodoro-settings', JSON.stringify(this.settings));
            localStorage.setItem('pomodoro-session', JSON.stringify(this.currentSession));
            localStorage.setItem('pomodoro-stats', JSON.stringify(this.stats));
            localStorage.setItem('pomodoro-tasks', JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    checkNewDay() {
        const today = new Date().toDateString();
        const lastDate = this.stats.lastSessionDate;
        
        if (lastDate !== today) {
            this.stats.dailyCount = 0;
            this.stats.lastSessionDate = today;
            this.saveData();
        }
    }

    setupEventListeners() {
        // Play/Pause button
        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.toggleTimer();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetTimer();
        });

        // Skip button
        document.getElementById('skipBtn').addEventListener('click', () => {
            this.skipSession();
        });

        // Time selection buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.settings.focusTime = parseInt(e.target.dataset.time);
                if (this.currentSession.mode === 'focus' && !this.currentSession.isRunning) {
                    this.currentSession.timeLeft = this.settings.focusTime * 60;
                    this.updateDisplay();
                }
                this.saveData();
            });
        });

        // Break time selection buttons
        document.querySelectorAll('.break-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.break-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.settings.shortBreak = parseInt(e.target.dataset.time);
                this.saveData();
            });
        });

        // Task management
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.toggleTaskInput();
        });

        document.getElementById('saveTaskBtn').addEventListener('click', () => {
            this.addTask();
        });

        document.getElementById('newTaskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        // Task list event delegation
        document.getElementById('tasksList').addEventListener('click', (e) => {
            if (e.target.classList.contains('task-checkbox')) {
                const taskId = parseInt(e.target.dataset.taskId);
                this.toggleTask(taskId);
            } else if (e.target.classList.contains('task-delete')) {
                const taskId = parseInt(e.target.dataset.taskId);
                this.deleteTask(taskId);
            }
        });

        // Sound selection
        document.getElementById('soundSelect').addEventListener('change', (e) => {
            this.settings.selectedSound = e.target.value;
            this.saveData();
        });
    }

    toggleTimer() {
        if (this.currentSession.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        this.currentSession.isRunning = true;
        document.getElementById('playPauseIcon').textContent = '⏸';
        document.querySelector('.timer-circle').classList.add('active');
        
        this.timer = setInterval(() => {
            this.currentSession.timeLeft--;
            this.updateDisplay();
            this.saveData();
            
            if (this.currentSession.timeLeft <= 0) {
                this.completeSession();
            }
        }, 1000);

        this.saveData();
        this.sendMessageToBackground({ action: 'startTimer', data: this.currentSession });
    }

    pauseTimer() {
        this.currentSession.isRunning = false;
        document.getElementById('playPauseIcon').textContent = '▶';
        document.querySelector('.timer-circle').classList.remove('active');
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.saveData();
        this.sendMessageToBackground({ action: 'pauseTimer' });
    }

    resetTimer() {
        this.pauseTimer();
        
        switch (this.currentSession.mode) {
            case 'focus':
                this.currentSession.timeLeft = this.settings.focusTime * 60;
                break;
            case 'shortBreak':
                this.currentSession.timeLeft = this.settings.shortBreak * 60;
                break;
            case 'longBreak':
                this.currentSession.timeLeft = this.settings.longBreak * 60;
                break;
        }
        
        this.updateDisplay();
        this.saveData();
    }

    skipSession() {
        this.completeSession();
    }

    completeSession() {
        this.pauseTimer();
        this.playNotificationSound();
        
        if (this.currentSession.mode === 'focus') {
            this.stats.totalSessions++;
            this.stats.dailyCount++;
            this.stats.totalFocusTime += this.settings.focusTime;
            this.currentSession.sessionCount++;
            
            // Determine next break type
            if (this.currentSession.sessionCount % this.settings.sessionsUntilLongBreak === 0) {
                this.startBreak('longBreak');
            } else {
                this.startBreak('shortBreak');
            }
        } else {
            // Break completed, start focus session
            this.startFocus();
        }
        
        this.updateStats();
        this.saveData();
        this.sendNotification();
    }

    startFocus() {
        this.currentSession.mode = 'focus';
        this.currentSession.timeLeft = this.settings.focusTime * 60;
        this.updateDisplay();
    }

    startBreak(type) {
        this.currentSession.mode = type;
        this.currentSession.timeLeft = (type === 'longBreak' ? this.settings.longBreak : this.settings.shortBreak) * 60;
        this.updateDisplay();
    }

    updateDisplay() {
        const minutes = Math.floor(this.currentSession.timeLeft / 60);
        const seconds = this.currentSession.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timeDisplay').textContent = timeString;
        
        // Update mode display
        const modeText = {
            'focus': 'Focus Time',
            'shortBreak': 'Short Break',
            'longBreak': 'Long Break'
        };
        document.getElementById('modeDisplay').textContent = modeText[this.currentSession.mode];
        
        // Update progress ring
        const totalTime = this.getTotalTimeForMode();
        const progress = 1 - (this.currentSession.timeLeft / totalTime);
        const circumference = 2 * Math.PI * 70; // Updated for new radius
        const offset = circumference * (1 - progress);
        
        document.querySelector('.progress-ring-progress').style.strokeDashoffset = offset;
        
        // Update ring color based on mode
        const colors = {
            'focus': '#06d6a0',
            'shortBreak': '#ffd166',
            'longBreak': '#f72585'
        };
        document.querySelector('.progress-ring-progress').style.stroke = colors[this.currentSession.mode];
    }

    getTotalTimeForMode() {
        switch (this.currentSession.mode) {
            case 'focus':
                return this.settings.focusTime * 60;
            case 'shortBreak':
                return this.settings.shortBreak * 60;
            case 'longBreak':
                return this.settings.longBreak * 60;
            default:
                return this.settings.focusTime * 60;
        }
    }

    updateStats() {
        document.getElementById('dailyCount').textContent = this.stats.dailyCount;
        document.getElementById('totalPomodoros').textContent = this.stats.totalSessions;
        document.getElementById('totalTime').textContent = `${Math.floor(this.stats.totalFocusTime / 60)}h`;
        document.getElementById('currentStreak').textContent = this.stats.currentStreak;
    }

    // Task Management
    toggleTaskInput() {
        const taskInput = document.getElementById('taskInput');
        const isVisible = taskInput.style.display !== 'none';
        
        taskInput.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            document.getElementById('newTaskInput').focus();
        }
    }

    addTask() {
        const input = document.getElementById('newTaskInput');
        const text = input.value.trim();
        
        if (text) {
            const task = {
                id: Date.now(),
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            };
            
            this.tasks.unshift(task);
            this.renderTasks();
            this.saveData();
            
            input.value = '';
            document.getElementById('taskInput').style.display = 'none';
        }
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        tasksList.innerHTML = '';
        
        this.tasks.slice(0, 5).forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-item';
            taskElement.innerHTML = `
                <div class="task-checkbox ${task.completed ? 'completed' : ''}" 
                     data-task-id="${task.id}">
                    ${task.completed ? '✓' : ''}
                </div>
                <div class="task-text ${task.completed ? 'completed' : ''}">${task.text}</div>
                <div class="task-delete" data-task-id="${task.id}">×</div>
            `;
            tasksList.appendChild(taskElement);
        });
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.renderTasks();
            this.saveData();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.renderTasks();
        this.saveData();
    }

    // Notification and Sound
    playNotificationSound() {
        if (this.settings.soundEnabled) {
            this.generateSound(this.settings.selectedSound);
        }
    }

    generateSound(soundType) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            switch(soundType) {
                case 'bell':
                    this.playBellSound(audioContext);
                    break;
                case 'chime':
                    this.playChimeSound(audioContext);
                    break;
                case 'digital':
                    this.playDigitalSound(audioContext);
                    break;
                case 'nature':
                    this.playNatureSound(audioContext);
                    break;
                default:
                    this.playBellSound(audioContext);
            }
        } catch (e) {
            console.log('Could not play sound:', e);
        }
    }

    playBellSound(audioContext) {
        // Create a bell-like sound with multiple frequencies
        const frequencies = [800, 1000, 1200];
        const duration = 1.5;
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            
            const startTime = audioContext.currentTime + (index * 0.1);
            const endTime = startTime + duration;
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
            
            oscillator.start(startTime);
            oscillator.stop(endTime);
        });
    }

    playChimeSound(audioContext) {
        // Create a soft chime sound
        const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
        const duration = 2;
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = freq;
            oscillator.type = 'triangle';
            
            const startTime = audioContext.currentTime + (index * 0.3);
            const endTime = startTime + duration;
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.2);
            gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
            
            oscillator.start(startTime);
            oscillator.stop(endTime);
        });
    }

    playDigitalSound(audioContext) {
        // Create a digital beep sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880;
        oscillator.type = 'square';
        
        const duration = 0.3;
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + duration - 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
        
        // Add a second beep
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            
            osc2.frequency.value = 880;
            osc2.type = 'square';
            
            gain2.gain.setValueAtTime(0, audioContext.currentTime);
            gain2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
            gain2.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
            
            osc2.start(audioContext.currentTime);
            osc2.stop(audioContext.currentTime + duration);
        }, 400);
    }

    playNatureSound(audioContext) {
        // Create a nature-inspired sound (like a bird chirp)
        const duration = 1.2;
        
        // First chirp
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, audioContext.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
        
        gain1.gain.setValueAtTime(0, audioContext.currentTime);
        gain1.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        osc1.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.3);
        
        // Second chirp
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1000, audioContext.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(1400, audioContext.currentTime + 0.2);
            osc2.frequency.exponentialRampToValueAtTime(900, audioContext.currentTime + 0.4);
            
            gain2.gain.setValueAtTime(0, audioContext.currentTime);
            gain2.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            osc2.start(audioContext.currentTime);
            osc2.stop(audioContext.currentTime + 0.4);
        }, 600);
    }

    sendNotification() {
        const message = this.currentSession.mode === 'focus' 
            ? 'Great work! Time for a break.' 
            : 'Break time is over. Ready to focus?';
            
        this.sendMessageToBackground({
            action: 'showNotification',
            data: { message }
        });
    }

    sendMessageToBackground(message) {
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage(message).catch(console.error);
        }
    }

    renderUI() {
        // Set initial button states
        document.querySelector(`[data-time="${this.settings.focusTime}"]`)?.classList.add('active');
        document.querySelector(`.break-btn[data-time="${this.settings.shortBreak}"]`)?.classList.add('active');
        document.getElementById('soundSelect').value = this.settings.selectedSound;
        
        // Render components
        this.renderTasks();
        this.updateStats();
    }
}

// Initialize the timer when popup opens
let timer;
document.addEventListener('DOMContentLoaded', () => {
    timer = new PomodoroTimer();
});
