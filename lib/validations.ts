import { z } from "zod";

export const locationSchema = z.object({
  city: z.string().min(1, "City is required").max(200),
  country: z.string().min(1, "Country is required").max(200),
  location_text: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
});

export const posterConfigSchema = z.object({
  style_id: z.enum([
    "warm_beige", "terracotta", "noir", "blueprint", "midnight_blue",
    "ocean", "forest", "sunset", "autumn", "emerald",
    "copper_patina", "japanese_ink", "pastel_dream", "monochrome_blue",
    "neon_cyberpunk", "contrast_zones", "gradient_roads",
  ]),
  city: z.string().min(1).max(200),
  country: z.string().max(200).default(""),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  distance: z.number().min(1000).max(50000),
  width: z.number().min(3).max(20),
  height: z.number().min(3).max(20),
  orientation: z.enum(["portrait", "landscape", "square"]),
  show_labels: z.boolean(),
  show_water: z.boolean(),
  show_parks: z.boolean(),
  major_roads_only: z.boolean(),
  show_border: z.boolean(),
  title: z.string().max(200),
  subtitle: z.string().max(200),
  date_line: z.string().max(100),
  show_coordinates: z.boolean().default(true),
  format: z.enum(["png", "pdf", "svg"]),
  // Advanced map framing & overlays (all optional with defaults so older
  // clients and cached configs keep validating).
  rotation: z.number().min(-180).max(180).default(0),
  offset_x: z.number().min(-50000).max(50000).default(0),
  offset_y: z.number().min(-50000).max(50000).default(0),
  markers: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        label: z.string().max(60).default(""),
      })
    )
    .max(20)
    .default([]),
  // Raw GPX XML embedded directly so the worker can materialize it to a temp
  // file. Capped to keep job payloads and the config hash reasonable.
  gpx_data: z.string().max(500_000).default(""),
});

export const createJobSchema = z.object({
  config: posterConfigSchema,
  is_preview: z.boolean().default(false),
});

export const shippingAddressSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  address_line1: z.string().min(1, "Address is required").max(200),
  address_line2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(1, "City is required").max(120),
  state: z.string().max(120).optional().or(z.literal("")),
  post_code: z.string().min(1, "Postal code is required").max(40),
  country: z
    .string()
    .length(2, "Country must be a 2-letter ISO code")
    .transform((s) => s.toUpperCase()),
});

export const orderQuoteSchema = z.object({
  size_key: z.string().min(1).max(40),
  orientation: z.enum(["portrait", "landscape", "square"]).default("portrait"),
  quantity: z.number().int().min(1).max(50).default(1),
  country: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase()),
  // Optional partial recipient details so the live quote can refine pricing
  // (state + postCode in particular) as the user fills in the address form.
  // The Gelato client pads safe placeholders for any field left blank.
  state: z.string().max(120).optional().or(z.literal("")),
  post_code: z.string().max(40).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
});

export const createOrderSchema = z.object({
  config: posterConfigSchema,
  size_key: z.string().min(1).max(40),
  orientation: z.enum(["portrait", "landscape", "square"]).default("portrait"),
  quantity: z.number().int().min(1).max(50).default(1),
  shipping: shippingAddressSchema,
});

export type LocationInput = z.infer<typeof locationSchema>;
export type PosterConfigInput = z.infer<typeof posterConfigSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type OrderQuoteInput = z.infer<typeof orderQuoteSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
