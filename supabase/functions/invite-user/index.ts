import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Vérifier l'Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  // Vérifier que l'appelant est bien staff
  const callerClient = createClient(supabaseUrl, anonKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userError } = await callerClient.auth.getUser(token)

  if (userError || !user || user.user_metadata?.role !== 'staff') {
    return new Response(JSON.stringify({ error: 'Accès refusé — réservé au staff' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Lire le body
  let email: string
  let inscriptionId: string | undefined
  try {
    const body = await req.json()
    email = body.email
    inscriptionId = body.inscriptionId
  } catch {
    return new Response(JSON.stringify({ error: 'Corps de requête JSON invalide' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!email) {
    return new Response(JSON.stringify({ error: 'email requis' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Inviter l'usager (requiert service role)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const siteUrl = Deno.env.get('SITE_URL') ?? ''
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    { data: { role: 'user' }, redirectTo: siteUrl + '/login.html' }
  )

  if (inviteError) {
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Lier le user_id à l'inscription si fourni
  if (inscriptionId && invited.user) {
    await adminClient
      .from('inscriptions')
      .update({ user_id: invited.user.id })
      .eq('id', inscriptionId)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
