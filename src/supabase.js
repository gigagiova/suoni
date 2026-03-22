import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function fetchSounds() {
  const { data, error } = await supabase
    .from('sounds')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export function getSoundUrl(filePath) {
  const { data } = supabase.storage.from('sounds').getPublicUrl(filePath)
  return data.publicUrl
}
