-- 0017_tenant_name_not_unique.sql
-- The godown is listed under its tenant's name (D-032), so two godowns can legitimately share a name (two tenants called
-- "Kumar", or a returning tenant). The old rule "property names are unique" (0003) would reject that, so it is removed.
drop index if exists public.properties_name_key;
