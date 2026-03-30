const { spawn } = require('node:child_process');

function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });

    child.on('error', reject);
  });
}

async function main() {
  const mode = (process.env.PRISMA_DEPLOY_MODE || 'deploy').trim().toLowerCase();
  const shouldSkipPrismaDeploy = mode === 'skip';

  if (shouldSkipPrismaDeploy) {
    console.log('[render-start] Skipping prisma migrate deploy because PRISMA_DEPLOY_MODE=skip');
  } else {
    console.log('[render-start] Running prisma migrate deploy before boot');
    await run('npm run prisma:deploy');
  }

  console.log('[render-start] Starting backend');
  await run('npm run start:prod');
}

main().catch((error) => {
  console.error('[render-start] Startup failed');
  console.error(error);
  process.exit(1);
});
