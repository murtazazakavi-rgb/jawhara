# Jawhara OS V2 - WhatsApp & Sandbox Integration Guide

This document describes how to configure, test, and run the WhatsApp Core and Payment commerce integration loops.

---

## 1. Environment Configurations

Define the following keys in your `.env` file:

```bash
# WhatsApp Meta Graph API
WHATSAPP_PROVIDER=mock # Options: 'meta', 'mock' (default)
META_WHATSAPP_ACCESS_TOKEN=your_meta_system_user_token
META_WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
META_WHATSAPP_WABA_ID=your_business_account_id
META_WHATSAPP_VERIFY_TOKEN=your_webhook_verification_token
META_APP_SECRET=your_facebook_app_secret

# Razorpay Commerce
PAYMENT_PROVIDER=mock # Options: 'razorpay', 'mock' (default)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# AI Co-Pilot
GEMINI_API_KEY=your_gemini_studio_api_key
GEMINI_MODEL=gemini-1.5-flash # Default fallback model
```

---

## 2. WhatsApp Integration Loops

### A. Webhook Verification GET Handshake
When configuring the webhook in your Facebook Developer Console, set the callback URL to:
`https://yourdomain.com/api/webhooks/whatsapp`

The GET handler verifies that `hub.mode` equals `'subscribe'` and matches the `hub.verify_token` with your configured `META_WHATSAPP_VERIFY_TOKEN` before responding with the `hub.challenge` string.

### B. Outgoing Messages & Mock Fallback
- When `WHATSAPP_PROVIDER` is set to `'mock'` (or credentials are empty), outgoing messages print a simulated receipt to the console terminal, along with a randomly generated provider message ID: `wamid.HBgL...`.
- In `'meta'` mode, outbound requests are sent directly to the Meta Graph Messages API.

### C. Webhook Inbound Message POST
When an incoming event is received, `/api/webhooks/whatsapp`:
1. Validates authenticity using the `X-Hub-Signature-256` signature header if `META_APP_SECRET` is configured.
2. Checks for event duplication using an MD5 hash of the raw body payload saved in `WebhookEvent`.
3. Normalizes the sender phone number using `normalizePhoneNumber` to match or create a `Customer` profile.
4. Updates or creates an open `WhatsAppConversation` record.
5. Logs the message inside the database thread.
6. Scans the message body text for a product SKU pattern: `/JWR-[A-Z0-9]+-[0-9]{2}-[0-9]{4}/i`.
   - If a SKU is matched, logs a `CustomerInteraction` of type `WHATSAPP_INQUIRY` and triggers the AI auto product responder.

---

## 3. Payments Sandbox Simulator

To test customer checkout flows locally without Razorpay credentials:
1. When generating a payment request link, the system creates a mock URL:
   `http://localhost:3000/api/public/pay-mock/[linkId]`
2. When the salesperson shares the link, it is dispatched to the client via WhatsApp.
3. Clicking this link opens a beautiful boutique-style payment landing page.
4. Hitting the **Simulate Successful Payment** button sends a simulated webhook POST request to `/api/webhooks/razorpay` containing a signed `payment_link.paid` event.
5. The webhook processes the event, updates the order to `PAID`, converts active reservations to `SOLD`, updates product sales timestamps, and triggers automated WhatsApp purchase confirmation messages.

---

## 4. AI Co-Pilot Suggested Replies

Inside the WhatsApp Inbox chat thread, clicking **Suggest Drafts** sends the last incoming message and full CRM profile (LTV, preferences, active holds) to Gemini. 

Gemini is configured with a structured JSON schema constraint forcing it to output three distinct drafts:
- **Option 1**: A polite check-in or greeting.
- **Option 2**: A color-matched product pitch drawing from current available catalog items.
- **Option 3**: A reservation expiration or checkout payment prompt.

Clicking any option card instantly populates the salesperson's text input composer, allowing manual tweaks before sending.
