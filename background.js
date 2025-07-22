class PomodoroBackground {
    constructor() {
        this.isRunning = false;
        this.timeLeft = 0;
        this.blockerEnabled = false;
        this.blockedSites = [];
        this.mode = 'focus';
        
        this.setupListeners();
    }

    setupListeners() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'startTimer':
                    this.startTimer(message.data);
                    break;
                case 'pauseTimer':
                    this.pauseTimer();
                    break;
                case 'updateBlocker':
                    this.updateBlocker(message.data);
                    break;
                case 'showNotification':
                    this.showNotification(message.data.message);
                    break;
            }
            return true;
        });

        // Handle tab updates for content script injection
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && this.isRunning) {
                chrome.tabs.sendMessage(tabId, {
                    action: 'updateTimer',
                    data: {
                        timeLeft: this.timeLeft,
                        isRunning: this.isRunning,
                        mode: this.mode
                    }
                }).catch(() => {});
            }
        });

        // Create alarms for timer
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'pomodoroTimer') {
                this.timeLeft = Math.max(0, this.timeLeft - 1);
                
                // Update all tabs
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'updateTimer',
                            data: {
                                timeLeft: this.timeLeft,
                                isRunning: this.isRunning,
                                mode: this.mode
                            }
                        }).catch(() => {});
                    });
                });

                this.updateBadge();

                if (this.timeLeft <= 0) {
                    this.completeSession();
                }
            }
        });
    }

    async updateBlocker(data) {
        this.blockerEnabled = data.enabled;
        this.blockedSites = data.sites;
        
        if (this.blockerEnabled && this.isRunning && this.mode === 'focus') {
            await this.enableBlocking();
        } else {
            await this.disableBlocking();
        }
    }

    async enableBlocking() {
        try {
            // Remove existing rules
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const ruleIdsToRemove = existingRules.map(rule => rule.id);
            
            if (ruleIdsToRemove.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: ruleIdsToRemove
                });
            }

            // Add new blocking rules
            const newRules = this.blockedSites.map((site, index) => ({
                id: index + 1,
                priority: 1,
                action: {
                    type: 'block'
                },
                condition: {
                    urlFilter: `*${site}*`,
                    resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'image', 'script', 'stylesheet']
                }
            }));

            if (newRules.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: newRules
                });
            }

            console.log('Blocking enabled for sites:', this.blockedSites);
        } catch (error) {
            console.error('Error enabling blocking:', error);
        }
    }

    async disableBlocking() {
        try {
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const ruleIdsToRemove = existingRules.map(rule => rule.id);
            
            if (ruleIdsToRemove.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: ruleIdsToRemove
                });
            }

            console.log('Blocking disabled');
        } catch (error) {
            console.error('Error disabling blocking:', error);
        }
    }

    startTimer(sessionData) {
        this.isRunning = true;
        this.timeLeft = sessionData.timeLeft;
        this.mode = sessionData.mode || 'focus';
        
        // Create repeating alarm every second
        chrome.alarms.create('pomodoroTimer', {
            delayInMinutes: 1/60,
            periodInMinutes: 1/60
        });

        // Enable blocking if in focus mode
        if (this.blockerEnabled && this.mode === 'focus') {
            this.enableBlocking();
        }

        this.updateBadge();
    }

    pauseTimer() {
        this.isRunning = false;
        chrome.alarms.clear('pomodoroTimer');
        this.disableBlocking();
        this.updateBadge();
    }

    completeSession() {
        this.isRunning = false;
        chrome.alarms.clear('pomodoroTimer');
        this.disableBlocking();
        this.updateBadge();
        
        const message = this.mode === 'focus' 
            ? 'Focus session completed! Time for a break.' 
            : 'Break time is over. Ready to focus?';
        this.showNotification(message);
    }

    updateBadge() {
        if (this.isRunning && this.timeLeft > 0) {
            const minutes = Math.floor(this.timeLeft / 60);
            chrome.action.setBadgeText({ text: minutes.toString() });
            chrome.action.setBadgeBackgroundColor({ 
                color: this.mode === 'focus' ? '#06d6a0' : '#ffd166' 
            });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    }

    showNotification(message) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'FocusFlow',
            message: message,
            priority: 2
        });
    }
}

// Initialize background script
new PomodoroBackground();
