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
    const osId = url.pathname.split('/')[2] // /get-os-files/{osId}

    if (!osId) {
      return new Response(
        JSON.stringify({ error: 'OS ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar arquivos da OS
    const { data: files, error: filesError } = await supabase
      .from('service_order_files')
      .select('*')
      .eq('service_order_id', osId)
      .order('created_at', { ascending: false })

    if (filesError) {
      console.error('Files query error:', filesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch files' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar URLs assinadas para cada arquivo (válidas por 7 dias)
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const { data: signedUrl, error: urlError } = await supabase.storage
          .from('os-attachments')
          .createSignedUrl(file.storage_key, 7 * 24 * 60 * 60) // 7 dias em segundos

        if (urlError) {
          console.error('Signed URL error:', urlError)
          return {
            ...file,
            file_url_signed: null
          }
        }

        return {
          ...file,
          file_url_signed: signedUrl.signedUrl
        }
      })
    )

    return new Response(
      JSON.stringify({
        success: true,
        files: filesWithUrls
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