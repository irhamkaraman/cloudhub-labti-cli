#!/usr/bin/env node

/**
 * Official CloudHub Lab TI UMPO CLI
 * Zero-configuration Remote Terminal & SSH over WebSocket Port 443 (HTTPS)
 * Author: Bos Irham Karaman & Aila Engineering Core
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  // If run via npx or global without pre-bundled ws
  try {
    WebSocket = require(path.join(__dirname, '../node_modules/ws'));
  } catch (err) {
    console.error('Error loading WebSocket library (ws). Please ensure dependencies are installed.');
    process.exit(1);
  }
}

const DEFAULT_BASE_URL = process.env.CLOUDHUB_API_URL || 'https://labtiumpo.web.id';
const CONFIG_DIR = path.join(os.homedir(), '.cloudhub');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function saveCredentials(data) {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function makeRequest(method, urlStr, postData = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqHeaders = {
      'User-Agent': 'CloudHub-CLI/1.0.0',
      'Accept': 'application/json',
      ...headers
    };

    if (postData) {
      if (typeof postData === 'object') {
        postData = JSON.stringify(postData);
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: method.toUpperCase(),
      headers: reqHeaders,
      timeout: 10000
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function openBrowser(url) {
  const start = (process.platform === 'darwin' ? 'open' :
                 process.platform === 'win32' ? 'start ""' : 'xdg-open');
  exec(`${start} "${url}"`, (err) => {
    // Ignore error if headless or terminal browser
  });
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

async function cmdLogin() {
  console.log('\x1b[36m%s\x1b[0m', '═════════════════════════════════════════════════════════════');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '  CloudHub Lab TI UMPO — Official Web Authorization');
  console.log('\x1b[36m%s\x1b[0m', '═════════════════════════════════════════════════════════════');
  console.log('Menghubungkan ke server otentikasi...');

  const deviceName = `${os.hostname()} (${os.platform()} ${os.arch()})`;
  let initiateResp;
  try {
    initiateResp = await makeRequest('POST', `${DEFAULT_BASE_URL}/api/cli/auth/initiate`, {
      device_name: deviceName
    });
  } catch (e) {
    console.error('\x1b[31m%s\x1b[0m', `Gagal menghubungi server: ${e.message}`);
    process.exit(1);
  }

  if (!initiateResp.data || !initiateResp.data.session_id) {
    console.error('\x1b[31m%s\x1b[0m', 'Respon server tidak valid saat inisiasi otentikasi.');
    process.exit(1);
  }

  const { session_id, auth_url } = initiateResp.data;

  console.log('\n\x1b[33m%s\x1b[0m', 'Buka browser Anda dan klik "Izinkan Akses" pada tautan berikut:');
  console.log('\x1b[1m\x1b[36m%s\x1b[0m\n', `  ${auth_url}`);

  console.log('Membuka browser secara otomatis...');
  openBrowser(auth_url);

  console.log('\nMenunggu persetujuan dari browser Anda (maksimal 5 menit)...');

  const pollInterval = 2000;
  const maxAttempts = 150; // 5 minutes
  let attempts = 0;

  const timer = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(timer);
      console.log('\n\x1b[31m%s\x1b[0m', 'Otentikasi kedaluwarsa. Silakan ulangi perintah login.');
      process.exit(1);
    }

    try {
      const pollResp = await makeRequest('GET', `${DEFAULT_BASE_URL}/api/cli/auth/poll?session=${encodeURIComponent(session_id)}`);
      if (pollResp.data && pollResp.data.status === 'approved') {
        clearInterval(timer);
        const { token, username, name } = pollResp.data;
        saveCredentials({
          token,
          username,
          name,
          base_url: DEFAULT_BASE_URL,
          device: deviceName,
          logged_at: new Date().toISOString()
        });
        console.log('\n\x1b[32m%s\x1b[0m', '✔ Otentikasi Berhasil!');
        console.log(`Selamat datang, \x1b[1m${name || username}\x1b[0m (NIM: ${username})`);
        console.log(`Kredensial tersimpan aman di: \x1b[36m${CREDENTIALS_FILE}\x1b[0m\n`);
        console.log('Sekarang Anda dapat membuka terminal cloud kapan saja dengan perintah:');
        console.log('\x1b[1m\x1b[32m%s\x1b[0m\n', '  npx github:irhamkaraman/cloudhub-labti-cli ssh');
        process.exit(0);
      } else if (pollResp.data && pollResp.data.status === 'rejected') {
        clearInterval(timer);
        console.log('\n\x1b[31m%s\x1b[0m', '✖ Permintaan otentikasi ditolak melalui browser.');
        process.exit(1);
      } else if (pollResp.data && pollResp.data.status === 'expired') {
        clearInterval(timer);
        console.log('\n\x1b[31m%s\x1b[0m', '✖ Sesi telah kedaluwarsa.');
        process.exit(1);
      } else {
        process.stdout.write('.');
      }
    } catch (err) {
      // transient network error, retry next tick
    }
  }, pollInterval);
}

function cmdStatus() {
  const creds = loadCredentials();
  console.log('\x1b[36m%s\x1b[0m', '═════════════════════════════════════════════════════════════');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '  CloudHub Lab TI UMPO — Status Akun CLI');
  console.log('\x1b[36m%s\x1b[0m', '═════════════════════════════════════════════════════════════');

  if (!creds || !creds.token) {
    console.log('\x1b[33m%s\x1b[0m', 'Status: Belum login.');
    console.log('Jalankan perintah berikut untuk login:');
    console.log('\x1b[1m\x1b[32m%s\x1b[0m\n', '  npx github:irhamkaraman/cloudhub-labti-cli login');
    return;
  }

  console.log(`Status        : \x1b[32mTerotentikasi (Aktif)\x1b[0m`);
  console.log(`Pengguna      : ${creds.name || creds.username} (NIM: ${creds.username})`);
  console.log(`Server        : ${creds.base_url || DEFAULT_BASE_URL}`);
  console.log(`Perangkat     : ${creds.device || 'Terminal'}`);
  console.log(`Waktu Login   : ${creds.logged_at ? new Date(creds.logged_at).toLocaleString() : 'N/A'}`);
  console.log(`File Kredensial: ${CREDENTIALS_FILE}\n`);
}

function cmdLogout() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
  console.log('\x1b[32m%s\x1b[0m', '✔ Kredensial lokal berhasil dihapus (Logged out).');
}

function cmdConnect() {
  const creds = loadCredentials();
  if (!creds || !creds.token) {
    console.error('\x1b[31m%s\x1b[0m', 'Anda belum login!');
    console.log('Silakan login terlebih dahulu:');
    console.log('\x1b[1m\x1b[32m%s\x1b[0m\n', '  npx github:irhamkaraman/cloudhub-labti-cli login');
    process.exit(1);
  }

  const baseUrl = creds.base_url || DEFAULT_BASE_URL;
  const parsed = new URL(baseUrl);
  const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${parsed.host}/api/cli/tunnel?token=${encodeURIComponent(creds.token)}`;

  // Set terminal to raw mode if interactive TTY
  const isRaw = process.stdin.isTTY;
  if (isRaw) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    // Send initial window size
    if (process.stdout.columns && process.stdout.rows) {
      ws.send(`__RESIZE__:${process.stdout.columns}:${process.stdout.rows}`);
    }

    // Forward stdin to WebSocket
    process.stdin.on('data', (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    });

    // Handle terminal resize
    process.stdout.on('resize', () => {
      if (ws.readyState === WebSocket.OPEN && process.stdout.columns && process.stdout.rows) {
        ws.send(`__RESIZE__:${process.stdout.columns}:${process.stdout.rows}`);
      }
    });
  });

  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) {
      process.stdout.write(data);
    } else {
      process.stdout.write(data.toString());
    }
  });

  ws.on('error', (err) => {
    if (isRaw) process.stdin.setRawMode(false);
    console.error('\n\x1b[31m%s\x1b[0m', `WebSocket Error: ${err.message}`);
    process.exit(1);
  });

  ws.on('close', (code, reason) => {
    if (isRaw) process.stdin.setRawMode(false);
    process.stdout.write('\r\n\x1b[33m[Koneksi CloudHub Sandbox Berakhir]\x1b[0m\r\n');
    process.exit(0);
  });
}

function cmdProxy() {
  const creds = loadCredentials();
  if (!creds || !creds.token) {
    process.stderr.write('Error: Not authenticated. Run "cloudhub login" first.\n');
    process.exit(1);
  }

  const baseUrl = creds.base_url || DEFAULT_BASE_URL;
  const parsed = new URL(baseUrl);
  const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${parsed.host}/api/cli/tunnel?token=${encodeURIComponent(creds.token)}`;

  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    process.stdin.on('data', (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    });
  });

  ws.on('message', (data) => {
    process.stdout.write(data);
  });

  ws.on('error', (err) => {
    process.stderr.write(`Proxy error: ${err.message}\n`);
    process.exit(1);
  });

  ws.on('close', () => {
    process.exit(0);
  });
}

function showHelp() {
  console.log(`
\x1b[1m\x1b[32mCloudHub Lab TI UMPO CLI\x1b[0m — Official Developer Tools (v1.0.0)

\x1b[1mPENGGUNAAN:\x1b[0m
  npx github:irhamkaraman/cloudhub-labti-cli <perintah>

\x1b[1mPERINTAH UTAMA:\x1b[0m
  \x1b[32mlogin\x1b[0m               Buka otentikasi browser untuk verifikasi akun mahasiswa
  \x1b[32mssh\x1b[0m | \x1b[32mconnect\x1b[0m        Buka shell interaktif langsung ke sandbox container Anda
  \x1b[32mstatus\x1b[0m              Periksa status sesi otentikasi perangkat saat ini
  \x1b[32mproxy\x1b[0m               Gunakan sebagai ProxyCommand untuk OpenSSH & VS Code Remote
  \x1b[32mlogout\x1b[0m              Hapus token otentikasi lokal dari perangkat ini
  \x1b[32mhelp\x1b[0m | \x1b[32m--help\x1b[0m         Tampilkan panduan bantuan ini

\x1b[1mCONTOH CEPAT:\x1b[0m
  npx github:irhamkaraman/cloudhub-labti-cli login
  npx github:irhamkaraman/cloudhub-labti-cli ssh
`);
}

// -----------------------------------------------------------------------------
// Entry Point
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);
const command = (args[0] || 'help').toLowerCase();

switch (command) {
  case 'login':
  case 'auth':
    cmdLogin();
    break;
  case 'ssh':
  case 'connect':
  case 'shell':
    cmdConnect();
    break;
  case 'proxy':
    cmdProxy();
    break;
  case 'status':
  case 'info':
    cmdStatus();
    break;
  case 'logout':
    cmdLogout();
    break;
  case '--version':
  case '-v':
  case 'version':
    console.log('cloudhub-labti-cli v1.0.0');
    break;
  case 'help':
  case '--help':
  case '-h':
  default:
    showHelp();
    break;
}
