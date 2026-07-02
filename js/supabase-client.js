'use strict';
// window.SUPABASE_CONFIG est défini par js/env.js
if (!window.SUPABASE_CONFIG) {
  throw new Error('SUPABASE_CONFIG manquant. Copier js/env.example.js vers js/env.js et remplir les valeurs.');
}
const supabase = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);
