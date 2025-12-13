### 1. The JSON Schema: `production_master_map.json`

```json
{
  "$schema": "http://universal-web-builder.com/schema/v4/master_production",
  "type": "object",
  "description": "The Master Brief for automated SMB website generation.",
  "properties": {
    "business_intelligence": {
      "core_identity": {
        "legal_name": { "type": "string" },
        "brand_display_name": { "type": "string" },
        "tagline_inferred": { "type": "string", "description": "Slogan derived from reviews or existing header" }
      },
      "industry_context": {
        "primary_category": { "type": "string", "description": "e.g., 'Italian Restaurant' or 'Emergency Plumbing'" },
        "price_tier": { "type": "string", "enum": ["Budget", "Standard", "Premium", "Luxury"] },
        "catalog_type": { "type": "string", "enum": ["Service_List", "Menu_Food_Drink", "Portfolio_Projects"] },
        "operational_highlights": {
           "type": "array",
           "items": { "type": "string" },
           "description": "Tags from GMB Attributes e.g. ['Outdoor Seating', '24/7 Service', 'Pet Friendly', 'Wheelchair Accessible']"
        }
      },
      "nap_logistics": {
        "full_address": { "type": "string" },
        "phone_clickable": { "type": "string", "description": "Sanitized for tel: links" },
        "booking_action_url": { "type": "string", "description": "Reservation Link or Contact Form URL" },
        "service_area_text": { "type": "string", "description": "e.g. 'Serving Greater Seattle Area'" }
      },
      "social_ecosystem": {
        "facebook_url": { "type": ["string", "null"] },
        "instagram_url": { "type": ["string", "null"] },
        "whatsapp_number": { "type": ["string", "null"] },
        "linkedin_url": { "type": ["string", "null"] },
        "tiktok_url": { "type": ["string", "null"] }
      },
      "reputation_snapshot": {
        "total_reviews": { "type": "integer" },
        "average_rating": { "type": "number" },
        "trust_badge_text": { "type": "string", "default": "5-Star Rated on Google" }
      }
    },
    "brand_strategy": {
      "inferred_usp": { "type": "string", "description": "The single strongest reason to buy, triangulated from Reviews vs Website" },
      "target_audience_persona": { "type": "string", "description": "e.g., 'Young professionals looking for date spots'" },
      "tone_of_voice": { "type": "string", "description": "Adjectives e.g., 'Warm, Rustic, Authentic'" },
      "visual_style_prompt": { "type": "string", "description": "Global AI art direction prompt e.g. 'Minimalist, excessive whitespace, matte pastel colors'" }
    },
    "visual_asset_strategy": {
      "color_palette_extracted": {
        "primary_hex": { "type": "string" },
        "accent_hex": { "type": "string" },
        "is_dark_mode_suitable": { "type": "boolean", "description": "True if Nightlife/Luxury" }
      },
      "typography_vibe": { "type": "string", "enum": ["Serif_Elegant", "Sans_Clean", "Display_Playful", "Monospace_Technical"] },
      "logo_asset": { "$ref": "#/definitions/smart_media_asset" }
    },
    "sitemap_content_structure": {
      "pages": {
        "type": "array",
        "items": { "$ref": "#/definitions/page_blueprint" }
      }
    }
  },
  "definitions": {
    "smart_media_asset": {
      "type": "object",
      "properties": {
        "asset_decision": { 
          "type": "string", 
          "enum": ["USE_ORIGINAL", "GENERATE_NEW_FROM_SCRATCH", "GENERATE_USING_REFERENCE"],
          "description": "Logic for the builder. USE_ORIGINAL if >800px. GENERATE_USING_REFERENCE if content is good but quality is bad."
        },
        "original_url": { "type": ["string", "null"] },
        "source_type": { "type": "string", "enum": ["GMB_Owner", "GMB_User", "Website_Crawl", "Logo_Extraction"] },
        "alt_text": { "type": "string" },
        "display_context": { "type": "string", "enum": ["Hero_Background", "Card_Thumbnail", "Gallery_Grid", "Avatar", "Logo"] },
        "ai_generation_data": {
          "type": "object",
          "description": "Required if asset_decision is NOT USE_ORIGINAL",
          "properties": {
            "text_prompt": { "type": "string", "description": "Detailed Stable Diffusion/Midjourney prompt" },
            "reference_image_url": { "type": ["string", "null"], "description": "The low-quality URL to use as ControlNet input" },
            "guidance_strength": { "type": "number", "default": 0.5, "description": "How closely to follow the reference shape (0.1 - 1.0)" }
          }
        }
      }
    },
    "catalog_item": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "price_or_value": { "type": "string" },
        "description": { "type": "string" },
        "is_highlight": { "type": "boolean" },
        "image": { "$ref": "#/definitions/smart_media_asset" }
      }
    },
    "review_item": {
      "type": "object",
      "properties": {
        "author_name": { "type": "string" },
        "review_text": { "type": "string" },
        "star_rating": { "type": "integer" },
        "relative_date": { "type": "string" },
        "source_url": { "type": "string" },
        "author_avatar": { "$ref": "#/definitions/smart_media_asset" }
      }
    },
    "page_blueprint": {
      "type": "object",
      "properties": {
        "page_slug": { "type": "string" },
        "page_purpose": { "type": "string", "enum": ["Landing", "Catalog", "Story", "Contact"] },
        "seo_meta": {
          "title": { "type": "string" },
          "description": { "type": "string" }
        },
        "sections": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "section_id": { "type": "string" },
              "section_type": { "type": "string", "enum": ["Hero", "Features_List", "Catalog_Grid", "Social_Vibe_Gallery", "Narrative_Block", "Reviews_Carousel", "Contact_Map", "Call_To_Action_Banner"] },
              "content_payload": {
                "headline": { "type": "string" },
                "subheadline": { "type": "string" },
                "body_copy": { "type": "string" },
                "cta_button": { 
                  "type": "object", 
                  "properties": { "text": { "type": "string" }, "url": { "type": "string" } } 
                }
              },
              "visual_assets": {
                "background_image": { "$ref": "#/definitions/smart_media_asset" },
                "foreground_image": { "$ref": "#/definitions/smart_media_asset" }
              },
              "data_injection": {
                "catalog_items": { "type": "array", "items": { "$ref": "#/definitions/catalog_item" } },
                "reviews": { "type": "array", "items": { "$ref": "#/definitions/review_item" } },
                "gallery_images": { "type": "array", "items": { "$ref": "#/definitions/smart_media_asset" } }
              }
            }
          }
        }
      }
    }
  }
}
```

---


### 2. Example JSON Output (Snippet)

This shows how the schema handles **Reviews**, **Social Links**, and **AI Image Repair**.

```json
{
  "business_intelligence": {
    "core_identity": {
      "legal_name": "Bella Napoli Pizzeria LLC",
      "brand_display_name": "Bella Napoli",
      "tagline_inferred": "Authentic Wood-Fired Taste of Naples"
    },
    "industry_context": {
      "primary_category": "Italian Restaurant",
      "price_tier": "Standard",
      "catalog_type": "Menu_Food_Drink",
      "operational_highlights": ["Outdoor Seating", "Wood-Fired Oven", "Good for Kids"]
    },
    "social_ecosystem": {
      "facebook_url": "https://facebook.com/bellanapoli",
      "instagram_url": "https://instagram.com/bellanapolipizza",
      "whatsapp_number": "+15550192834",
      "linkedin_url": null,
      "tiktok_url": null
    }
  },
  "sitemap_content_structure": {
    "pages": [
      {
        "page_slug": "/",
        "seo_meta": { "title": "Best Pizza in [City] | Bella Napoli", "description": "..." },
        "sections": [
          {
            "section_id": "hero_main",
            "section_type": "Hero",
            "content_payload": {
              "headline": "Naples is closer than you think.",
              "subheadline": "Wood-fired perfection served in the heart of [City].",
              "cta_button": { "text": "Order Online", "url": "/order" }
            },
            "visual_assets": {
              "background_image": {
                "asset_decision": "GENERATE_USING_REFERENCE",
                "original_url": "https://lh3.google...[Blurry_Oven_Shot]",
                "display_context": "Hero_Background",
                "ai_generation_data": {
                  "text_prompt": "Cinematic wide shot of a traditional wood-fired pizza oven, roaring fire, warm golden lighting, rustic brick texture, 8k resolution.",
                  "reference_image_url": "https://lh3.google...[Blurry_Oven_Shot]",
                  "guidance_strength": 0.4
                }
              }
            }
          },
          {
            "section_id": "reviews_home",
            "section_type": "Reviews_Carousel",
            "content_payload": {
              "headline": "Local Legends",
              "subheadline": "4.8 Stars on Google Maps"
            },
            "data_injection": {
              "reviews": [
                {
                  "author_name": "John D.",
                  "star_rating": 5,
                  "review_text": "The **Margherita Pizza** changed my life. Crust is perfectly charred.",
                  "source_url": "https://goo.gl/maps/...",
                  "author_avatar": {
                     "asset_decision": "USE_ORIGINAL",
                     "original_url": "https://lh3...[John_Avatar]",
                     "display_context": "Avatar"
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```