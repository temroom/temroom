import { createClient } from '@supabase/supabase-js';

// 보내주신 정보를 바탕으로 완성한 URL입니다.
const supabaseUrl = 'https://quxieoqurnjthbveinon.supabase.co';

// 보내주신 Anon Key입니다.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1eGllb3F1cm5qdGhidmVpbm9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTgwMzcsImV4cCI6MjA4NjAzNDAzN30.CTtOcAcvjVf9bgu9t5ebeeaihaqhypVBuHnCC9GPhDg';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Key is missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);