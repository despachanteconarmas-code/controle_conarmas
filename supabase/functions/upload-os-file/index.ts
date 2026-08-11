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
    const osId = url.pathname.split('/')[2] // /upload-os-file/{osId}

    if (!osId) {
      return new Response(
        JSON.stringify({ error: 'OS ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se a OS existe
    const { data: serviceOrder, error: osError } = await supabase
      .from('service_orders')
      .select('id')
      .eq('id', osId)
      .single()

    if (osError || !serviceOrder) {
      console.error('Service order not found:', osError)
      return new Response(
        JSON.stringify({ error: 'Service order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Verificar limite de arquivos por OS (10)
    const { count } = await supabase
      .from('service_order_files')
      .select('*', { count: 'exact', head: true })
      .eq('service_order_id', osId)

    if (count && count >= 10) {
      return new Response(
        JSON.stringify({ error: 'Maximum 10 files per service order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar nome único para o arquivo
    const fileExtension = file.name.split('.').pop()
    const uniqueId = crypto.randomUUID()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storageKey = `os/${osId}/${uniqueId}_${sanitizedName}`

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

    // Salvar metadados no banco
    const { data: fileRecord, error: dbError } = await supabase
      .from('service_order_files')
      .insert({
        service_order_id: osId,
        storage_key: storageKey,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Limpar arquivo do storage se falhar no banco
      await supabase.storage.from('os-attachments').remove([storageKey])
      
      return new Response(
        JSON.stringify({ error: 'Failed to save file metadata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        file: fileRecord
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