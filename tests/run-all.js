// tests/run-all.js
'use strict';
const { execSync } = require('child_process');
const tests = ['test-slots.js', 'test-timer.js', 'test-storage.js'];
tests.forEach(f => {
  execSync(`node tests/${f}`, { stdio: 'inherit' });
});
console.log('\n✅ Tous les tests passent.');
