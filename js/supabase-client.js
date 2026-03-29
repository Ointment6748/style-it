// Supabase client initialization using Vite environment variables
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

window.STORAGE_BUCKET = 'wardrobe-images';

window.db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
