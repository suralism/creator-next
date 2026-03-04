const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;

function createWindow(port) {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        title: 'Creator Studio'
    });

    mainWindow.loadURL(`http://127.0.0.1:${port}`);

    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Open external links in default browser
        if (url.startsWith('http')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function startNextJs(port) {
    return new Promise((resolve, reject) => {
        console.log('Starting Next.js standalone server processing...');
        let standaloneDir = path.join(__dirname, '.next', 'standalone');

        // When packaged, __dirname is inside app.asar but the unpacked files
        // are in app.asar.unpacked. spawn needs a real filesystem path for cwd.
        if (app.isPackaged) {
            standaloneDir = standaloneDir.replace('app.asar', 'app.asar.unpacked');
        }

        // Electron embedded Node.js usage
        nextProcess = spawn(process.execPath, ['server.js'], {
            cwd: standaloneDir,
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1',
                PORT: port,
                NODE_ENV: 'production',
                HOSTNAME: '127.0.0.1'
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        nextProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            console.log(`[Next.js]: ${msg}`);
            if (msg.includes('Listening on port') || msg.includes('Ready in') || msg.includes('http://')) {
                resolve();
            }
        });

        nextProcess.stderr.on('data', (data) => {
            console.error(`[Next.js Error]: ${data.toString()}`);
        });

        nextProcess.on('exit', (code) => {
            console.log(`Next.js process exited with code ${code}`);
            reject(new Error('Next.js process crashed'));
        });
    });
}

const isDev = !app.isPackaged;

app.whenReady().then(async () => {
    let port = isDev ? 3000 : 35478;

    if (!isDev) {
        // Start Next.js from the bundled standalone server first
        try {
            await startNextJs(port);
            // add a small buffer wait
            setTimeout(() => createWindow(port), 1500);
        } catch (e) {
            console.error('Failed to start embedded Next.js:', e);
            // Try to open it anyway
            createWindow(port);
        }
    } else {
        // In dev mode, concurrently script wraps around the already running `next dev`
        createWindow(port);
    }

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (nextProcess) {
        nextProcess.kill();
    }
});
