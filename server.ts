import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Check if TSX runtime is already active (via process.execArgv or bootstrap marker)
const isTsx = Boolean(
  process.env.__TSX_BOOTSTRAPPED__ ||
  process.execArgv.some(arg => arg.includes('tsx'))
);

if (!isTsx) {
  // Plain node was invoked without tsx loader (e.g. `node server.ts` or `npm start` in production container).
  // Bootstrap with `--import tsx` to enable seamless TypeScript and extensionless ESM resolution.
  process.env.__TSX_BOOTSTRAPPED__ = '1';
  const currentFile = fileURLToPath(import.meta.url);
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', currentFile, ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: process.env,
    }
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  const forwardSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const sig of forwardSignals) {
    process.on(sig, () => {
      if (!child.killed) {
        child.kill(sig);
      }
    });
  }
} else {
  // TSX is active: dynamically import the server application
  import('./server-app');
}
