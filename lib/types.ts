export type JobStatus = "queued" | "running" | "done" | "failed";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  price_monthly: number;
  monthly_quota: number | null;
  day_pass_hours: number | null;
  stripe_price_id: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_slug: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_sub_id: string | null;
  created_at: string;
}

export interface GeocodeCache {
  id: string;
  query_text: string;
  lat: number;
  lon: number;
  display_name: string | null;
  bbox: Record<string, number> | null;
  provider: string;
  created_at: string;
}

export interface PosterMarker {
  lat: number;
  lon: number;
  label: string;
}

export interface PosterConfig {
  style_id: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  distance: number;
  width: number;
  height: number;
  orientation: "portrait" | "landscape" | "square";
  show_labels: boolean;
  show_water: boolean;
  show_parks: boolean;
  major_roads_only: boolean;
  show_border: boolean;
  title: string;
  subtitle: string;
  date_line: string;
  show_coordinates: boolean;
  format: "png" | "pdf" | "svg";
  // Advanced map framing & overlays
  rotation: number;
  offset_x: number;
  offset_y: number;
  markers: PosterMarker[];
  gpx_data: string;
}

export interface PosterJob {
  id: string;
  user_id: string;
  status: JobStatus;
  input: PosterConfig;
  config_hash: string;
  output: PosterJobOutput | null;
  error: string | null;
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface PosterJobOutput {
  pdf?: string;
  png_24x36?: string;
  png_18x24?: string;
  png_12x18?: string;
  png_11x14?: string;
  png_8x10?: string;
  preview?: string;
  svg?: string;
}

export interface Poster {
  id: string;
  user_id: string;
  job_id: string;
  title: string;
  subtitle: string | null;
  location_text: string;
  config: PosterConfig;
  config_hash: string;
  storage_paths: PosterJobOutput;
  preview_url: string | null;
  created_at: string;
}

export interface Usage {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  posters_generated: number;
}

export type OrderStatus =
  | "created"
  | "paid"
  | "submitting"
  | "submitted"
  | "in_production"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled";

export interface PosterOrder {
  id: string;
  user_id: string;
  job_id: string | null;
  config: PosterConfig;
  config_hash: string;
  size_key: string;
  product_uid: string;
  quantity: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  post_code: string;
  country: string;
  currency: string;
  amount_total: number | null;
  amount_product: number | null;
  amount_shipping: number | null;
  markup: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent: string | null;
  gelato_order_id: string | null;
  gelato_order_reference_id: string | null;
  status: OrderStatus;
  tracking_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export const STYLE_PRESETS: Record<
  string,
  { name: string; bgColor: string; textColor: string }
> = {
  warm_beige: { name: "Classic", bgColor: "#F5F0E8", textColor: "#6B5B4F" },
  terracotta: { name: "Terracotta", bgColor: "#F5EDE4", textColor: "#8B4513" },
  noir: { name: "Noir", bgColor: "#000000", textColor: "#FFFFFF" },
  blueprint: { name: "Blueprint", bgColor: "#1A3A5C", textColor: "#E8F4FF" },
  midnight_blue: { name: "Night", bgColor: "#0A1628", textColor: "#D4AF37" },
  ocean: { name: "Ocean", bgColor: "#F0F8FA", textColor: "#1A5F7A" },
  forest: { name: "Forest", bgColor: "#F0F4F0", textColor: "#2D4A3E" },
  sunset: { name: "Sunset", bgColor: "#FDF5F0", textColor: "#C45C3E" },
  autumn: { name: "Autumn", bgColor: "#FBF7F0", textColor: "#8B4513" },
  emerald: { name: "Emerald", bgColor: "#062C22", textColor: "#E3F9F1" },
  copper_patina: { name: "Copper Patina", bgColor: "#E8F0F0", textColor: "#2A5A5A" },
  japanese_ink: { name: "Japanese Ink", bgColor: "#FAF8F5", textColor: "#2C2C2C" },
  pastel_dream: { name: "Pastel Dream", bgColor: "#FAF7F2", textColor: "#5D5A6D" },
  monochrome_blue: { name: "Mono Blue", bgColor: "#F5F8FA", textColor: "#1A3A5C" },
  neon_cyberpunk: { name: "Cyberpunk", bgColor: "#0D0D1A", textColor: "#00FFFF" },
  contrast_zones: { name: "Contrast", bgColor: "#111111", textColor: "#F0F0F0" },
  gradient_roads: { name: "Gradient", bgColor: "#FAF8F5", textColor: "#2C2C2C" },
};

export const POSTER_SIZES = [
  { label: '24"x36"', width: 12, height: 18, key: "png_24x36" },
  { label: '18"x24"', width: 9, height: 12, key: "png_18x24" },
  { label: '12"x18"', width: 6, height: 9, key: "png_12x18" },
  { label: '11"x14"', width: 5.5, height: 7, key: "png_11x14" },
  { label: '8"x10"', width: 4, height: 5, key: "png_8x10" },
] as const;

export const DEFAULT_CONFIG: PosterConfig = {
  style_id: "warm_beige",
  city: "",
  country: "",
  lat: 0,
  lon: 0,
  distance: 10000,
  width: 12,
  height: 16,
  orientation: "portrait",
  show_labels: true,
  show_water: true,
  show_parks: true,
  major_roads_only: false,
  show_border: false,
  title: "",
  subtitle: "",
  date_line: "",
  show_coordinates: false,
  format: "png",
  rotation: 0,
  offset_x: 0,
  offset_y: 0,
  markers: [],
  gpx_data: "",
};
