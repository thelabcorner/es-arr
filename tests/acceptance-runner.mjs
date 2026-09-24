#!/usr/bin/env node
// VERIFY acceptance runner — crash-resilient (coordinator directive):
//   - every step result is checkpointed to a JSON state file immediately
//   - a resume marker lets a restarted session pick up where it left off
//   - a stale "running" marker (crash mid-step) is re-run on resume
//
// Steps (per the binding acceptance chain):
//   npm-test  : D3 two-case trap fix verified + full Node-side suite green
//   live-diff : gate-on live differential vs Node incl. window bytes
//   accel-e2e : espack bundle end-to-end (extract -> load -> native ->
//               parity -> versioned reruns)
//
// Usage:
//   node tests/acceptance-runner.mjs [--resume] [--step <id>] [--all]
// State: tests/acceptance-state.json ; raw results: docs/verification-checkpoints/
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var PROJECT = join(ROOT, '..');
var STATE_FILE = join(ROOT, 'acceptance-state.json');
var CHECKPOINT_DIR = join(PROJECT, 'docs', 'verification-checkpoints');
mkdirSync(CHECKPOINT_DIR, { recursive: true });

var npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

var STEPS = [
  {
    id: 'npm-test',
    cmd: 'npm test',
    run: function () { execFileSync(npmCmd, ['test'], { stdio: 'inherit', cwd: PROJECT }); }
  },
  {
    id: 'live-diff',
    cmd: 'npm run live-verify',
    run: function () { execFileSync(npmCmd, ['run', 'live-verify'], { stdio: 'inherit', cwd: PROJECT }); }
  },
  {
    id: 'accel-e2e',
    cmd: 'npm run accel-e2e',
    run: function () { execFileSync(npmCmd, ['run', 'accel-e2e'], { stdio: 'inherit', cwd: PROJECT }); }
  }
];

function loadState() {
  if (!existsSync(STATE_FILE)) { return { steps: {}, started: new Date().toISOString() }; }
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch (e) { return { steps: {}, started: new Date().toISOString() }; }
}
function saveState(s) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

var args = process.argv.slice(2);
var resume = args.indexOf('--resume') >= 0;
var wantAll = args.indexOf('--all') >= 0;
var wantStep = '';
for (var i = 0; i < args.length; i++) {
  if (args[i] === '--step' && i + 1 < args.length) { wantStep = args[i + 1]; }
}

var state = loadState();
if (!state.steps) { state.steps = {}; }

for (var si = 0; si < STEPS.length; si++) {
  var step = STEPS[si];
  if (wantStep && step.id !== wantStep) { continue; }
  var st = state.steps[step.id] || { status: 'pending' };
  // crash recovery: a stale 'running' means the previous attempt was killed mid-step
  if (st.status === 'running' && resume) {
    console.log('[acceptance] ' + step.id + ': stale running marker (crash?) — re-running');
    st = { status: 'pending' };
  }
  if (st.status === 'done' && !wantAll && !wantStep) {
    console.log('[acceptance] ' + step.id + ': already done (' + (st.finished || '') + ') — skipped (--all to re-run)');
    continue;
  }
  console.log('[acceptance] ' + step.id + ': RUNNING (' + step.cmd + ')');
  st.status = 'running';
  st.started = new Date().toISOString();
  state.steps[step.id] = st;
  saveState(state);
  try {
    step.run();
    st.status = 'done';
    st.finished = new Date().toISOString();
    st.result = 'ok';
    state.steps[step.id] = st;
    saveState(state);
    console.log('[acceptance] ' + step.id + ': DONE');
  } catch (e) {
    st.status = 'failed';
    st.finished = new Date().toISOString();
    st.result = String((e.stdout || e.message || e) + '').slice(0, 4000);
    state.steps[step.id] = st;
    saveState(state);
    console.error('[acceptance] ' + step.id + ': FAILED — ' + st.result.slice(0, 800));
    process.exit(1);
  }
}

console.log('[acceptance] all requested steps complete. State: ' + STATE_FILE);
