/** Controlled lists for brand classification. Mirrored by the check constraints in migration 0005. */

export const INDUSTRIES = [
  { key: "food_beverage", label: "Food & beverage" },
  { key: "fashion_apparel", label: "Fashion & apparel" },
  { key: "beauty_personal_care", label: "Beauty & personal care" },
  { key: "health_wellness", label: "Health & wellness" },
  { key: "home_decor", label: "Home & decor" },
  { key: "jewellery_accessories", label: "Jewellery & accessories" },
  { key: "electronics_tech", label: "Electronics & tech" },
  { key: "education_coaching", label: "Education & coaching" },
  { key: "professional_services", label: "Professional services" },
  { key: "real_estate", label: "Real estate" },
  { key: "travel_hospitality", label: "Travel & hospitality" },
  { key: "fitness_sports", label: "Fitness & sports" },
  { key: "arts_media_entertainment", label: "Arts, media & entertainment" },
  { key: "b2b_saas", label: "B2B software" },
  { key: "other", label: "Other" },
] as const;

export const BUSINESS_MODELS = [
  { key: "d2c_ecommerce", label: "Online store (D2C)" },
  { key: "local_store", label: "Local store" },
  { key: "service_business", label: "Service business" },
  { key: "b2b", label: "B2B" },
  { key: "creator", label: "Creator" },
  { key: "marketplace_seller", label: "Marketplace seller" },
  { key: "other", label: "Other" },
] as const;

export const PRIMARY_GOALS = [
  { key: "sales", label: "Sales" },
  { key: "leads", label: "Leads" },
  { key: "awareness", label: "Awareness" },
  { key: "engagement", label: "Engagement" },
  { key: "footfall", label: "Store footfall" },
  { key: "retention", label: "Retention" },
] as const;

export type Industry = (typeof INDUSTRIES)[number]["key"];
export type BusinessModel = (typeof BUSINESS_MODELS)[number]["key"];
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number]["key"];

export const INDUSTRY_KEYS = INDUSTRIES.map((i) => i.key) as [Industry, ...Industry[]];
export const BUSINESS_MODEL_KEYS = BUSINESS_MODELS.map((i) => i.key) as [BusinessModel, ...BusinessModel[]];
export const PRIMARY_GOAL_KEYS = PRIMARY_GOALS.map((i) => i.key) as [PrimaryGoal, ...PrimaryGoal[]];
