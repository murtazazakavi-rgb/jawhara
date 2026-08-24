# Roadmap - Jawhara OS Development Plan

This document outlines the implementation timeline and feature rollout for Jawhara OS. It lists completed, planned, and architecturally prepared features.

---

## [x] Stage 1: Jawhara Core (V1)
**Status: Implemented & Verified**
*   `[x]` **Secure Authentication**: AES-256-GCM encrypted session cookies.
*   `[x]` **Stitch UI Layouts**: Warm Ivory theme, serif typography, soft luxury buttons, inputs, and watermark overlays.
*   `[x]` **Sequential Product SKU Code Service**: Category-specific prefixing e.g. `JWR-R-26-0001`.
*   `[x]` **Add Product Wizard Flow**: Step-by-step Photos upload, Category select, AI Assist, Pricing configuration, and Lookbook card review.
*   `[x]` **Dynamic Attribute Model**: Category-specific metadata definitions (Care, fabric, Top color, bottom color) without schema modifications.
*   `[x]` **Image Upload System**: Drag-and-drop local file storage with primary asset selection.
*   `[x]` **AI Suggestion Engine**: Integration with `gemini-1.5-flash` model for auto-generating name, description, and specs from images (with graceful mock fallbacks).
*   `[x]` **CRM Client Directory**: Searchable profiles with lifetime spend (LTV), notes, and VIP lists.
*   `[x]` **Secure Reservation Module**: Pessimistic transaction checks in Prisma to block double-booking. Includes duration and release actions.
*   `[x]` **Transaction-Safe Order Flow (Mark Sold)**: Multi-record database transactions that automatically generate order sequence numbers, update customer spend history, and mark products sold.
*   `[x]` **Public Lookbook Page**: Public product views under `/p/[slug]` containing "Ask on WhatsApp" intents and similar items recommendation grids.
*   `[x]` **Activity Audit Logging**: Log critical product edits, sales, and reservations.

---

## [/] Phase 2: Sales Intelligence
**Status: Architecturally Prepared (Planned Next)**
*   `[ ]` **AI Marketing Studio**: Create one-click social media caption generators (Instagram, WhatsApp broadcast text, reels ideas) based on product details.
*   `[ ]` **Customer Interaction Tracking**: Create `CustomerInteraction` model to record customer views, WhatsApp clicks, wishlist clicks, and inquiries.
*   `[ ]` **Preference Profiling**: Automate customer profiling (color affinity, pastel vs. dark affinity, price tier preference) computed directly from historical views and reservations.

---

## [ ] Phase 3: Personal Shopper
**Status: Planned**
*   `[ ]` **Smart Recommendations**: Suggest available boutique catalog matches directly to VIP clients based on color affinity score.
*   `[ ]` **Customer-to-Product Matching**: Run matching algorithms (e.g. "Emerald Floral Rida under ₹25k -> Alert Chloe Chen").
*   `[ ]` **Personal Shopper Interface**: Standard customer dashboard to input specific search parameters (Occasion, color, fabric, budget) and match products instantly.
*   `[ ]` **WhatsApp Sales Assistant**: Co-pilot panel inside the dashboard that suggests reply copies to salesperson chats based on client records.

---

## [ ] Phase 4: Commerce Platform & Integrations
**Status: Planned**
*   `[ ]` **Multi-Channel Sync**: Adapter pattern integrations with Shopify catalog, Instagram Shopping API, and Google Merchant center.
*   `[ ]` **Online Payment Links**: Integrate Razorpay/Stripe API to generate SMS/WhatsApp payment links.
*   `[ ]` **Shipping Adapters**: Connect Shiprocket/Delhivery courier tracking details to automatically trigger dispatch notifications.
*   `[ ]` **Showroom POS App**: Sleek barcode/QR scan interface for in-person exhibition checkout using the same shared database schema.

---

## [ ] Phase 5: Predictive Analytics
**Status: Planned**
*   `[ ]` **LTV Analysis**: Lifetime value forecasting and client retention alerts.
*   `[ ]` **Demand Planning**: Fast-selling category reporting, style trend analysis (floral vs. geometric), and restock recommendation alerts.
*   `[ ]` **Demand Merchandising**: Predict optimal price points for premium drops based on past sellout speed.
