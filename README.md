# Platinum Backend API

A lightweight, secure, production-ready SvelteKit backend deployed to Vercel. It receives form submissions from the frontend website, validates all fields on the server, restricts requests to allowed frontend origins, preserves marketing attribution and submission metadata, and sends beautifully styled notification emails to designated recipients using [Resend](https://resend.com).

---

## 🚀 Features

- **Resend Email Integration**: Dispatches formatted HTML and plain-text emails to configured recipients upon every validated submission.
- **Full Lead & Attribution Ingestion**: Captures core customer details, service type, damage selection, submission ID, page URL, consent, and Google Ads / UTM tracking parameters.
- **Server-Side Validation**: Enforces medium-level, practical validation on required fields (`service`, `name`, `phone`, `zip`, `damage`) and length limits, without overly strict patterns that reject legitimate customer data.
- **Type-Safety & Malformed JSON Protection**: Safely handles unexpected data types and malformed JSON without crashing the server.
- **Origin & CORS Security**: Restricts API access strictly to origins specified in `ALLOWED_ORIGINS` (with preflight `OPTIONS` support).
- **Anti-Abuse & Payload Protection**: Enforces 50KB payload limits and HTML-escaping to prevent XSS/injection in email clients.
- **Zero Database / Zero Bloat**: Stateless serverless architecture built for high performance on Vercel.

---

## 📋 Form Fields Specification

### 1. User & Form Fields

| Field Name | Type   | Required?  | Description / Validation Rules                                                     |
| :--------- | :----- | :--------- | :--------------------------------------------------------------------------------- |
| `service`  | String | **Yes**    | Service requested (e.g., `"Water damage restoration"`), max 100 chars.             |
| `name`     | String | **Yes**    | Full customer name, 2–100 characters.                                              |
| `phone`    | String | **Yes**    | US / international phone number (7–15 digits, standard formatting).                |
| `zip`      | String | **Yes**    | 5-digit US property ZIP code or ZIP+4 (e.g., `"76234"`).                           |
| `damage`   | String | **Yes**    | Damage type (e.g., `"Burst pipe or plumbing leak"`, `"Storm or flood damage"`).    |
| `message`  | String | _Optional_ | Additional details / notes (max 2,000 chars). May be empty string `""` or omitted. |

### 2. Hidden & System-Generated Fields

| Field Name      | Type   | Required?  | Description / Example                                                          |
| :-------------- | :----- | :--------- | :----------------------------------------------------------------------------- |
| `submission_id` | String | _Optional_ | Unique submission identifier (UUID v4). Auto-generated if omitted.             |
| `page`          | String | _Optional_ | Website URL where form was submitted (e.g., `"https://www.platinumsg.com/"`).  |
| `consent`       | String | _Optional_ | Customer consent text (e.g., `"Contact me about this water damage request."`). |

### 3. Advertising & Marketing Attribution Fields

All attribution parameters are **optional strings** (max 255 chars). Missing or empty tracking fields are safely handled and never cause rejection.

| Field Name     | Type   | Description                                                   |
| :------------- | :----- | :------------------------------------------------------------ |
| `gclid`        | String | Google Click ID for Google Ads attribution.                   |
| `gbraid`       | String | iOS Google Ads click ID.                                      |
| `wbraid`       | String | Web Google Ads click ID.                                      |
| `utm_source`   | String | Traffic source parameter (e.g., `"google"`).                  |
| `utm_medium`   | String | Marketing medium parameter (e.g., `"cpc"`).                   |
| `utm_campaign` | String | Campaign name parameter (e.g., `"water-damage-restoration"`). |
| `utm_term`     | String | Search term parameter.                                        |
| `utm_content`  | String | Ad content parameter.                                         |

> **Note:** For backwards compatibility, aliases are supported for input keys: `zipCode` -> `zip`, `issue` / `whatHappened` -> `damage`, `details` -> `message`, and `fullName` -> `name`.

---

## 🔑 Environment Variables Setup

Copy `.env.example` to `.env` for local development:

```sh
cp .env.example .env
```

### Configured Variables

| Variable            | Description                                                            | Example / Default                                                         |
| :------------------ | :--------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| `RESEND_API_KEY`    | Your Resend API key (`re_...`)                                         | `re_1234567890abcdef`                                                     |
| `RESEND_FROM_EMAIL` | Verified sender address in Resend                                      | `Platinum Leads <notifications@ikhtiyaar.com>`                            |
| `RECIPIENT_EMAIL_1` | First recipient email address                                          | `office@cleanmastercarpetcleaning.com`                                    |
| `RECIPIENT_EMAIL_2` | Second recipient email address                                         | `muhammad.bilal@ikhtiyaar.com`                                            |
| `ALLOWED_ORIGINS`   | Comma-separated list of allowed frontend origins (no trailing slashes) | `https://www.platinumsg.com,https://platinumsg.com,http://localhost:5173` |

---

## 📡 API Endpoints

### `POST /api/contact` (or `POST /api/callback`)

Receives form submission data, validates input, and sends email notification.

#### Headers

```http
Content-Type: application/json
Origin: https://www.platinumsg.com
```

#### Example 1: Submission With Advertising Attribution

```json
{
	"service": "Water damage restoration",
	"name": "Jane Doe",
	"phone": "8175550123",
	"zip": "76234",
	"damage": "Burst pipe or plumbing leak",
	"message": "Water leaking from ceiling under second floor bathroom.",
	"page": "https://www.platinumsg.com/",
	"submission_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
	"consent": "Contact me about this water damage request.",
	"gclid": "EAIaIQobChMI78_xxxxxx",
	"utm_source": "google",
	"utm_medium": "cpc",
	"utm_campaign": "water-damage-restoration"
}
```

#### Example 2: Submission Without Advertising Attribution

```json
{
	"service": "Water damage restoration",
	"name": "John Smith",
	"phone": "8175550123",
	"zip": "76234",
	"damage": "Storm or flood damage",
	"message": "",
	"page": "https://www.platinumsg.com/",
	"submission_id": "e0e29b46-7785-408a-9285-b9f1d0b7d7f2",
	"consent": "Contact me about this water damage request."
}
```

#### Success Response (`200 OK`)

```json
{
	"success": true,
	"message": "Callback request received successfully. A specialist will call you shortly.",
	"submission_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

#### Validation Error (`400 Bad Request`)

```json
{
	"success": false,
	"error": "Form validation failed.",
	"errors": {
		"service": "Service is required.",
		"phone": "Please enter a valid phone number (e.g., (817) 555-0123 or 8175550123).",
		"zip": "Please enter a valid 5-digit US ZIP code (e.g., 76234)."
	}
}
```

#### Disallowed Origin (`403 Forbidden`)

```json
{
	"success": false,
	"error": "Origin not allowed. Cross-origin request rejected."
}
```

#### Oversized Payload (`413 Payload Too Large`)

```json
{
	"success": false,
	"error": "Payload too large. Maximum size is 50KB."
}
```

#### Server / Resend Error (`500 Internal Server Error`)

```json
{
	"success": false,
	"error": "Unable to deliver callback request at this time. Please try again later."
}
```

---

## 🧪 Testing Locally

### 1. Run the Automated Test Suite

```sh
npm run test
```

### 2. Type Diagnostics and Linting

```sh
npm run check
npm run lint
```

### 3. Local Development Server

```sh
npm run dev
```

Test with `curl` in your terminal:

```sh
curl -X POST http://localhost:5173/api/contact \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{
    "service": "Water damage restoration",
    "name": "Jane Doe",
    "phone": "8175550123",
    "zip": "76234",
    "damage": "Burst pipe or plumbing leak",
    "message": "Water leaking from ceiling under second floor bathroom.",
    "page": "https://www.platinumsg.com/",
    "submission_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "consent": "Contact me about this water damage request.",
    "gclid": "EAIaIQobChMI78_xxxxxx",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "water-damage-restoration"
  }'
```
