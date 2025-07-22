# FocusFlow - Modern Pomodoro Timer Chrome Extension

A beautiful, feature-rich Pomodoro timer extension for Chrome that helps you stay focused and productive.

## Features

### 🍅 Core Timer Functionality
- **Customizable Focus Sessions**: 25, 30, 45, or 60-minute focus periods
- **Smart Break System**: 5, 10, or 15-minute short breaks, longer breaks after every 4 sessions
- **Visual Progress Ring**: Modern circular progress indicator with smooth animations
- **Audio Notifications**: Multiple sound options for session completion

### ✅ Task Management
- **Daily Task List**: Add, complete, and track your daily tasks
- **Task Persistence**: Tasks are saved across browser sessions
- **Quick Task Entry**: Simple interface for adding new tasks

### 🚫 Website Blocker
- **Distraction Blocking**: Block distracting websites during focus sessions
- **Custom Block List**: Add your own sites to block
- **Smart Blocking**: Only active during focus periods, not breaks

### 📊 Statistics & Analytics
- **Daily Progress**: Track completed sessions per day
- **Total Statistics**: See your all-time focus time and session count
- **Streak Counter**: Maintain your productivity streak

### 🎨 Modern Design
- **Fresh UI**: Modern gradient design with smooth animations
- **Responsive Layout**: Works perfectly in the extension popup
- **Always-Visible Widget**: Optional floating timer on web pages
- **Drag & Drop**: Move the floating widget anywhere on screen

## Installation

### From Chrome Web Store (Recommended)
1. Visit the Chrome Web Store (link will be added after publication)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Development)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The FocusFlow icon should appear in your toolbar

## Usage

### Basic Timer Operation
1. Click the FocusFlow icon in your Chrome toolbar
2. Adjust focus and break durations using the time selector buttons
3. Click the play button (▶) to start your focus session
4. The timer will automatically switch between focus and break periods

### Task Management
1. Click the "+" button next to "Today's Tasks"
2. Enter your task and press Enter or click "Add"
3. Check off completed tasks by clicking the checkbox
4. Delete tasks by hovering and clicking the "×" button

### Website Blocking
1. Toggle the "Website Blocker" switch to enable blocking
2. Add websites to block by typing in the input field and pressing Enter
3. Remove blocked sites by clicking the "×" next to each site
4. Blocking is automatically active during focus sessions

### Floating Widget
- A small floating timer appears on web pages when the timer is running
- Drag it to reposition anywhere on the screen
- Click the play/pause button to control the timer
- Click the "×" button to hide the widget

## Data Storage

This extension uses only browser localStorage for data persistence:
- **Settings**: Timer durations, sound preferences, blocked sites
- **Tasks**: Your daily task list
- **Statistics**: Session counts, focus time, streaks
- **Session State**: Current timer status and remaining time

All data stays on your device and is never sent to external servers.

## Permissions Explained

The extension requests these permissions:
- **Storage**: Save your settings and data locally
- **Active Tab**: Show the floating timer widget
- **Tabs**: Update the timer across all open tabs
- **Alarms**: Keep the timer running when the popup is closed
- **Notifications**: Show completion notifications
- **Web Request**: Block distracting websites during focus sessions

## Troubleshooting

### Timer doesn't continue when popup is closed
- Make sure Chrome is allowed to run in the background
- Check if alarms permission is granted

### Website blocking not working
- Ensure the "Website Blocker" toggle is enabled
- Verify the blocked sites are entered correctly (e.g., "facebook.com")
- Try refreshing the page after adding new blocked sites

### Floating widget not appearing
- Make sure the timer is actually running
- Try refreshing the web page
- Check if the widget was accidentally moved off-screen

## Contributing

This is an open-source project. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Support

For bug reports or feature requests, please create an issue in the GitHub repository.

## Version History

### v1.0.0 (Initial Release)
- Core Pomodoro timer functionality
- Task management system
- Website blocker
- Statistics tracking
- Modern UI with animations
- Floating widget for all web pages
