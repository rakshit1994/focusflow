class PomodoroTimer {
    constructor() {
        this.tasks = [];
        this.backgroundReady = false;
        
        this.init();
    }

    async init() {
        await this.syncWithBackground();
        this.setupEventListeners();
        this.renderUI();
        this.updateDisplay();
        
        // Set up periodic sync with background
        setInterval(() => {
            this.syncWithBackground();
        }, 1000);
    }

    async syncWithBackground() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTimerState' });
            
            this.currentSession = {
                timeLeft: response.timeLeft,
                isRunning: response.isRunning,
                mode: response.mode,
                sessionCount: response.sessionCount
            };
            
            this.settings = response.settings;
            this.stats = response.stats;
            this.backgroundReady = true;
            
            // Update display if popup is open
            if (document.getElementById('timeDisplay')) {
                this.updateDisplay();
                this.updateStats();
            }
        } catch (error) {
            console.error('Error syncing with background:', error);
        }
    }

    async loadTasks() {
        try {
            const result = await chrome.storage.local.get('pomodoro-tasks');
            if (result['pomodoro-tasks']) {
                this.tasks = result['pomodoro-tasks'];
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    async saveTasks() {
        try {
            await chrome.storage.local.set({ 'pomodoro-tasks': this.tasks });
        } catch (error) {
            console.error('Error saving tasks:', error);
        }
    }

    setupEventListeners() {
        // Timer control buttons
        document.getElementById('playPauseBtn')?.addEventListener('click', () => {
            this.toggleTimer();
        });

        document.getElementById('resetBtn')?.addEventListener('click', () => {
            this.resetTimer();
        });

        document.getElementById('skipBtn')?.addEventListener('click', () => {
            this.skipSession();
        });

        // Settings buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.updateFocusTime(parseInt(e.target.dataset.time));
            });
        });

        document.querySelectorAll('.break-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.updateBreakTime(parseInt(e.target.dataset.time));
            });
        });

        // Task management
        document.getElementById('addTaskBtn')?.addEventListener('click', () => {
            this.toggleTaskInput();
        });

        document.getElementById('saveTaskBtn')?.addEventListener('click', () => {
            this.addTask();
        });

        document.getElementById('newTaskInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        // Task list event delegation
        document.getElementById('tasksList')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('task-checkbox')) {
                const taskId = parseInt(e.target.dataset.taskId);
                this.toggleTask(taskId);
            } else if (e.target.classList.contains('task-delete')) {
                const taskId = parseInt(e.target.dataset.taskId);
                this.deleteTask(taskId);
            }
        });

        // Sound selection
        document.getElementById('soundSelect')?.addEventListener('change', (e) => {
            this.updateSoundSetting(e.target.value);
        });

        // Listen for background timer updates
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'timerUpdate') {
                this.handleBackgroundUpdate(message.data);
            }
        });
    }

    handleBackgroundUpdate(data) {
        this.currentSession = {
            timeLeft: data.timeLeft,
            isRunning: data.isRunning,
            mode: data.mode,
            sessionCount: data.sessionCount
        };
        
        this.stats = data.stats;
        this.updateDisplay();
        this.updateStats();
    }

    async toggleTimer() {
        if (!this.backgroundReady) {
            await this.syncWithBackground();
        }

        if (this.currentSession.isRunning) {
            await chrome.runtime.sendMessage({ action: 'pauseTimer' });
        } else {
            await chrome.runtime.sendMessage({ 
                action: 'startTimer', 
                data: this.currentSession 
            });
        }
        
        // Update display immediately for better UX
        this.currentSession.isRunning = !this.currentSession.isRunning;
        this.updatePlayPauseButton();
    }

    async resetTimer() {
        await chrome.runtime.sendMessage({ action: 'resetTimer' });
        await this.syncWithBackground();
    }

    async skipSession() {
        await chrome.runtime.sendMessage({ action: 'skipSession' });
        await this.syncWithBackground();
    }

    async updateFocusTime(minutes) {
        const updatedSettings = { ...this.settings, focusTime: minutes };
        await chrome.runtime.sendMessage({ 
            action: 'updateSettings', 
            data: updatedSettings 
        });
        
        this.settings = updatedSettings;
        
        // Update active button
        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-time="${minutes}"]`)?.classList.add('active');
        
        // Reset timer if in focus mode and not running
        if (this.currentSession.mode === 'focus' && !this.currentSession.isRunning) {
            await this.resetTimer();
        }
    }

    async updateBreakTime(minutes) {
        const updatedSettings = { ...this.settings, shortBreak: minutes };
        await chrome.runtime.sendMessage({ 
            action: 'updateSettings', 
            data: updatedSettings 
        });
        
        this.settings = updatedSettings;
        
        // Update active button
        document.querySelectorAll('.break-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.break-btn[data-time="${minutes}"]`)?.classList.add('active');
    }

    async updateSoundSetting(soundType) {
        const updatedSettings = { ...this.settings, selectedSound: soundType };
        await chrome.runtime.sendMessage({ 
            action: 'updateSettings', 
            data: updatedSettings 
        });
        
        this.settings = updatedSettings;
    }

    updateDisplay() {
        if (!this.currentSession) return;

        const minutes = Math.floor(this.currentSession.timeLeft / 60);
        const seconds = this.currentSession.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timeElement = document.getElementById('timeDisplay');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
        
        // Update mode display
        const modeText = {
            'focus': 'Focus Time',
            'shortBreak': 'Short Break',
            'longBreak': 'Long Break'
        };
        
        const modeElement = document.getElementById('modeDisplay');
        if (modeElement) {
            modeElement.textContent = modeText[this.currentSession.mode];
        }
        
        // Update progress ring
        this.updateProgressRing();
        
        // Update play/pause button
        this.updatePlayPauseButton();
        
        // Update timer circle animation
        const timerCircle = document.querySelector('.timer-circle');
        if (timerCircle) {
            if (this.currentSession.isRunning) {
                timerCircle.classList.add('active');
            } else {
                timerCircle.classList.remove('active');
            }
        }
    }

    updateProgressRing() {
        if (!this.currentSession || !this.settings) return;

        const totalTime = this.getTotalTimeForMode();
        const progress = 1 - (this.currentSession.timeLeft / totalTime);
        const circumference = 2 * Math.PI * 70;
        const offset = circumference * (1 - progress);
        
        const progressRing = document.querySelector('.progress-ring-progress');
        if (progressRing) {
            progressRing.style.strokeDashoffset = offset;
            
            // Update ring color based on mode
            const colors = {
                'focus': '#06d6a0',
                'shortBreak': '#ffd166',
                'longBreak': '#f72585'
            };
            progressRing.style.stroke = colors[this.currentSession.mode];
        }
    }

    updatePlayPauseButton() {
        const playPauseIcon = document.getElementById('playPauseIcon');
        if (playPauseIcon) {
            playPauseIcon.textContent = this.currentSession.isRunning ? '⏸' : '▶';
        }
    }

    getTotalTimeForMode() {
        if (!this.settings) return 1500; // Default 25 minutes

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
        if (!this.stats) return;

        const dailyElement = document.getElementById('dailyCount');
        const totalElement = document.getElementById('totalPomodoros');
        const timeElement = document.getElementById('totalTime');
        const streakElement = document.getElementById('currentStreak');

        if (dailyElement) dailyElement.textContent = this.stats.dailyCount;
        if (totalElement) totalElement.textContent = this.stats.totalSessions;
        if (timeElement) timeElement.textContent = `${Math.floor(this.stats.totalFocusTime / 60)}h`;
        if (streakElement) streakElement.textContent = this.stats.currentStreak;
    }

    // Task Management Methods
    toggleTaskInput() {
        const taskInput = document.getElementById('taskInput');
        if (taskInput) {
            const isVisible = taskInput.style.display !== 'none';
            taskInput.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                document.getElementById('newTaskInput')?.focus();
            }
        }
    }

    async addTask() {
        const input = document.getElementById('newTaskInput');
        const text = input?.value.trim();
        
        if (text) {
            const task = {
                id: Date.now(),
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            };
            
            this.tasks.unshift(task);
            await this.saveTasks();
            this.renderTasks();
            
            input.value = '';
            document.getElementById('taskInput').style.display = 'none';
        }
    }

    async toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            await this.saveTasks();
            this.renderTasks();
        }
    }

    async deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        await this.saveTasks();
        this.renderTasks();
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;

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

    // Sound generation (runs in popup context)
    playNotificationSound() {
        if (!this.settings?.soundEnabled) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            switch(this.settings.selectedSound) {
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
        const frequencies = [523.25, 659.25, 783.99];
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

    async renderUI() {
        await this.loadTasks();
        
        if (!this.settings) await this.syncWithBackground();
        
        // Set initial button states
        document.querySelector(`[data-time="${this.settings?.focusTime || 25}"]`)?.classList.add('active');
        document.querySelector(`.break-btn[data-time="${this.settings?.shortBreak || 5}"]`)?.classList.add('active');
        
        const soundSelect = document.getElementById('soundSelect');
        if (soundSelect) {
            soundSelect.value = this.settings?.selectedSound || 'bell';
        }
        
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
