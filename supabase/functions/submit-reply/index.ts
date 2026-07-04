// supabase/functions/submit-reply/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non supportée' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  let token: string, contenu: string
  try {
    const body = await req.json()
    token   = body.token
    contenu = body.contenu
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!token || !contenu || contenu.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'token et contenu (min 10 car.) requis' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const adminClient    = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Vérifier le token
  const { data: msg, error: msgError } = await adminClient
    .from('messages')
    .select('id, token_expires_at, contenu')
    .eq('token', token)
    .single()

  if (msgError || !msg) {
    return new Response(JSON.stringify({ error: 'Lien invalide ou expiré' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (new Date(msg.token_expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Ce lien a expiré (30 jours). Contactez directement l\'équipe Handiplage.' }), {
      status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (msg.contenu) {
    return new Response(JSON.stringify({ error: 'Une réponse a déjà été envoyée pour ce dossier.' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Enregistrer la réponse
  const { error: updateError } = await adminClient
    .from('messages')
    .update({ contenu: contenu.trim() })
    .eq('id', msg.id)

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
