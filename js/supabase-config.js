// js/supabase-config.js
const SUPABASE_URL = "https://ovygjftgflmrrjasixri.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eWdqZnRnZmxtcnJqYXNpeHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzE5MjEsImV4cCI6MjEwNDQwNzkyMX0.Dcb-Vu2zC_43dP4qn9gFxfaXLNRL5xMmvESOSEO5RGE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
