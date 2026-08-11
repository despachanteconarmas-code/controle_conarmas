import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    // Suporte a dois formatos:
    // 1) DELETE /delete-os-file/{osId}/{fileId}
    // 2) POST   /delete-os-file  com body { osId, fileId }
    let osId: string | undefined
    let fileId: string | undefined

    if (req.method === 'DELETE') {
      const pathParts = url.pathname.split('/').filter(Boolean)
      fileId = pathParts[pathParts.length - 1]
      osId = pathParts[pathParts.length - 2]
    } else if (req.method === 'POST') {
      try {
        const body = await req.json()
        osId = body.osId || body.os_id
        fileId = body.fileId || body.file_id
      } catch (error) {
        console.error('Error parsing JSON:', error)
        return new Response(
          JSON.stringify({ error: 'Invalid JSON body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (!osId || !fileId) {
      return new Response(
        JSON.stringify({ error: 'OS ID and File ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar arquivo para obter storage_key
    const { data: file, error: fileError } = await supabase
      .from('service_order_files')
      .select('*')
      .eq('id', fileId)
      .eq('service_order_id', osId)
      .single()

    if (fileError || !file) {
      console.error('File not found:', fileError)
      return new Response(
        JSON.stringify({ error: 'File not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deletar do Storage
    const { error: storageError } = await supabase.storage
      .from('os-attachments')
      .remove([file.storage_key])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete file from storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deletar do banco
    const { error: dbError } = await supabase
      .from('service_order_files')
      .delete()
      .eq('id', fileId)

    if (dbError) {
      console.error('Database deletion error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete file record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'File deleted successfully'
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