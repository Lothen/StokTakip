import { createClient } from '@supabase/supabase-js'

// Supabase panelinden Project Settings -> API kısmından bu bilgileri alıp tırnak içlerine yapıştırın  v
const supabaseUrl = 'https://kepayowtyrnphepvsvsr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcGF5b3d0eXJucGhlcHZzdnNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDA2NDYsImV4cCI6MjA4MzQ3NjY0Nn0.eqYzxCXwQqdeILX8dNcpwHgLpcOryLYFm4I4ARghNnM'

export const supabase = createClient(supabaseUrl, supabaseKey)