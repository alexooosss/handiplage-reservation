// supabase/functions/send-refusal-email/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey          = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const siteUrl          = Deno.env.get('SITE_URL') ?? ''

  // Vérifier que l'appelant est staff
  const callerClient = createClient(supabaseUrl, anonKey)
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const { data: { user }, error: userError } = await callerClient.auth.getUser(token)
  if (userError || !user || user.user_metadata?.role !== 'staff') {
    return new Response(JSON.stringify({ error: 'Accès refusé' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  let inscriptionId: string, motif: string
  try {
    const body = await req.json()
    inscriptionId = body.inscriptionId
    motif = body.motif
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!inscriptionId || !motif) {
    return new Response(JSON.stringify({ error: 'inscriptionId et motif requis' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Récupérer les infos de l'inscription pour l'email
  const { data: insc, error: inscError } = await adminClient
    .from('inscriptions')
    .select('nom, prenom, mail')
    .eq('id', inscriptionId)
    .single()
  if (inscError || !insc) {
    return new Response(JSON.stringify({ error: 'Inscription introuvable' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Insérer dans messages (token généré automatiquement par DEFAULT)
  const { data: msg, error: msgError } = await adminClient
    .from('messages')
    .insert({ inscription_id: inscriptionId, motif_refus: motif })
    .select('token')
    .single()
  if (msgError || !msg) {
    return new Response(JSON.stringify({ error: 'Erreur création message' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const replyUrl = `${siteUrl}/reponse.html?token=${msg.token}`
  const mailSubject = encodeURIComponent('Handiplage — Décision sur votre demande d\'inscription')
  const mailBody = encodeURIComponent(
    `Madame, Monsieur ${insc.prenom} ${insc.nom},\n\n` +
    `Suite à l'examen de votre demande d'inscription à Handiplage, nous avons le regret de vous informer qu'elle ne peut pas être acceptée pour le motif suivant :\n\n` +
    `${motif}\n\n` +
    `Si vous souhaitez nous adresser des éléments complémentaires ou contester cette décision, vous pouvez répondre via le lien suivant (valable 30 jours) :\n\n` +
    `${replyUrl}\n\n` +
    `Cordialement,\nL'équipe Handiplage — CCAS d'Antibes`
  )
  const mailtoLink = `mailto:${insc.mail}?subject=${mailSubject}&body=${mailBody}`

  return new Response(JSON.stringify({ success: true, mailtoLink, replyUrl }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
