'use strict';
const assert = require('assert');

// Mock supabase global (fonctions async non testées ici — elles appellent le réseau)
global.supabase = { auth: {} };
// Mock window.location pour éviter une erreur dans Node
global.window = { location: { href: '' } };

const { getUserRole } = require('../js/auth.js');

// 1. Rôle staff
const staffSession = { user: { user_metadata: { role: 'staff' } } };
assert.strictEqual(getUserRole(staffSession), 'staff', 'getUserRole retourne staff');

// 2. Rôle user
const userSession = { user: { user_metadata: { role: 'user' } } };
assert.strictEqual(getUserRole(userSession), 'user', 'getUserRole retourne user');

// 3. Session null
assert.strictEqual(getUserRole(null), null, 'getUserRole retourne null si pas de session');

// 4. user_metadata absent
const emptySession = { user: {} };
assert.strictEqual(getUserRole(emptySession), null, 'getUserRole retourne null si user_metadata absent');

// 5. user absent
const noUser = {};
assert.strictEqual(getUserRole(noUser), null, 'getUserRole retourne null si user absent');

console.log('✓ test-auth.js OK');
