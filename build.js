const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

class FocusFlowExtensionBuilder {
    constructor() {
        this.sourceDir = path.join(__dirname);
        this.outputPath = path.join(__dirname, 'focusflow-extension.zip');
        this.excludePatterns = [
            'node_modules/**',
            '.git/**',
            'build.js',
            'package.json',
            'package-lock.json',
            '.gitignore',
            'README.md',
            '*.zip',
            '.DS_Store',
            'Thumbs.db'
        ];
    }

    async build() {
        console.log('🍅 Building FocusFlow Chrome Extension for Web Store...');
        
        try {
            // Clean previous build
            if (fs.existsSync(this.outputPath)) {
                fs.unlinkSync(this.outputPath);
                console.log('✅ Cleaned previous build');
            }

            // Validate required files
            await this.validateFiles();

            // Create zip archive
            await this.createZipArchive();

            console.log('✅ FocusFlow Extension build completed successfully!');
            console.log(`📦 Package ready: ${this.outputPath}`);
            this.printDeploymentInstructions();

        } catch (error) {
            console.error('❌ Build failed:', error.message);
            process.exit(1);
        }
    }

    async validateFiles() {
        console.log('🔍 Validating required files...');
        
        const requiredFiles = [
            'manifest.json',
            'popup.html',
            'popup.js',
            'background.js',
            'content.js',
            'styles.css',
            'content.css',
            'icons/icon16.png',
            'icons/icon48.png',
            'icons/icon128.png'
        ];

        const missingFiles = [];
        
        for (const file of requiredFiles) {
            const filePath = path.join(this.sourceDir, file);
            if (!fs.existsSync(filePath)) {
                missingFiles.push(file);
            }
        }

        if (missingFiles.length > 0) {
            throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
        }

        // Check manifest version
        await this.validateManifest();

        console.log('✅ All required files found');
    }

    async validateManifest() {
        const manifestPath = path.join(this.sourceDir, 'manifest.json');
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        
        try {
            const manifest = JSON.parse(manifestContent);
            
            if (manifest.manifest_version !== 3) {
                console.warn('⚠️ Warning: Using Manifest V2. Consider upgrading to V3');
            }
            
            if (!manifest.name || !manifest.version || !manifest.description) {
                throw new Error('Manifest missing required fields: name, version, or description');
            }

            console.log(`📋 Extension: ${manifest.name} v${manifest.version}`);
            
        } catch (error) {
            throw new Error(`Invalid manifest.json: ${error.message}`);
        }
    }

    async createZipArchive() {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(this.outputPath);
            const archive = archiver('zip', { 
                zlib: { level: 9 } // Maximum compression
            });

            output.on('close', () => {
                const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
                console.log(`📦 Archive created: ${sizeInMB} MB`);
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.on('warning', (err) => {
                console.warn('⚠️ Archive warning:', err);
            });

            archive.pipe(output);

            // Add files to archive
            this.addFilesToArchive(archive);

            archive.finalize();
        });
    }

    addFilesToArchive(archive) {
        console.log('📄 Adding files to archive...');
        
        // Core extension files
        const filesToInclude = [
            { src: 'manifest.json', dest: 'manifest.json' },
            { src: 'popup.html', dest: 'popup.html' },
            { src: 'popup.js', dest: 'popup.js' },
            { src: 'background.js', dest: 'background.js' },
            { src: 'content.js', dest: 'content.js' },
            { src: 'styles.css', dest: 'styles.css' },
            { src: 'content.css', dest: 'content.css' }
        ];

        // Icon files
        const iconFiles = [
            { src: 'icons/icon16.png', dest: 'icons/icon16.png' },
            { src: 'icons/icon48.png', dest: 'icons/icon48.png' },
            { src: 'icons/icon128.png', dest: 'icons/icon128.png' }
        ];

        // Add all files
        [...filesToInclude, ...iconFiles].forEach(({ src, dest }) => {
            const srcPath = path.join(this.sourceDir, src);
            if (fs.existsSync(srcPath)) {
                archive.file(srcPath, { name: dest });
                console.log(`  ✓ Added: ${src}`);
            } else {
                console.warn(`  ⚠️ Missing: ${src}`);
            }
        });

        // Add sounds folder if it exists (optional)
        const soundsDir = path.join(this.sourceDir, 'sounds');
        if (fs.existsSync(soundsDir)) {
            archive.directory(soundsDir, 'sounds');
            console.log('  ✓ Added: sounds/ directory');
        }
    }

    printDeploymentInstructions() {
        console.log('\n🍅 FocusFlow Extension - Next Steps:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🧪 Local Testing:');
        console.log('1. Go to chrome://extensions/');
        console.log('2. Enable "Developer mode" (top right toggle)');
        console.log('3. Click "Load unpacked"');
        console.log('4. Select this project folder (NOT the zip file)');
        console.log('5. Test all features: timer, tasks, website blocker');
        console.log('');
        console.log('🚀 Chrome Web Store Deployment:');
        console.log('1. Go to https://chrome.google.com/webstore/devconsole/');
        console.log('2. Pay $5 developer registration fee (one-time)');
        console.log('3. Click "New Item"');
        console.log('4. Upload focusflow-extension.zip');
        console.log('5. Fill out store listing:');
        console.log('   - Description: Highlight Pomodoro + task management');
        console.log('   - Screenshots: Show timer, task list, settings');
        console.log('   - Category: Productivity');
        console.log('   - Privacy policy: Required for extensions with permissions');
        console.log('6. Submit for review (usually takes 1-3 days)');
        console.log('');
        console.log('📊 Pre-submission Checklist:');
        console.log('□ Test all timer functions (start, pause, reset, skip)');
        console.log('□ Verify task management (add, complete, delete)');
        console.log('□ Test website blocker during focus sessions');
        console.log('□ Check floating widget on different websites');
        console.log('□ Verify statistics are tracking correctly');
        console.log('□ Test all sound notifications');
        console.log('□ Check responsive design in popup');
        console.log('□ Verify data persistence across browser sessions');
        console.log('');
        console.log('💡 Tips for Web Store Success:');
        console.log('- Add 1-2 high-quality screenshots showing key features');
        console.log('- Write clear description highlighting unique features');
        console.log('- Include keywords: pomodoro, productivity, focus, timer');
        console.log('- Respond to user reviews and update regularly');
    }
}

// Run the builder
if (require.main === module) {
    const builder = new FocusFlowExtensionBuilder();
    builder.build().catch(console.error);
}

module.exports = FocusFlowExtensionBuilder;
