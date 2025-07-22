class PomodoroBackground {
    constructor() {
        this.isRunning = false;
        this.timeLeft = 0;
        this.mode = 'focus';
        this.sessionCount = 0;
        this.settings = {
            focusTime: 25,
            shortBreak: 5,
            longBreak: 15,
            sessionsUntilLongBreak: 4,
            soundEnabled: true,
            selectedSound: 'bell'
        };
        this.stats = {
            totalSessions: 0,
            totalFocusTime: 0,
            dailyCount: 0,
            currentStreak: 0,
            lastSessionDate: null
        };
        
        this.loadData().then(() => {
            this.setupListeners();
            this.restoreTimerState();
        });
    }

    async loadData() {
        try {
            const result = await chrome.storage.local.get([
                'pomodoro-settings',
                'pomodoro-session', 
                'pomodoro-stats'
            ]);
            
            if (result['pomodoro-settings']) {
                this.settings = { ...this.settings, ...result['pomodoro-settings'] };
            }
            
            if (result['pomodoro-session']) {
                const session = result['pomodoro-session'];
                this.timeLeft = session.timeLeft || 0;
                this.isRunning = session.isRunning || false;
                this.mode = session.mode || 'focus';
                this.sessionCount = session.sessionCount || 0;
            }
            
            if (result['pomodoro-stats']) {
                this.stats = { ...this.stats, ...result['pomodoro-stats'] };
            }

            this.checkNewDay();
        } catch (error) {
            console.error('Error loading background data:', error);
        }
    }

    async saveData() {
        try {
            const sessionData = {
                timeLeft: this.timeLeft,
                isRunning: this.isRunning,
                mode: this.mode,
                sessionCount: this.sessionCount
            };

            await chrome.storage.local.set({
                'pomodoro-settings': this.settings,
                'pomodoro-session': sessionData,
                'pomodoro-stats': this.stats
            });
        } catch (error) {
            console.error('Error saving background data:', error);
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

    setupListeners() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep channel open for async responses
        });

        // Handle alarms for timer countdown
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'pomodoroTimer') {
                this.handleTimerTick();
            }
        });

        // Handle extension startup/install
        chrome.runtime.onStartup.addListener(() => {
            this.restoreTimerState();
        });

        chrome.runtime.onInstalled.addListener(() => {
            this.restoreTimerState();
        });
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'getTimerState':
                sendResponse({
                    timeLeft: this.timeLeft,
                    isRunning: this.isRunning,
                    mode: this.mode,
                    sessionCount: this.sessionCount,
                    settings: this.settings,
                    stats: this.stats
                });
                break;
                
            case 'startTimer':
                await this.startTimer(message.data);
                sendResponse({ success: true });
                break;
                
            case 'pauseTimer':
                await this.pauseTimer();
                sendResponse({ success: true });
                break;
                
            case 'resetTimer':
                await this.resetTimer();
                sendResponse({ success: true });
                break;
                
            case 'skipSession':
                await this.completeSession();
                sendResponse({ success: true });
                break;
                
            case 'updateSettings':
                this.settings = { ...this.settings, ...message.data };
                await this.saveData();
                sendResponse({ success: true });
                break;
                
            case 'updateStats':
                this.stats = { ...this.stats, ...message.data };
                await this.saveData();
                sendResponse({ success: true });
                break;
                
            case 'showNotification':
                this.showNotification(message.data.message);
                sendResponse({ success: true });
                break;
        }
    }

    async startTimer(sessionData = null) {
        if (sessionData) {
            this.timeLeft = sessionData.timeLeft;
            this.mode = sessionData.mode;
            this.sessionCount = sessionData.sessionCount || this.sessionCount;
        }

        this.isRunning = true;
        
        // Create repeating alarm every second
        await chrome.alarms.clear('pomodoroTimer');
        await chrome.alarms.create('pomodoroTimer', {
            delayInMinutes: 1/60, // 1 second
            periodInMinutes: 1/60 // Repeat every second
        });

        await this.saveData();
        this.updateBadge();
    }

    async pauseTimer() {
        this.isRunning = false;
        await chrome.alarms.clear('pomodoroTimer');
        await this.saveData();
        this.updateBadge();
    }

    async resetTimer() {
        this.isRunning = false;
        await chrome.alarms.clear('pomodoroTimer');
        
        switch (this.mode) {
            case 'focus':
                this.timeLeft = this.settings.focusTime * 60;
                break;
            case 'shortBreak':
                this.timeLeft = this.settings.shortBreak * 60;
                break;
            case 'longBreak':
                this.timeLeft = this.settings.longBreak * 60;
                break;
        }
        
        await this.saveData();
        this.updateBadge();
    }

    async handleTimerTick() {
        if (!this.isRunning) return;

        this.timeLeft = Math.max(0, this.timeLeft - 1);
        await this.saveData();
        this.updateBadge();

        // Broadcast timer update to any open popups
        this.broadcastTimerUpdate();

        if (this.timeLeft <= 0) {
            await this.completeSession();
        }
    }

    async completeSession() {
        this.isRunning = false;
        await chrome.alarms.clear('pomodoroTimer');

        // Update stats and determine next session
        if (this.mode === 'focus') {
            this.stats.totalSessions++;
            this.stats.dailyCount++;
            this.stats.totalFocusTime += this.settings.focusTime;
            this.sessionCount++;
            
            // Determine next break type
            if (this.sessionCount % this.settings.sessionsUntilLongBreak === 0) {
                this.startBreak('longBreak');
            } else {
                this.startBreak('shortBreak');
            }
        } else {
            // Break completed, start focus session
            this.startFocus();
        }

        // Show completion notification
        const message = this.mode === 'focus' 
            ? 'Great work! Time for a break.' 
            : 'Break time is over. Ready to focus?';
        this.showNotification(message);

        await this.saveData();
        this.updateBadge();
        this.broadcastTimerUpdate();
    }

    startFocus() {
        this.mode = 'focus';
        this.timeLeft = this.settings.focusTime * 60;
    }

    startBreak(type) {
        this.mode = type;
        this.timeLeft = (type === 'longBreak' ? this.settings.longBreak : this.settings.shortBreak) * 60;
    }

    updateBadge() {
        if (this.isRunning && this.timeLeft > 0) {
            const minutes = Math.floor(this.timeLeft / 60);
            chrome.action.setBadgeText({ text: minutes.toString() });
            
            const colors = {
                'focus': '#06d6a0',
                'shortBreak': '#ffd166',
                'longBreak': '#f72585'
            };
            chrome.action.setBadgeBackgroundColor({ 
                color: colors[this.mode] || '#06d6a0'
            });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    }

    showNotification(message) {
        if (this.settings.soundEnabled) {
            // Note: Sound generation would need to be handled in popup
        }
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/icon48.png',
            title: 'FocusFlow',
            message: message,
            priority: 2
        });
    }

    broadcastTimerUpdate() {
        // Send message to popup if it's open
        chrome.runtime.sendMessage({
            action: 'timerUpdate',
            data: {
                timeLeft: this.timeLeft,
                isRunning: this.isRunning,
                mode: this.mode,
                sessionCount: this.sessionCount,
                stats: this.stats
            }
        }).catch(() => {
            // Popup is closed, ignore error
        });
    }

    async restoreTimerState() {
        await this.loadData();
        
        if (this.isRunning && this.timeLeft > 0) {
            // Resume timer if it was running
            await this.startTimer();
        } else if (this.timeLeft <= 0 && this.isRunning) {
            // Complete session if time expired while extension was inactive
            await this.completeSession();
        }
        
        this.updateBadge();
    }
}

// Initialize background script
const pomodoroBackground = new PomodoroBackground();
