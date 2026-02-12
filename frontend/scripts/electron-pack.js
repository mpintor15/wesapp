#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const target = process.argv[2] || 'mac';
const targetArgs = {
  mac: ['--mac'],
  win: ['--win'],
  all: ['--mac', '--win']
};

if (!targetArgs[target]) {
  console.error(`Invalid target "${target}". Use one of: mac, win, all.`);
  process.exit(1);
}

const binName = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const electronBuilderBin = path.resolve(__dirname, '../node_modules/.bin', binName);

const result = spawnSync(
  electronBuilderBin,
  ['build', ...targetArgs[target]],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false'
    }
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
