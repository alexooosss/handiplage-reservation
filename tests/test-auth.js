'use strict';
const assert = require('assert');

// Mock supabase global (fonctions async non testées ici — elles appellent le réseau)
global.supabase = { auth: {} };
// Mock window.location pour éviter une erreur dans Node
global.window = { location: { href: '' } };

const { getUserRole, estResponsable } = require('../js/auth.js');

// 1. Rôle staff
const staffSession = { user: { app_metadata: { role: 'staff' } } };
assert.strictEqual(getUserRole(staffSession), 'staff', 'getUserRole retourne staff');

// 2. Rôle user
const userSession = { user: { app_metadata: { role: 'user' } } };
assert.strictEqual(getUserRole(userSession), 'user', 'getUserRole retourne user');

// 3. Session null
assert.strictEqual(getUserRole(null), null, 'getUserRole retourne null si pas de session');

// 4. app_metadata absent
const emptySession = { user: {} };
assert.strictEqual(getUserRole(emptySession), null, 'getUserRole retourne null si app_metadata absent');

// 4b. Sécurité : un rôle posé par l'usager lui-même dans user_metadata est ignoré
assert.strictEqual(getUserRole({ user: { user_metadata: { role: 'staff' }, app_metadata: { role: 'user' } } }), 'user', 'user_metadata ne donne aucun droit');
assert.strictEqual(getUserRole({ user: { user_metadata: { role: 'staff' } } }), null, 'user_metadata seul ne donne aucun rôle');

// 4c. Responsable
assert.strictEqual(estResponsable({ user: { app_metadata: { role: 'staff', responsable: true } } }), true, 'staff responsable');
assert.strictEqual(estResponsable(staffSession), false, 'staff simple non responsable');
assert.strictEqual(estResponsable({ user: { app_metadata: { role: 'user', responsable: true } } }), false, 'un usager ne peut pas être responsable');
assert.strictEqual(estResponsable({ user: { user_metadata: { role: 'staff', responsable: true } } }), false, 'user_metadata ignoré pour responsable');

// 5. user absent
const noUser = {};
assert.strictEqual(getUserRole(noUser), null, 'getUserRole retourne null si user absent');

console.log('✓ test-auth.js OK');
