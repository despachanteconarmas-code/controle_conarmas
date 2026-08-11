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

    const { upload_session_id, service_order_id } = await req.json()

    if (!upload_session_id || !service_order_id) {
      return new Response(
        JSON.stringify({ error: 'Session ID and Service Order ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Finalizing upload session:', upload_session_id, 'for OS:', service_order_id)

    // Verificar se a OS existe
    const { data: serviceOrder, error: osError } = await supabase
      .from('service_orders')
      .select('id')
      .eq('id', service_order_id)
      .single()

    if (osError || !serviceOrder) {
      console.error('Service order not found:', osError)
      return new Response(
        JSON.stringify({ error: 'Service order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Listar arquivos na pasta de staging
    const { data: stagingFiles, error: listError } = await supabase.storage
      .from('os-attachments')
      .list(`staging/${upload_session_id}`)

    if (listError) {
      console.error('Error listing staging files:', listError)
      return new Response(
        JSON.stringify({ error: 'Failed to list staging files' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!stagingFiles || stagingFiles.length === 0) {
      console.log('No files to finalize')
      return new Response(
        JSON.stringify({ success: true, files_moved: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found staging files:', stagingFiles.length)

    // Mover cada arquivo de staging para a pasta da OS
    const movedFiles = []
    for (const file of stagingFiles) {
      const oldPath = `staging/${upload_session_id}/${file.name}`
      const newPath = `os/${service_order_id}/${file.name}`

      console.log('Moving file:', oldPath, '->', newPath)

      // Copiar arquivo
      const { data: copyData, error: copyError } = await supabase.storage
        .from('os-attachments')
        .copy(oldPath, newPath)

      if (copyError) {
        console.error('Error copying file:', copyError)
        continue
      }

      // Obter metadados do arquivo
      const { data: fileData } = await supabase.storage
        .from('os-attachments')
        .download(newPath)

      if (fileData) {
        // Salvar metadados no banco
        const originalName = file.name.split('_').slice(1).join('_')
        const { error: dbError } = await supabase
          .from('service_order_files')
          .insert({
            service_order_id: service_order_id,
            storage_key: newPath,
            original_name: originalName,
            mime_type: fileData.type,
            size_bytes: fileData.size
          })

        if (dbError) {
          console.error('Error saving file metadata:', dbError)
        } else {
          movedFiles.push(file.name)
        }
      }

      // Deletar arquivo original do staging
      await supabase.storage
        .from('os-attachments')
        .remove([oldPath])
    }

    console.log('Moved files:', movedFiles.length)

    return new Response(
      JSON.stringify({
        success: true,
        files_moved: movedFiles.length
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
