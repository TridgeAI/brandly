-- Brand classification (learning engine phase 0): controlled lists, mirrored from lib/brand/taxonomy.ts.
-- The source of truth is the BrandModel (strategy.industry etc.); these columns are a queryable copy.
alter table public.brands
  add column industry text,
  add column business_model text,
  add column primary_goal text;

alter table public.brands
  add constraint brands_industry_chk check (industry is null or industry in (
    'food_beverage','fashion_apparel','beauty_personal_care','health_wellness','home_decor',
    'jewellery_accessories','electronics_tech','education_coaching','professional_services',
    'real_estate','travel_hospitality','fitness_sports','arts_media_entertainment','b2b_saas','other')),
  add constraint brands_business_model_chk check (business_model is null or business_model in (
    'd2c_ecommerce','local_store','service_business','b2b','creator','marketplace_seller','other')),
  add constraint brands_primary_goal_chk check (primary_goal is null or primary_goal in (
    'sales','leads','awareness','engagement','footfall','retention'));

create index brands_industry_idx on public.brands(industry) where industry is not null;
