'use strict';
// window.SUPABASE_CONFIG est défini par js/env.js
var supabase = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);
