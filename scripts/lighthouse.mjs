import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [label = 'after', url = 'http://127.0.0.1:5183/', count = '1'] = process.argv.slice(2);
const runs = Number(count);
if (!/^[a-z0-9-]+$/.test(label) || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || !Number.isInteger(runs) || runs < 1 || runs > 5) {
  throw new Error('Usar un nombre simple, una URL local de prueba y de 1 a 5 mediciones.');
}
mkdirSync('qa-artifacts', { recursive: true });
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const results = [];
for (let run = 1; run <= runs; run++) {
  const output = resolve(`qa-artifacts/lighthouse-${label}${runs > 1 ? `-${run}` : ''}`);
  const args = [resolve('node_modules/lighthouse/cli/index.js'), url,
    '--chrome-flags=--headless --no-sandbox', '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json', '--output=html', `--output-path=${output}`, '--quiet'];
  if (existsSync(chrome)) args.push(`--chrome-path=${chrome}`);
  await new Promise((complete, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? complete() : reject(new Error(`Lighthouse terminó con código ${code}`)));
  });
  const report = JSON.parse(readFileSync(`${output}.report.json`, 'utf8'));
  const result = {
    scores: Object.fromEntries(Object.entries(report.categories).map(([key, value]) => [key, Math.round(value.score * 100)])),
    metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'].map(key => [key, report.audits[key].numericValue])),
    report: `${output}.report.html`,
  };
  results.push(result);
  console.log(JSON.stringify({ run, ...result }));
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = { url, runs: results, medianScores: Object.fromEntries(Object.keys(results[0].scores).map(key => [key, median(results.map(result => result.scores[key]))])), medianMetrics: Object.fromEntries(Object.keys(results[0].metrics).map(key => [key, median(results.map(result => result.metrics[key]))])) };
writeFileSync(`qa-artifacts/lighthouse-${label}-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ medianScores: summary.medianScores, medianMetrics: summary.medianMetrics }));
