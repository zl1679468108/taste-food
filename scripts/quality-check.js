#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const steps = [
  {
    name: 'shared typecheck',
    cwd: path.join(root, 'packages/shared'),
    command: '../../client/node_modules/.bin/tsc',
    args: ['--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'],
  },
  {
    name: 'server tests',
    cwd: path.join(root, 'server'),
    command: 'npm',
    args: ['test'],
  },
  {
    name: 'server build',
    cwd: path.join(root, 'server'),
    command: 'npm',
    args: ['run', 'build'],
  },
  {
    name: 'client typecheck',
    cwd: path.join(root, 'client'),
    command: './node_modules/.bin/tsc',
    args: ['--noEmit', '--pretty', 'false'],
  },
  {
    name: 'client tests',
    cwd: path.join(root, 'client'),
    command: 'npm',
    args: ['test', '--', '--runInBand', '--passWithNoTests'],
  },
  {
    name: 'client weapp build',
    cwd: path.join(root, 'client'),
    command: 'npm',
    args: ['run', 'build:weapp'],
  },
  {
    name: 'admin typecheck',
    cwd: path.join(root, 'admin'),
    command: './node_modules/.bin/tsc',
    args: ['--noEmit', '--pretty', 'false'],
  },
  {
    name: 'admin tests',
    cwd: path.join(root, 'admin'),
    command: 'npm',
    args: ['test', '--', '--runInBand', '--passWithNoTests'],
  },
  {
    name: 'admin build',
    cwd: path.join(root, 'admin'),
    command: 'npm',
    args: ['run', 'build'],
  },
];

const startedAt = Date.now();

for (const [index, step] of steps.entries()) {
  const label = `${index + 1}/${steps.length} ${step.name}`;
  console.log(`\n[quality] ${label}`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) {
    console.error(`[quality] ${step.name} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[quality] ${step.name} exited with code ${result.status}`);
    process.exit(result.status || 1);
  }
}

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n[quality] all checks passed in ${seconds}s`);
