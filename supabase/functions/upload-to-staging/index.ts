import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const sessionId = url.pathname.split('/').pop()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar tipo de arquivo
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/quicktime'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'File type not allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar tamanho (25MB)
    if (file.size > 25 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 25MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar limite de arquivos por sessão (10)
    const { data: existingFiles } = await supabase.storage
      .from('os-attachments')
      .list(`staging/${sessionId}`)

    if (existingFiles && existingFiles.length >= 10) {
      return new Response(
        JSON.stringify({ error: 'Maximum 10 files per service order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar nome único para o arquivo
    const uniqueId = crypto.randomUUID()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storageKey = `staging/${sessionId}/${uniqueId}_${sanitizedName}`

    // Upload para Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('os-attachments')
      .upload(storageKey, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Upload failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          id: uniqueId,
          storage_key: storageKey,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
