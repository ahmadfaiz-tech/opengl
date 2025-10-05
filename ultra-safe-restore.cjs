#!/usr/bin/env node

const { exec, execSync } = require('child_process');
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
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    debug: (msg) => console.log(`${colors.cyan}🔍 ${msg}${colors.reset}`),
    title: (msg) => console.log(`${colors.bright}${colors.magenta}${msg}${colors.reset}`)
};

// Fungsi untuk menjalankan command
function runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        exec(command, {
            ...options,
            stdio: 'inherit',
            maxBuffer: 50 * 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve(stdout);
            }
        });
    });
}

// Fungsi untuk sync command
function runCommandSync(command) {
    try {
        return execSync(command, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    } catch (error) {
        throw { error, stderr: error.stderr?.toString() };
    }
}

// Fungsi untuk input user
function askQuestion(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// Fungsi untuk format masa
function formatTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays} hari lepas`;
    } else if (diffHours > 0) {
        return `${diffHours} jam lepas`;
    } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} minit lepas`;
    }
}

// Fungsi untuk dapatkan branch terkini
async function getLatestBranch() {
    try {
        log.info('🔍 Mencari branch terkini...');

        // Fetch latest dari remote
        await runCommand('git fetch origin');

        // Dapatkan semua branch dengan masa push
        const branchesOutput = runCommandSync('git for-each-ref --format="%(refname:short)|%(committerdate:iso8601)|%(subject)" refs/remotes/origin/');
        const branches = branchesOutput.split('\n')
            .filter(line => line.trim() && line.includes('backup-'))
            .map(line => {
                const [branch, date, subject] = line.split('|');
                return {
                    name: branch.replace('origin/', ''),
                    date: new Date(date),
                    subject: subject || 'No subject'
                };
            })
            .sort((a, b) => b.date - a.date);

        if (branches.length === 0) {
            throw new Error('Tiada branch backup dijumpai');
        }

        const latestBranch = branches[0];
        log.success(`📅 Branch terkini: ${latestBranch.name}`);
        log.info(`⏰ Masa push: ${formatTimeAgo(latestBranch.date)}`);
        log.info(`📝 Commit: ${latestBranch.subject}`);

        return { latestBranch, allBranches: branches };
    } catch (error) {
        log.error(`❌ Gagal dapatkan branch terkini: ${error.stderr || error.error?.message}`);
        throw error;
    }
}

// Fungsi untuk paparkan semua branch
function displayAllBranches(branches) {
    log.title('\n📋 Semua Branch Backup yang Tersedia:');
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│ ${colors.white}No.${colors.cyan} │ ${colors.white}Branch Name${colors.cyan}                    │ ${colors.white}Masa Push${colors.cyan}        │${colors.reset}`);
    console.log(`${colors.cyan}├─────────────────────────────────────────────────────────────────┤${colors.reset}`);

    branches.forEach((branch, index) => {
        const timeAgo = formatTimeAgo(branch.date);
        const branchName = branch.name.padEnd(25);
        const timeStr = timeAgo.padEnd(15);
        console.log(`${colors.cyan}│ ${colors.white}${(index + 1).toString().padStart(2)}${colors.cyan} │ ${colors.white}${branchName}${colors.cyan} │ ${colors.white}${timeStr}${colors.cyan} │${colors.reset}`);
    });

    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────┘${colors.reset}`);
}

// Fungsi untuk pilih branch
async function selectBranch(branches) {
    const maxChoice = branches.length;

    while (true) {
        const choice = await askQuestion(`\n${colors.yellow}Pilih branch (1-${maxChoice}) atau 'q' untuk keluar: ${colors.reset}`);

        if (choice.toLowerCase() === 'q') {
            log.info('👋 Keluar dari program...');
            process.exit(0);
        }

        const choiceNum = parseInt(choice);
        if (choiceNum >= 1 && choiceNum <= maxChoice) {
            return branches[choiceNum - 1];
        } else {
            log.error(`❌ Pilihan tidak sah. Sila pilih 1-${maxChoice} atau 'q' untuk keluar.`);
        }
    }
}

// Fungsi untuk restore ke branch
async function restoreToBranch(branch) {
    log.title(`\n🔄 Memulakan Restore ke Branch: ${branch.name}`);
    log.warning(`⚠️  PERHATIAN: Semua perubahan selepas ${formatTimeAgo(branch.date)} akan hilang!`);

    const confirm = await askQuestion(`${colors.red}Adakah anda pasti mahu restore? (ya/tidak): ${colors.reset}`);

    if (confirm.toLowerCase() !== 'ya') {
        log.info('❌ Restore dibatalkan.');
        return false;
    }

    try {
        // Checkout ke branch backup
        log.info(`🔀 Checkout ke branch ${branch.name}...`);
        await runCommand(`git checkout ${branch.name}`);
        log.success(`✅ Berjaya checkout ke ${branch.name}`);

        // Kembali ke main dan reset hard
        log.info('🔄 Kembali ke branch main...');
        await runCommand('git checkout main');
        log.success('✅ Berjaya kembali ke main');

        // Reset hard ke branch backup
        log.info(`🔄 Reset hard ke ${branch.name}...`);
        await runCommand(`git reset --hard ${branch.name}`);
        log.success(`✅ Berjaya reset hard ke ${branch.name}`);

        // Clean fail baru
        log.info('🧹 Membersihkan fail baru...');
        await runCommand('git clean -fd');
        log.success('✅ Berjaya membersihkan fail baru');

        log.success(`\n🎉 Restore berjaya! Semua fail telah dikembalikan ke keadaan ${branch.name}`);
        log.info(`⏰ Masa backup: ${formatTimeAgo(branch.date)}`);
        log.info(`📝 Commit: ${branch.subject}`);

        return true;

    } catch (error) {
        log.error(`❌ Restore gagal: ${error.stderr || error.error?.message}`);
        return false;
    }
}

// Fungsi utama
async function main() {
    console.log(`${colors.bright}${colors.magenta}
╔══════════════════════════════════════════════════════════════╗
║                  🛡️  Ultra Safe Restore                      ║
║              Restore semua fail ke branch tertentu           ║
║              SEMUA fail baru akan dibuang                    ║
║              SEMUA perubahan akan hilang                     ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

    try {
        // Check Git repository
        log.info('🔧 Checking Git repository...');
        if (!fs.existsSync('.git')) {
            log.error('❌ Ini bukan Git repository. Sila jalankan dalam folder projek.');
            process.exit(1);
        }

        // Dapatkan branch terkini
        const { latestBranch, allBranches } = await getLatestBranch();

        // Tanya user sama ada mahu restore ke branch terkini
        log.title(`\n🤔 Branch Terkini Dijumpai: ${latestBranch.name}`);
        log.info(`⏰ Masa push: ${formatTimeAgo(latestBranch.date)}`);
        log.info(`📝 Commit: ${latestBranch.subject}`);

        const useLatest = await askQuestion(`${colors.yellow}Adakah anda mahu restore ke branch ini? (ya/tidak): ${colors.reset}`);

        let selectedBranch;

        if (useLatest.toLowerCase() === 'ya') {
            selectedBranch = latestBranch;
        } else {
            // Paparkan semua branch untuk pilihan
            displayAllBranches(allBranches);
            selectedBranch = await selectBranch(allBranches);
        }

        // Restore ke branch yang dipilih
        const success = await restoreToBranch(selectedBranch);

        if (success) {
            log.success('\n🎉 Restore selesai!');
            log.info('💡 Semua fail telah dikembalikan ke keadaan backup.');
            log.warning('⚠️  Fail baru selepas backup telah dibuang.');
        } else {
            log.error('\n💥 Restore gagal!');
            process.exit(1);
        }

    } catch (error) {
        log.error(`\n💥 Program error: ${error.stderr || error.error?.message || error.message}`);
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
    getLatestBranch,
    displayAllBranches,
    selectBranch,
    restoreToBranch
};
