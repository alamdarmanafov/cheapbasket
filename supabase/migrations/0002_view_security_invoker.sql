-- Fix Supabase advisor: "View public.product_prices is defined with the SECURITY DEFINER property"
alter view public.product_prices set (security_invoker = true);
