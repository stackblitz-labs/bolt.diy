# Data Model – Phase 1 Implementation Plan

This document translates the Phase 1 specification into concrete entities, fields, and relationships used across the crawler, content, and website agents plus persistence services.

## Entity Overview

| Entity | Purpose | Relationships |
|--------|---------|---------------|
| `Tenant` | Represents a single restaurant/customer operating inside HuskIT. | Has many `Users`, `BusinessProfiles`, `CrawledData`, and `SiteSnapshots`. |
| `BusinessProfile` | Canonical, AI-enhanced representation of a tenant’s brand, menu, and design system. | Belongs to `Tenant`; referenced by `SiteSnapshots`. |
| `CrawledData` | Cached raw payloads fetched from Google Places or supplied URLs. | Belongs to `Tenant`; may hydrate multiple `BusinessProfiles`. |
| `MasterContent` | Transient artifact exchanged between Content and Website agents describing template selection + structured copy. | References `BusinessProfile`, Template ID, and hero asset pointers. |
| `CommandIntent` | Structured instruction produced by the Modification Orchestrator from user prompts. | References target workspace/template files tied to a `Tenant` session. |
| `SiteSnapshot` | Versioned archive of a generated site plus metadata for restoration. | Belongs to `Tenant`; references `BusinessProfile` and Template ID. |

## Tenant

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Primary key, mirrors Supabase Auth user tenant. |
| `business_name` | string (≤255) | Required. |
| `status` | enum(`active`,`suspended`,`archived`) | Default `active`; determines feature availability. |
| `created_at` / `updated_at` | timestamptz | Auto-managed. |

State transitions: `active` → `suspended` (non-payment); `suspended` → `active` (payment received); `active`/`suspended` → `archived` (offboarded). Only `active` tenants can trigger generation or edits.

## BusinessProfile

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Primary key. |
| `tenant_id` | UUID (FK) | Required. |
| `google_place_id` | string | Optional but recommended for reliable re-crawls. |
| `gmaps_url` | string | Required for provenance; validated URL. |
| `logo_url` | string | Optional; must be HTTPS. |
| `contact_info` | JSONB | Schema: `{ phone, email }` (strings, sanitized). |
| `address` | JSONB | Schema: `{ street, city, state, zip }`. |
| `hours_of_operation` | JSONB | Array of `{ day, open, close }`; validated for chronological order. |
| `ai_generated_copy` | JSONB | Contains hero, about, CTA, testimonials intro strings; required. |
| `ai_extracted_themes` | JSONB | `{ themes: string[], popular_dishes: string[] }`; optional. |
| `menu` | JSONB | Array of categories each with items `[ { name, price, description, image_url? } ]`; price normalized as numeric + currency. |
| `gallery_images` | JSONB | Array of `{ url, alt_text }`; max 20 entries. |
| `testimonials` | JSONB | Array of `{ quote, author, rating, source_url? }` with length ≤50. |
| `design_system` | JSONB | `{ primary_color, secondary_color, accent_color, font_family }` validated via regex. |
| `created_at` / `updated_at` | timestamptz | Auto-managed. |

Lifecycle: Created after successful content synthesis; updates occur via edit commands; snapshots reference the current version.

## CrawledData

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Primary key. |
| `tenant_id` | UUID (FK) | Required. |
| `source_url` | string | Required; validated URL. |
| `raw_data_blob` | JSONB | Required raw API output; ≤2 MB. |
| `status` | enum(`pending`,`completed`,`failed`) | Drives retry logic. |
| `crawled_at` | timestamptz | Required. |

Usage: Serves as cache for reprocessing; when `status=failed`, orchestrator surfaces diagnostics and offers manual data entry.

## MasterContent (Transient)

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `tenant_id` | UUID | Required; ties to session. |
| `template_id` | string | Must exist in template registry. |
| `brand_summary` | string | 1–2 paragraphs summarizing themes. |
| `hero_copy` | object | `{ headline, subheadline, cta_label }`. |
| `sections` | JSON | Structured copy for about/menu/testimonials. |
| `menu_items` | JSON | Flattened list derived from BusinessProfile menu with canonical IDs. |
| `testimonials` | JSON | Selected quotes referencing source review IDs. |
| `design_tokens` | JSON | Inherits from BusinessProfile.design_system but adds derived palette + typography scale. |
| `hero_image` | object | `{ url, alt_text, source }` referencing generated or provided imagery. |
| `metadata` | object | `{ crawl_id, profile_id, generated_at }`. |

Stored temporarily in WebContainer workspace and event payloads; not persisted once snapshot saved.

## CommandIntent

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Client-generated for tracking. |
| `tenant_id` | UUID | Required. |
| `command_type` | enum(`update_file`,`insert_block`,`replace_color`,`fallback_form`) | Determines executor path. |
| `file_path` | string | Must live under workspace root (e.g., `src/data/content.json`). |
| `json_path` | string | JSON pointer/Path notation validated before execution. |
| `proposed_value` | JSON | Value to set; must satisfy schema. |
| `confidence` | float 0–1 | Derived from classifier. |
| `submitted_at` | timestamptz | Required. |
| `status` | enum(`pending`,`applied`,`rejected`) | Drives UI feedback. |

## SiteSnapshot

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Primary key. |
| `tenant_id` | UUID (FK) | Required. |
| `business_profile_id` | UUID (FK) | Required. |
| `template_id` | string | Must exist in registry. |
| `workspace_archive_url` | string | HTTPS link to R2/S3 object. |
| `version_label` | string (≤255) | User-provided; sanitized. |
| `created_at` | timestamptz | Required. |

State transitions: Created via snapshot save; remains immutable. Restore flow copies archive into new workspace and logs action.

## Relationships Summary

- `Tenant` 1—N `BusinessProfile`, `CrawledData`, `SiteSnapshot`
- `BusinessProfile` references latest `CrawledData` entry used to create it.
- `MasterContent` references `Tenant`, `BusinessProfile`, `CrawledData`, and Template.
- `CommandIntent` references `Tenant` (and implicitly the current workspace/template).
- `SiteSnapshot` references `BusinessProfile` + Template and points to object storage artifact.

## Validation & Instrumentation Hooks

- All persisted JSON fields validated via shared Zod schemas inside `app/lib/modules/templates/schema.ts`.
- Mutation paths emit telemetry: `tenant_id`, `command_type`, success/failure, latency.
- Snapshot saves capture archive size and upload duration for monitoring storage costs.

