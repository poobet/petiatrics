const { execSync } = require('child_process');

const ports = [3000, 3001];

ports.forEach((port) => {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      const killedPids = new Set();

      lines.forEach((line) => {
        const parts = line.trim().split(/\s+/);
        const state = parts[3];
        const pid = parts[parts.length - 1];

        if (pid && pid !== '0' && !isNaN(pid) && !killedPids.has(pid) && (state === 'LISTENING' || !state)) {
          killedPids.add(pid);
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`[kill-ports] Successfully killed process PID ${pid} on port ${port}`);
          } catch (e) {
            // Process may have exited
          }
        }
      });
    } else {
      execSync(`lsof -t -i:${port} | xargs kill -9`, { stdio: 'ignore' });
      console.log(`[kill-ports] Successfully killed process on port ${port}`);
    }
  } catch (e) {
    // Port is free
  }
});
