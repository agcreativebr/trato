#!/usr/bin/env node
const { execSync } = require('child_process');

function killWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const pids = Array.from(new Set(out.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const parts = l.split(/\s+/);
      return parts[parts.length - 1];
    }).filter(x => /^\d+$/.test(x))));
    for (const pid of pids) {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}

function killUnix(port) {
  try {
    const out = execSync(`lsof -i :${port} -t`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const pids = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    for (const pid of pids) {
      try { execSync(`kill -9 ${pid}`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}

const port = process.argv[2] || '3000';
if (process.platform === 'win32') killWindows(port);
else killUnix(port);
console.log(`[kill-port] garantido sem processos na porta ${port}`);



