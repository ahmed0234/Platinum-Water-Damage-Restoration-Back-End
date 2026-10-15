/**
 * Safe server-only environment accessor.
 * Reads environment variables from process.env on Node.js / Vercel Serverless Functions.
 */

// Automatically load local .env file in development if present
try {
	if (typeof process !== 'undefined' && typeof process.loadEnvFile === 'function') {
		process.loadEnvFile();
	}
} catch {
	// Ignored if .env doesn't exist (e.g. in Vercel production where env vars are injected directly)
}

function readEnv(key: string, defaultValue = ''): string {
	if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
		return process.env[key]!.trim();
	}
	return defaultValue;
}

/**
 * Resend API Key.
 * Configured in Vercel / .env as RESEND_API_KEY.
 */
export function getResendApiKey(): string {
	return readEnv('RESEND_API_KEY');
}

/**
 * Sender email address displayed to recipients.
 * Defaults to Resend's onboarding address for immediate testing,
 * or your verified custom domain in production.
 */
export function getResendFromEmail(): string {
	return readEnv('RESEND_FROM_EMAIL', 'Platinum Leads <notifications@ikhtiyaar.com>');
}

/**
 * Configured recipient email addresses.
 * Reads RECIPIENT_EMAIL_1 and RECIPIENT_EMAIL_2.
 * Also supports RECIPIENT_EMAILS as a comma-separated list.
 */
export function getRecipientEmails(): string[] {
	const recipients: string[] = [];

	const email1 = readEnv('RECIPIENT_EMAIL_1');
	const email2 = readEnv('RECIPIENT_EMAIL_2');

	if (email1) recipients.push(email1);
	if (email2 && !recipients.includes(email2)) recipients.push(email2);

	const emailsCombined = readEnv('RECIPIENT_EMAILS');
	if (emailsCombined) {
		const parsed = emailsCombined
			.split(',')
			.map((e) => e.trim())
			.filter(Boolean);
		for (const email of parsed) {
			if (!recipients.includes(email)) {
				recipients.push(email);
			}
		}
	}

	return recipients;
}

/**
 * Configured allowed frontend origins for CORS and server-side origin validation.
 * Reads ALLOWED_ORIGINS (comma-separated list, e.g. "https://myfrontend.com,http://localhost:5173").
 */
export function getAllowedOrigins(): string[] {
	const raw = readEnv('ALLOWED_ORIGINS');
	if (!raw) {
		return [
			'https://platinumsg.com',
			'https://www.platinumsg.com',
			'http://localhost:5173',
			'http://localhost:3000'
		];
	}

	return raw
		.split(',')
		.map((origin) => origin.trim().replace(/\/+$/, ''))
		.filter(Boolean);
}
