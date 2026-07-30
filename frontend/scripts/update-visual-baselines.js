const { spawnSync } = require('child_process');

if (process.platform !== 'linux') {
  console.error(
    'Los baselines visuales oficiales solo pueden actualizarse en Linux (Ubuntu + Chromium).'
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    require.resolve('@playwright/test/cli'),
    'test',
    '--config=playwright.visual.config.js',
    '--update-snapshots=all',
  ],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 1);
