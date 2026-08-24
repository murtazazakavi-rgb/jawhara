# Jawhara OS - Design Systems

## Luxury Fashion OS (Resource: assets/29f998930b114a34b392d8359cd74973, Version: 1)

### Style Guidelines

## Brand & Style

The design system is a high-fashion operating environment that prioritizes soft luxury and feminine elegance. It is designed to evoke a sense of curated exclusivity, targeting a sophisticated audience that values editorial aesthetics over traditional corporate utility.

The visual style is **Soft Luxury Minimalism**. It leans heavily on a neutral, warm-toned foundation (85-90% of the UI) to let fashion photography and brand iconography take center stage. The aesthetic is defined by:
- **Quiet Luxury:** A focus on intentional whitespace, high-contrast typography, and a "less but better" approach to UI elements.
- **Organic Sophistication:** Incorporating the brand’s rose symbol as a recurring, ethereal watermark or secondary decorative element to anchor the identity.
- **Editorial Polish:** Layouts that feel like high-end fashion spreads, utilizing generous margins and a delicate, non-aggressive interaction model.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** model for desktop to maintain a controlled, editorial composition, while transitioning to a fluid model for mobile.

- **Desktop (1440px+):** A 12-column grid with a generous 64px outer margin. This creates a "frame" effect around the content, reinforcing the luxury feel. Gutters are kept at 24px to ensure content feels grouped but distinct.
- **Mobile:** A 4-column fluid grid with 20px margins.
- **Spacing Rhythm:** Based on an 8px base unit. However, vertical spacing between major sections should be exaggerated (80px, 120px) to simulate the breathing room found in fashion lookbooks.

## Elevation & Depth

To maintain a "clean and sophisticated" aesthetic, this design system avoids heavy drop shadows and traditional skeuomorphism.

- **Tonal Layering:** Depth is primarily communicated through color. Backgrounds are Warm Ivory, while elevated surfaces (cards, modals) are pure White.
- **Low-Contrast Outlines:** Subtle 1px borders in **Soft Blush (#E4C8CF)** or a 5% opacity Charcoal are used to define boundaries without adding visual weight.
- **Interaction Depth:** On hover or active state, elements may use a very soft, highly diffused ambient shadow (0px 4px 20px, 4% opacity) to provide a "lifted" feel that remains almost imperceptible.

## Components

- **Buttons:** Primary buttons are solid **Mauve (#AD899B)** with White text. Secondary buttons are outlined in Mauve with Mauve text. There are no gradients; buttons are flat and confident.
- **Cards:** Pure White backgrounds with a 1px border of Ivory or very light Grey. Padding should be generous (minimum 32px) to allow product imagery to breathe.
- **Input Fields:** Bottom-border only or very light four-sided borders. Labels use **label-md** (uppercase) and sit above the field.
- **Chips/Status:** Use the low-saturation status colors with a 10% opacity background of the same hue and 100% opacity text. They should have the same 0.25rem roundedness as other elements.
- **Lists:** High-density data is avoided. List items are separated by thin, wide-margined dividers.
- **Rose Brand Mark:** Use the rose as a background watermark (10% opacity) in the top-right of major sections or as a small, centered footer element.
- **Special AI Feature Surface:** Use **Soft Blush (#E4C8CF)** as a background fill for AI-driven fashion recommendations to distinguish them from standard system data.

### Theme Configuration

#### Named Colors

| Token | Value | Color Preview |
|---|---|---|
| `background` | `#fbf9f7` | <div style='width: 20px; height: 20px; background-color: #fbf9f7; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `error` | `#ba1a1a` | <div style='width: 20px; height: 20px; background-color: #ba1a1a; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `error_container` | `#ffdad6` | <div style='width: 20px; height: 20px; background-color: #ffdad6; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `inverse_on_surface` | `#f2f0ee` | <div style='width: 20px; height: 20px; background-color: #f2f0ee; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `inverse_primary` | `#e3bccf` | <div style='width: 20px; height: 20px; background-color: #e3bccf; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `inverse_surface` | `#30302f` | <div style='width: 20px; height: 20px; background-color: #30302f; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_background` | `#1b1c1b` | <div style='width: 20px; height: 20px; background-color: #1b1c1b; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_error` | `#ffffff` | <div style='width: 20px; height: 20px; background-color: #ffffff; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_error_container` | `#93000a` | <div style='width: 20px; height: 20px; background-color: #93000a; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_primary` | `#ffffff` | <div style='width: 20px; height: 20px; background-color: #ffffff; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_primary_container` | `#3e2432` | <div style='width: 20px; height: 20px; background-color: #3e2432; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_primary_fixed` | `#2b1422` | <div style='width: 20px; height: 20px; background-color: #2b1422; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_primary_fixed_variant` | `#5b3e4e` | <div style='width: 20px; height: 20px; background-color: #5b3e4e; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_secondary` | `#ffffff` | <div style='width: 20px; height: 20px; background-color: #ffffff; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_secondary_container` | `#735d63` | <div style='width: 20px; height: 20px; background-color: #735d63; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_secondary_fixed` | `#27171c` | <div style='width: 20px; height: 20px; background-color: #27171c; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_secondary_fixed_variant` | `#554147` | <div style='width: 20px; height: 20px; background-color: #554147; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_surface` | `#1b1c1b` | <div style='width: 20px; height: 20px; background-color: #1b1c1b; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_surface_variant` | `#4e4448` | <div style='width: 20px; height: 20px; background-color: #4e4448; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_tertiary` | `#ffffff` | <div style='width: 20px; height: 20px; background-color: #ffffff; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_tertiary_container` | `#2e2b2e` | <div style='width: 20px; height: 20px; background-color: #2e2b2e; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_tertiary_fixed` | `#1d1b1e` | <div style='width: 20px; height: 20px; background-color: #1d1b1e; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `on_tertiary_fixed_variant` | `#494649` | <div style='width: 20px; height: 20px; background-color: #494649; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `outline` | `#807479` | <div style='width: 20px; height: 20px; background-color: #807479; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `outline_variant` | `#d1c3c8` | <div style='width: 20px; height: 20px; background-color: #d1c3c8; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `primary` | `#755566` | <div style='width: 20px; height: 20px; background-color: #755566; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `primary_container` | `#ad899b` | <div style='width: 20px; height: 20px; background-color: #ad899b; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `primary_fixed` | `#ffd8ea` | <div style='width: 20px; height: 20px; background-color: #ffd8ea; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `primary_fixed_dim` | `#e3bccf` | <div style='width: 20px; height: 20px; background-color: #e3bccf; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `secondary` | `#6e595f` | <div style='width: 20px; height: 20px; background-color: #6e595f; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `secondary_container` | `#f5d8e0` | <div style='width: 20px; height: 20px; background-color: #f5d8e0; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `secondary_fixed` | `#f8dbe2` | <div style='width: 20px; height: 20px; background-color: #f8dbe2; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `secondary_fixed_dim` | `#dbc0c6` | <div style='width: 20px; height: 20px; background-color: #dbc0c6; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface` | `#fbf9f7` | <div style='width: 20px; height: 20px; background-color: #fbf9f7; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_bright` | `#fbf9f7` | <div style='width: 20px; height: 20px; background-color: #fbf9f7; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_container` | `#efedec` | <div style='width: 20px; height: 20px; background-color: #efedec; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_container_high` | `#eae8e6` | <div style='width: 20px; height: 20px; background-color: #eae8e6; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_container_highest` | `#e4e2e0` | <div style='width: 20px; height: 20px; background-color: #e4e2e0; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_container_low` | `#f5f3f1` | <div style='width: 20px; height: 20px; background-color: #f5f3f1; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_container_lowest` | `#ffffff` | <div style='width: 20px; height: 20px; background-color: #ffffff; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_dim` | `#dbdad8` | <div style='width: 20px; height: 20px; background-color: #dbdad8; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_tint` | `#755566` | <div style='width: 20px; height: 20px; background-color: #755566; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `surface_variant` | `#e4e2e0` | <div style='width: 20px; height: 20px; background-color: #e4e2e0; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `tertiary` | `#615d60` | <div style='width: 20px; height: 20px; background-color: #615d60; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `tertiary_container` | `#979195` | <div style='width: 20px; height: 20px; background-color: #979195; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `tertiary_fixed` | `#e8e0e4` | <div style='width: 20px; height: 20px; background-color: #e8e0e4; border: 1px solid #ccc; border-radius: 4px;'></div> |
| `tertiary_fixed_dim` | `#cbc5c8` | <div style='width: 20px; height: 20px; background-color: #cbc5c8; border: 1px solid #ccc; border-radius: 4px;'></div> |

#### Typography

| Text Style | Font Family | Font Size | Font Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| `body-lg` | Hanken Grotesk | 18px | 400 | 28px | - |
| `body-md` | Hanken Grotesk | 16px | 400 | 24px | - |
| `display-lg` | Playfair Display | 48px | 600 | 56px | -0.02em |
| `headline-lg` | Playfair Display | 32px | 500 | 40px | - |
| `headline-lg-mobile` | Playfair Display | 28px | 500 | 36px | - |
| `headline-md` | Playfair Display | 24px | 500 | 32px | - |
| `headline-sm` | Playfair Display | 20px | 500 | 28px | - |
| `label-md` | Hanken Grotesk | 14px | 600 | 20px | 0.05em |
| `label-sm` | Hanken Grotesk | 12px | 500 | 16px | - |

#### Spacing

- **container-max**: `1440px`
- **gutter**: `24px`
- **margin-desktop**: `64px`
- **margin-mobile**: `20px`
- **unit**: `8px`

#### Corner Roundness

`ROUND_FOUR`

