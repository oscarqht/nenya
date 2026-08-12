import { performance } from 'perf_hooks';

const highlight = {
  type: 'regex',
  value: '\\b(foo|bar)\\b', // simple regex
  ignoreCase: true
};

const textContent = "Here is some foo text and some bar text to match against repeated many times. foo bar foo bar foo bar.";
const iterations = 100000;

function runBaseline() {
  const start = performance.now();
  let matchCount = 0;
  for (let i = 0; i < iterations; i++) {
    // Current implementation: create RegExp every time
    const flags = highlight.ignoreCase ? 'gi' : 'g';
    const regex = new RegExp(highlight.value, flags);
    const matches = [...textContent.matchAll(regex)];
    matchCount += matches.length;
  }
  const end = performance.now();
  return { time: end - start, matchCount };
}

function runOptimized() {
  // Pre-compile
  const flags = highlight.ignoreCase ? 'gi' : 'g';
  const regex = new RegExp(highlight.value, flags);

  const start = performance.now();
  let matchCount = 0;
  for (let i = 0; i < iterations; i++) {
    // Optimized: reuse RegExp
    const matches = [...textContent.matchAll(regex)];
    matchCount += matches.length;
  }
  const end = performance.now();
  return { time: end - start, matchCount };
}

console.log("Running Baseline...");
const baseline = runBaseline();
console.log(`Baseline: ${baseline.time.toFixed(2)}ms (matches: ${baseline.matchCount})`);

console.log("Running Optimized...");
const optimized = runOptimized();
console.log(`Optimized: ${optimized.time.toFixed(2)}ms (matches: ${optimized.matchCount})`);

console.log(`Speedup: ${(baseline.time / optimized.time).toFixed(2)}x`);
