// tests/run-all.js
'use strict';
const { execSync } = require('child_process');
const tests = ['test-slots.js', 'test-timer.js', 'test-storage.js', 'test-pass.js', 'test-auth.js', 'test-supabase-inscriptions.js', 'test-supabase-mc.js', 'test-supabase-storage.js', 'test-inscription-publique.js'];
tests.forEach(f => {
  execSync(`node tests/${f}`, { stdio: 'inherit' });
});
console.log('\n✅ Tous les tests passent.');
