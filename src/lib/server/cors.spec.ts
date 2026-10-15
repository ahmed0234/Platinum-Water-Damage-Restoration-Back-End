import { describe, expect, it } from 'vitest';
import { extractRequestOrigin, getCorsHeaders, isOriginAllowed } from './cors.js';

describe('CORS and Origin Validation', () => {
	it('should correctly extract origin from Origin header', () => {
		const req = new Request('https://api.example.com/api/contact', {
			method: 'POST',
			headers: { origin: 'https://platinum-landing.vercel.app' }
		});
		expect(extractRequestOrigin(req)).toBe('https://platinum-landing.vercel.app');
	});

	it('should fallback to Referer header when Origin is absent', () => {
		const req = new Request('https://api.example.com/api/contact', {
			method: 'POST',
			headers: { referer: 'https://platinum-landing.vercel.app/quote?src=google' }
		});
		expect(extractRequestOrigin(req)).toBe('https://platinum-landing.vercel.app');
	});

	it('should return null when neither Origin nor Referer is present', () => {
		const req = new Request('https://api.example.com/api/contact', {
			method: 'POST'
		});
		expect(extractRequestOrigin(req)).toBeNull();
	});

	it('should permit allowed origins and reject disallowed origins', () => {
		const allowedOrigins = [
			'https://platinum-landing.vercel.app',
			'https://platinumrestoration.com'
		];

		// Matches allowed
		expect(isOriginAllowed('https://platinum-landing.vercel.app', allowedOrigins)).toBe(true);
		expect(isOriginAllowed('https://platinumrestoration.com', allowedOrigins)).toBe(true);

		// Case-insensitive & trailing slash resilience
		expect(isOriginAllowed('https://PLATINUMRESTORATION.COM/', allowedOrigins)).toBe(true);

		// Disallowed origin
		expect(isOriginAllowed('https://malicious-site.com', allowedOrigins)).toBe(false);
		expect(isOriginAllowed('https://sub.platinumrestoration.com', allowedOrigins)).toBe(false);

		// Missing origin
		expect(isOriginAllowed(null, allowedOrigins)).toBe(false);
	});

	it('should permit any origin when wildcard * is configured', () => {
		expect(isOriginAllowed('https://random-site.com', ['*'])).toBe(true);
		expect(isOriginAllowed('http://localhost:3000', ['*'])).toBe(true);
	});

	it('should permit wildcard subdomains like https://*.vercel.app', () => {
		const allowedOrigins = ['https://*.vercel.app', 'https://*.platinumsg.com'];

		expect(isOriginAllowed('https://platinum-preview-123.vercel.app', allowedOrigins)).toBe(true);
		expect(isOriginAllowed('https://app.platinumsg.com', allowedOrigins)).toBe(true);
		expect(isOriginAllowed('https://other-site.com', allowedOrigins)).toBe(false);
		expect(isOriginAllowed('https://evil-vercel.app', allowedOrigins)).toBe(false);
	});

	it('should construct proper CORS response headers', () => {
		const allowedOrigins = ['https://platinumrestoration.com'];
		const headers = getCorsHeaders('https://platinumrestoration.com', allowedOrigins);

		expect(headers['Access-Control-Allow-Origin']).toBe('https://platinumrestoration.com');
		expect(headers['Access-Control-Allow-Methods']).toContain('POST');
		expect(headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
		expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
		expect(headers['Vary']).toBe('Origin');
	});

	it('should not set Access-Control-Allow-Origin for disallowed origins', () => {
		const allowedOrigins = ['https://platinumrestoration.com'];
		const headers = getCorsHeaders('https://evil-site.com', allowedOrigins);
		expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
	});
});
