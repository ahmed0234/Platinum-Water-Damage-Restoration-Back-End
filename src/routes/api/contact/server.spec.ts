import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import * as crmModule from '#lib/server/crm.js';
import * as emailModule from '#lib/server/email.js';
import { OPTIONS, POST } from './+server.js';

describe('Contact API Endpoint (/api/contact)', () => {
	beforeEach(() => {
		// Never hit the real CRM bridge from tests; individual tests override as needed
		vi.spyOn(crmModule, 'forwardLeadToCrm').mockResolvedValue({ success: true });
		// Set default environment variables for test execution
		process.env.ALLOWED_ORIGINS =
			'https://platinum-landing.vercel.app,http://localhost:5173,https://www.platinumsg.com';
		process.env.RESEND_API_KEY = 're_test_key_123456';
		process.env.RECIPIENT_EMAIL_1 = 'lead1@platinumrestoration.com';
		process.env.RECIPIENT_EMAIL_2 = 'lead2@platinumrestoration.com';
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function createMockEvent(
		method: string,
		headers: Record<string, string> = {},
		body?: string
	): RequestEvent {
		const request = new Request('https://api.example.com/api/contact', {
			method,
			headers: {
				'content-type': 'application/json',
				...headers
			},
			body: method === 'POST' ? body : undefined
		});

		return {
			request,
			url: new URL('https://api.example.com/api/contact'),
			params: {},
			locals: {},
			cookies: {
				get: vi.fn(),
				getAll: vi.fn(),
				set: vi.fn(),
				delete: vi.fn(),
				serialize: vi.fn()
			},
			fetch: vi.fn(),
			setHeaders: vi.fn(),
			isDataRequest: false,
			isSubRequest: false,
			route: { id: '/api/contact' },
			platform: undefined
		} as unknown as RequestEvent;
	}

	it('OPTIONS should return 204 with CORS headers for allowed origin', async () => {
		const event = createMockEvent('OPTIONS', {
			origin: 'https://platinum-landing.vercel.app'
		});

		const response = await OPTIONS(event);
		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
			'https://platinum-landing.vercel.app'
		);
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
	});

	it('OPTIONS should return 403 for disallowed origin', async () => {
		const event = createMockEvent('OPTIONS', {
			origin: 'https://unauthorized-domain.com'
		});

		const response = await OPTIONS(event);
		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.success).toBe(false);
		expect(data.error).toBe('Origin not allowed');
	});

	it('POST should reject requests from disallowed origin with 403', async () => {
		const event = createMockEvent(
			'POST',
			{ origin: 'https://hacker-site.org' },
			JSON.stringify({ name: 'Test' })
		);

		const response = await POST(event);
		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.success).toBe(false);
		expect(data.error).toContain('Origin not allowed');
	});

	it('POST should return 413 when Content-Length exceeds 50KB limit', async () => {
		const event = createMockEvent(
			'POST',
			{
				origin: 'https://platinum-landing.vercel.app',
				'content-length': '60000'
			},
			JSON.stringify({ name: 'Test' })
		);

		const response = await POST(event);
		expect(response.status).toBe(413);
		const data = await response.json();
		expect(data.error).toContain('Payload too large');
	});

	it('POST should return 400 when payload is malformed JSON', async () => {
		const event = createMockEvent(
			'POST',
			{ origin: 'https://platinum-landing.vercel.app' },
			'{ bad json here ...'
		);

		const response = await POST(event);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toContain('Malformed JSON payload');
	});

	it('POST should return 400 when payload is an empty request body', async () => {
		const event = createMockEvent('POST', { origin: 'https://platinum-landing.vercel.app' }, '   ');

		const response = await POST(event);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toContain('Empty request body');
	});

	it('POST should return 400 when required fields are missing', async () => {
		const event = createMockEvent(
			'POST',
			{ origin: 'https://platinum-landing.vercel.app' },
			JSON.stringify({
				name: '',
				phone: 'not-a-phone',
				zip: '123'
				// service, damage are missing
			})
		);

		const response = await POST(event);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.success).toBe(false);
		expect(data.errors).toBeDefined();
		expect(data.errors.service).toBeDefined();
		expect(data.errors.name).toBeDefined();
		expect(data.errors.phone).toBeDefined();
		expect(data.errors.zip).toBeDefined();
		expect(data.errors.damage).toBeDefined();
	});

	it('POST should return 400 when invalid data types are sent', async () => {
		const event = createMockEvent(
			'POST',
			{ origin: 'https://platinum-landing.vercel.app' },
			JSON.stringify({
				service: 12345,
				name: ['John Doe'],
				phone: true,
				zip: { code: '76234' },
				damage: 42,
				utm_source: 100
			})
		);

		const response = await POST(event);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.success).toBe(false);
		expect(data.errors).toBeDefined();
		expect(data.errors.service).toContain('must be a string');
		expect(data.errors.name).toContain('must be a string');
		expect(data.errors.phone).toContain('must be a string');
		expect(data.errors.zip).toContain('must be a string');
		expect(data.errors.damage).toContain('must be a string');
		expect(data.errors.utm_source).toContain('must be a string');
	});

	it('POST should return 200 on Example Payload 1 (with advertising attribution)', async () => {
		const sendSpy = vi
			.spyOn(emailModule, 'sendLeadNotificationEmail')
			.mockResolvedValueOnce({ success: true, id: 'resend_email_123' });

		const payloadWithAttribution = {
			service: 'Water damage restoration',
			name: 'Jane Doe',
			phone: '8175550123',
			zip: '76234',
			damage: 'Burst pipe or plumbing leak',
			message: 'Water leaking from ceiling under second floor bathroom.',
			page: 'https://www.platinumsg.com/',
			submission_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
			consent: 'Contact me about this water damage request.',
			gclid: 'EAIaIQobChMI78_xxxxxx',
			utm_source: 'google',
			utm_medium: 'cpc',
			utm_campaign: 'water-damage-restoration'
		};

		const event = createMockEvent(
			'POST',
			{ origin: 'https://www.platinumsg.com' },
			JSON.stringify(payloadWithAttribution)
		);

		const response = await POST(event);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.submission_id).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
		expect(data.message).toContain('Callback request received successfully');
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://www.platinumsg.com');

		expect(sendSpy).toHaveBeenCalledTimes(1);
		expect(sendSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				service: 'Water damage restoration',
				name: 'Jane Doe',
				phone: '8175550123',
				zip: '76234',
				damage: 'Burst pipe or plumbing leak',
				message: 'Water leaking from ceiling under second floor bathroom.',
				submission_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
				gclid: 'EAIaIQobChMI78_xxxxxx',
				utm_source: 'google',
				utm_medium: 'cpc',
				utm_campaign: 'water-damage-restoration'
			})
		);

		sendSpy.mockRestore();
	});

	it('POST should return 200 on Example Payload 2 (without advertising attribution and empty message)', async () => {
		const sendSpy = vi
			.spyOn(emailModule, 'sendLeadNotificationEmail')
			.mockResolvedValueOnce({ success: true, id: 'resend_email_456' });

		const payloadWithoutAttribution = {
			service: 'Water damage restoration',
			name: 'John Smith',
			phone: '8175550123',
			zip: '76234',
			damage: 'Storm or flood damage',
			message: '',
			page: 'https://www.platinumsg.com/',
			submission_id: 'e0e29b46-7785-408a-9285-b9f1d0b7d7f2',
			consent: 'Contact me about this water damage request.'
		};

		const event = createMockEvent(
			'POST',
			{ origin: 'https://www.platinumsg.com' },
			JSON.stringify(payloadWithoutAttribution)
		);

		const response = await POST(event);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.submission_id).toBe('e0e29b46-7785-408a-9285-b9f1d0b7d7f2');
		expect(data.message).toContain('Callback request received successfully');

		expect(sendSpy).toHaveBeenCalledTimes(1);
		expect(sendSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				service: 'Water damage restoration',
				name: 'John Smith',
				phone: '8175550123',
				zip: '76234',
				damage: 'Storm or flood damage',
				message: '',
				submission_id: 'e0e29b46-7785-408a-9285-b9f1d0b7d7f2'
			})
		);

		sendSpy.mockRestore();
	});

	it('POST should return 500 when email sending fails and not leak internal error details', async () => {
		const sendSpy = vi.spyOn(emailModule, 'sendLeadNotificationEmail').mockResolvedValueOnce({
			success: false,
			error: 'Internal SMTP failure at backend.resend.private'
		});

		const validPayload = {
			service: 'Water damage restoration',
			name: 'Michael Scott',
			phone: '(817) 555-0199',
			zip: '76234',
			damage: 'Burst pipe'
		};

		const event = createMockEvent(
			'POST',
			{ origin: 'https://platinum-landing.vercel.app' },
			JSON.stringify(validPayload)
		);

		const response = await POST(event);
		expect(response.status).toBe(500);

		const data = await response.json();
		expect(data.success).toBe(false);
		expect(data.error).toBe(
			'Unable to deliver callback request at this time. Please try again later.'
		);
		// Crucial security check: internal error string / credentials must NEVER leak in API response
		expect(JSON.stringify(data)).not.toContain('backend.resend.private');
		// Spec: the CRM forward happens after the email sends
		expect(crmModule.forwardLeadToCrm).not.toHaveBeenCalled();

		sendSpy.mockRestore();
	});

	describe('CRM forwarding', () => {
		const leadPayload = {
			service: 'Water damage restoration',
			name: 'Jane Doe',
			phone: '8175550123',
			zip: '76234',
			damage: 'Burst pipe or plumbing leak',
			message: 'Water in the kitchen.',
			page: 'https://www.platinumsg.com/?gclid=abc',
			submission_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
			gclid: 'EAIaIQobChMI78_xxxxxx'
		};

		async function submit(body: Record<string, unknown>) {
			const event = createMockEvent(
				'POST',
				{ origin: 'https://www.platinumsg.com' },
				JSON.stringify(body)
			);
			return POST(event);
		}

		it('should forward sms_consent "no" when the checkbox was left unchecked', async () => {
			vi.spyOn(emailModule, 'sendLeadNotificationEmail').mockResolvedValueOnce({ success: true });

			const response = await submit({ ...leadPayload, sms_consent: 'no' });

			expect(response.status).toBe(200);
			expect(crmModule.forwardLeadToCrm).toHaveBeenCalledTimes(1);
			expect(crmModule.forwardLeadToCrm).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Jane Doe',
					gclid: 'EAIaIQobChMI78_xxxxxx',
					page: 'https://www.platinumsg.com/?gclid=abc',
					sms_consent: 'no'
				})
			);
		});

		it('should default sms_consent to "no" when the field is missing', async () => {
			vi.spyOn(emailModule, 'sendLeadNotificationEmail').mockResolvedValueOnce({ success: true });

			await submit(leadPayload);

			expect(crmModule.forwardLeadToCrm).toHaveBeenCalledWith(
				expect.objectContaining({ sms_consent: 'no' })
			);
		});

		it('should forward sms_consent "yes" when the checkbox was ticked', async () => {
			const sendSpy = vi
				.spyOn(emailModule, 'sendLeadNotificationEmail')
				.mockResolvedValueOnce({ success: true });

			const response = await submit({ ...leadPayload, sms_consent: 'yes' });

			expect(response.status).toBe(200);
			expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ sms_consent: 'yes' }));
			expect(crmModule.forwardLeadToCrm).toHaveBeenCalledWith(
				expect.objectContaining({ sms_consent: 'yes' })
			);
		});

		it('should still return 200 and send the email when the CRM forward fails', async () => {
			const sendSpy = vi
				.spyOn(emailModule, 'sendLeadNotificationEmail')
				.mockResolvedValueOnce({ success: true });
			vi.mocked(crmModule.forwardLeadToCrm).mockResolvedValueOnce({
				success: false,
				error: 'CRM request failed (timed out after 5000ms).'
			});

			const response = await submit(leadPayload);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(sendSpy).toHaveBeenCalledTimes(1);
			expect(JSON.stringify(data)).not.toContain('CRM');
		});

		it('should still return 200 if the CRM forward throws unexpectedly', async () => {
			vi.spyOn(emailModule, 'sendLeadNotificationEmail').mockResolvedValueOnce({ success: true });
			vi.mocked(crmModule.forwardLeadToCrm).mockRejectedValueOnce(new Error('boom'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			const response = await submit(leadPayload);

			expect(response.status).toBe(200);
			expect((await response.json()).success).toBe(true);
		});

		it('should reject a malformed optional email address', async () => {
			const response = await submit({ ...leadPayload, email: 'not-an-email' });
			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.errors.email).toBeDefined();
		});
	});
});
