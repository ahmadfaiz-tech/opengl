#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');

// Konfigurasi warna untuk output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    debug: (msg) => console.log(`${colors.cyan}🔍 ${msg}${colors.reset}`)
};

// Konfigurasi GitHub Repository
const GITHUB_REPO = 'https://github.com/ahmadfaiz-tech/opengl.git';
const BACKUP_BRANCH = 'backup-' + new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');

// Fungsi untuk menjalankan command
function runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        let finalCommand = command;

        if (isWindows) {
            finalCommand = command.replace(/2>nul/g, '2>NUL');
        } else {
            finalCommand = command.replace(/2>nul/g, '2>/dev/null');
        }

        exec(finalCommand, {
            ...options,
            shell: isWindows ? 'cmd.exe' : '/bin/sh',
            windowsHide: true
        }, (error, stdout, stderr) => {
            if (error && !options.ignoreErrors) {
                reject({ error, stderr });
            } else {
                resolve(stdout || '');
            }
        });
    });
}

// Fungsi untuk setup Git repository
async function setupGit() {
    log.info('🔧 Setup Git repository...');

    try {
        // Initialize git jika belum
        if (!fs.existsSync('.git')) {
            log.info('📁 Initializing Git repository...');
            await runCommand('git init');
        }

        // Configure Git
        log.info('⚙️  Configuring Git settings...');
        await runCommand('git config core.autocrlf true');

        // Setup remote origin
        try {
            const output = await runCommand('git remote -v');
            if (!output.includes('origin')) {
                await runCommand(`git remote add origin ${GITHUB_REPO}`);
                log.success('✅ Remote origin added');
            } else {
                await runCommand(`git remote set-url origin ${GITHUB_REPO}`);
                log.success('✅ Remote origin updated');
            }
        } catch (error) {
            await runCommand(`git remote add origin ${GITHUB_REPO}`);
            log.success('✅ Remote origin added');
        }

        log.success('✅ Git setup completed');
    } catch (error) {
        log.error(`❌ Git setup failed: ${error.stderr || error.error.message}`);
        throw error;
    }
}

// Fungsi untuk create .gitignore yang selamat
function createSafeGitignore() {
    const gitignoreContent = `
# Dependencies
node_modules/

# Build output
dist/
build/
out/

# Environment files
.env
.env.local

# IDE files
.vscode/settings.json
.vscode/launch.json
.idea/

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Temporary files
*.log
*.cache
.temp/
tmp/

# Large files
*.zip
*.tar.gz
*.rar

# IMPORTANT: Keep all source files, configs, and project files
# ✅ All .js, .json, .html, .css, .glsl files included
# ✅ All config files included
# ✅ .vscode/tasks.json included
`;

    fs.writeFileSync('.gitignore', gitignoreContent);
    log.success('✅ Created safe .gitignore file');
}

// Fungsi untuk backup current state dengan selamat
async function backupCurrentStateSafely() {
    log.info('📦 Creating safe backup of current state...');

    try {
        // Create safe .gitignore
        createSafeGitignore();

        // Add all project files
        log.info('📁 Adding all project files...');
        await runCommand('git add .', { ignoreErrors: true });

        // Check status
        const status = await runCommand('git status --porcelain');
        const files = status.split('\n').filter(line => line.trim());

        log.info(`📊 ${files.length} files ready for backup`);

        // Show sample files
        log.info('📋 Sample files to be committed:');
        files.slice(0, 10).forEach(file => {
            log.debug(`   📄 ${file}`);
        });
        if (files.length > 10) {
            log.debug(`   ... and ${files.length - 10} more files`);
        }

    } catch (error) {
        log.error(`❌ Failed to prepare backup: ${error.stderr || error.error.message}`);
        throw error;
    }
}

// Fungsi untuk prompt user untuk title
function promptForTitle() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(`\n${colors.cyan}${colors.bright}📝 Masukkan title untuk commit message:${colors.reset}`);
        console.log(`${colors.yellow}Contoh: "initial commit" atau "add 3D features"${colors.reset}`);
        console.log(`${colors.blue}Title: ${colors.reset}`);

        rl.question('', (title) => {
            rl.close();
            if (title.trim()) {
                resolve(title.trim());
            } else {
                console.log(`${colors.yellow}⚠️  Title kosong, menggunakan default title...${colors.reset}`);
                resolve('Update OpenGL project');
            }
        });
    });
}

// Fungsi untuk commit dan push
async function commitAndPush() {
    const customTitle = await promptForTitle();
    const timestamp = new Date().toISOString();
    const commitMessage = `${customTitle} - ${timestamp}`;

    log.info(`💾 Committing dengan title: "${customTitle}"...`);

    try {
        // Check if there are changes
        const status = await runCommand('git status --porcelain');
        if (!status || status.trim() === '') {
            log.warning('⚠️  No changes to commit');
            return;
        }

        // Commit
        await runCommand(`git commit -m "${commitMessage}" --no-verify`);
        log.success('✅ Changes committed');

        // Get current branch name
        const currentBranch = await runCommand('git branch --show-current');
        const branchName = currentBranch.trim() || 'master';

        log.debug(`🔍 Current branch: ${branchName}`);

        // Ensure we're on main branch (create if needed)
        log.info('🌿 Ensuring main branch exists...');
        try {
            // Check if main branch exists
            await runCommand('git show-ref --verify --quiet refs/heads/main', { ignoreErrors: true });
            // If exists, checkout to main
            await runCommand('git checkout main');
        } catch (error) {
            // Main doesn't exist, create it from current branch
            if (branchName !== 'main') {
                await runCommand('git branch -M main');
                log.success('✅ Created and switched to main branch');
            }
        }

        // Create backup branch
        log.info(`🌿 Creating backup branch: ${BACKUP_BRANCH}`);
        try {
            await runCommand(`git checkout -b ${BACKUP_BRANCH}`);
            await runCommand(`git push origin ${BACKUP_BRANCH}`);
            log.success(`✅ Backup branch created: ${BACKUP_BRANCH}`);
        } catch (error) {
            log.warning(`⚠️  Could not create backup branch: ${error.stderr || error.error.message}`);
        }

        // Switch back to main
        await runCommand('git checkout main');

        // Push to main
        log.info('🚀 Pushing to main branch...');
        try {
            await runCommand('git push -u origin main');
            log.success('✅ Successfully pushed to main branch');
        } catch (error) {
            if (error.stderr && error.stderr.includes('non-fast-forward')) {
                log.warning('⚠️  Using force push...');
                await runCommand('git push origin main --force');
                log.success('✅ Successfully force pushed to main');
            } else {
                throw error;
            }
        }

    } catch (error) {
        log.error(`❌ Failed to commit/push: ${error.stderr || error.error.message}`);
        throw error;
    }
}

// Fungsi untuk cleanup
async function cleanup() {
    log.info('🧹 Cleaning up...');

    try {
        // Switch back to main
        await runCommand('git checkout main');
        log.success('✅ Switched back to main branch');

        // Delete local backup branch
        try {
            await runCommand(`git branch -D ${BACKUP_BRANCH}`);
            log.success(`✅ Deleted local backup branch: ${BACKUP_BRANCH}`);
        } catch (error) {
            log.warning(`⚠️  Could not delete local backup branch`);
        }

    } catch (error) {
        log.warning(`⚠️  Cleanup failed: ${error.stderr || error.error.message}`);
    }
}

// Fungsi utama
async function main() {
    console.log(`${colors.bright}${colors.magenta}
╔══════════════════════════════════════════════════════════════╗
║                    🛡️  Safe Backup OpenGL                    ║
║              Backup projek OpenGL ke GitHub                  ║
║              SEMUA fail projek akan disimpan                 ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

    try {
        // Setup Git
        await setupGit();

        // Backup current state
        await backupCurrentStateSafely();

        // Commit and push
        await commitAndPush();

        // Cleanup
        await cleanup();

        log.success('\n🎉 Backup completed successfully!');
        log.info(`📁 Repository: ${GITHUB_REPO}`);
        log.info(`🌿 Backup branch: ${BACKUP_BRANCH}`);
        log.info(`⏰ Timestamp: ${new Date().toISOString()}`);

    } catch (error) {
        log.error(`\n💥 Backup failed: ${error.stderr || error.error.message}`);
        process.exit(1);
    }
}

// Jalankan program
if (require.main === module) {
    main().catch(error => {
        log.error(`Program error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    setupGit,
    backupCurrentStateSafely,
    commitAndPush,
    cleanup
};
