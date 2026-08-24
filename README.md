# Jawhara OS

Jawhara OS is the central operating system and CRM built exclusively for the premium brand **Jawhara**. Designed to enforce the core philosophy **"Create a product once, manage it centrally, sell it everywhere"**, the system connects products, customer relationships, reservations, and orders into an elegant, soft-luxury workspace.

---

## 1. Project Overview

Jawhara focuses primarily on **Ridas**—unique, one-of-one pieces—but the system is architected from day one as a **multi-product platform** to support Kids apparel, bedding, home décor, accessories, and future product lines.

*   **Google Stitch Design Integration**: Replicates the luxury high-fashion designs, color palette (`#755566` primary mauve, `#FAF8F6` ivory background, `#f5d8e0` blush pink), and editorial spacing rhythm.
*   **Unique Inventory Protection**: Employs rigorous database transactions to prevent double reservations or multiple sales of one-of-one pieces.
*   **AI-Assisted Merchandising**: Automatically generates product names, tags, and specifications from photography using the Google Gemini model.

---

## 2. Local Setup

### Prerequisites
*   **Node.js**: v18.x or higher (Node v25.5.0 verified)
*   **Package Manager**: `pnpm` (pnpm v11.5.2 verified)

### Installation
1.  Clone the repository and enter the directory.
2.  Install dependencies:
    ```bash
    pnpm install
    ```

---

## 3. Configuration & Environment Variables

Create a `.env` file in the root directory:

```env
# Forces Prisma to use the binary engine type to bypass macOS library validation restrictions
PRISMA_CLIENT_ENGINE_TYPE="binary"
PRISMA_CLI_QUERY_ENGINE_TYPE="binary"

# Database Connection URL (SQLite Local File)
DATABASE_URL="file:./prisma/dev.db"

# Session Cookie Secret Key (Secret for cryptography signing)
SESSION_SECRET="jawhara-os-very-secure-random-key-2026-very-long"

# Google Gemini API Key (Optional: fallbacks to mock tags if empty)
GEMINI_API_KEY="your-gemini-api-key"

# Public site URL for WhatsApp links
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

---

## 4. Database Setup & Migrations

To configure the SQLite database and sync schemas:
```bash
# Push schema changes to the local dev.db database
pnpm prisma db push
```

### Seeding Data
Seed default categories (Rida, Bedding, Décor, Kids), collections (Gulab Edit, Pastel Edit), initial customers, and the default boutique administrator profile:
```bash
pnpm dlx tsx prisma/seed.ts
```

*   **Default Credentials**:
    *   **Email**: `admin@maisonjawhara.com`
    *   **Password**: `JawharaOS2026!`

---

## 5. System Features & Workflows

### Authentication
*   Session-based cookie authentication handled inside `lib/auth.ts` using AES-256-GCM encryption.
*   Middleware protects `/`, `/products`, `/customers`, `/orders`, and `/settings` while letting `/p/[slug]` stay public.

### Image Storage
*   Images are saved locally inside `public/uploads` for zero-friction local development.
*   The upload logic lives inside `app/api/upload/route.ts` and can be easily swapped for Cloudinary or S3.

### AI Suggestion Service
*   `lib/ai.ts` connects to `gemini-1.5-flash` model.
*   Extracts category colors, style patterns, and suggests descriptions. Fallbacks to default mocks if no API key is specified.

---

## 6. Verification & Tests

To execute the database constraints and business workflow integration test suite:
```bash
pnpm dlx tsx prisma/test-workflows.ts
```
This tests:
*   Product code sequential SKU generation
*   Active reservation double-booking prevention
*   Conflict-free double sales prevention inside Prisma database transactions
*   LTV calculations in customer portfolios.
