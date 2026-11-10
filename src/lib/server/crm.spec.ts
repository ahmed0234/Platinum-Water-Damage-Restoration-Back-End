import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCrmPayload, CRM_WEBHOOK_URL, forwardLeadToCrm } from './crm.js';
import type { LeadSubmissionData } from './validation.js';

const TEST_SECRET = 'test_webhook_secret_abc123';

const baseLead: LeadSubmissionData = {
	service: 'Water damage restoration',
	name: 'Jane Doe',
	phone: '8175550123',
	zip: '76234',
	damage: 'Burst pipe or plumbing leak',
	message: 'Water leaking from ceiling.',
	page: 'https://www.platinumsg.com/?gclid=abc',
	submission_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
	consent: 'Contact me about this water damage request.',
	sms_consent: 'no',
	gclid: 'EAIaIQobChMI78_xxxxxx',
	utm_source: 'google',
	zipCode: '76234',
	issue: 'Burst pipe or plumbing leak',
	details: 'Water leaking from ceiling.'
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('CRM Service (GoHighLevel bridge)', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		process.env.WEBHOOK_SECRET = TEST_SECRET;
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'info').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		delete process.env.WEBHOOK_SECRET;
	});

	it('should map a lead to the exact CRM payload shape', () => {
		expect(buildCrmPayload(baseLead)).toEqual({
			brand: 'PSG',
			name: 'Jane Doe',
			phone: '8175550123',
			service: 'Water damage restoration',
			damage: 'Burst pipe or plumbing leak',
			zip: '76234',
			message: 'Water leaking from ceiling.',
			gclid: 'EAIaIQobChMI78_xxxxxx',
			sms_consent: 'no',
			page: 'https://www.platinumsg.com/?gclid=abc'
		});
	});

	it('should omit missing optional fields instead of sending empty values', () => {
		const payload = buildCrmPayload({
			...baseLead,
			message: '',
			gclid: undefined,
			page: undefined,
			email: undefined
		});
		expect(payload).not.toHaveProperty('message');
		expect(payload).not.toHaveProperty('gclid');
		expect(payload).not.toHaveProperty('page');
		expect(payload).not.toHaveProperty('email');
		expect(payload.sms_consent).toBe('no');
	});

	it('should include email and sms_consent "yes" when provided', () => {
		const payload = buildCrmPayload({ ...baseLead, email: 'jane@example.com', sms_consent: 'yes' });
		expect(payload.email).toBe('jane@example.com');
		expect(payload.sms_consent).toBe('yes');
	});

	it('should POST JSON with the X-Webhook-Secret header and return the contactId', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, contactId: 'ghl_contact_42' }));

		const result = await forwardLeadToCrm({ ...baseLead, sms_consent: 'yes' });

		expect(result).toEqual({ success: true, contactId: 'ghl_contact_42' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(CRM_WEBHOOK_URL);
		expect(init.method).toBe('POST');
		expect(init.headers['X-Webhook-Secret']).toBe(TEST_SECRET);
		expect(init.headers['Content-Type']).toBe('application/json');
		const sent = JSON.parse(init.body);
		expect(sent.brand).toBe('PSG');
		expect(sent.sms_consent).toBe('yes');
		expect(sent.gclid).toBe('EAIaIQobChMI78_xxxxxx');
	});

	it('should skip the request when WEBHOOK_SECRET is not configured', async () => {
		delete process.env.WEBHOOK_SECRET;
		const result = await forwardLeadToCrm(baseLead);
		expect(result.success).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should report failure on a non-2xx response without throwing or logging the secret', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'unauthorized' }, 401));
		const result = await forwardLeadToCrm(baseLead);
		expect(result.success).toBe(false);
		expect(result.error).toContain('401');
		const logged = JSON.stringify((console.error as ReturnType<typeof vi.fn>).mock.calls);
		expect(logged).not.toContain(TEST_SECRET);
		expect(logged).not.toContain('8175550123');
	});

	it('should report failure when a 200 response does not confirm ok: true', async () => {
		fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 200 }));
		const result = await forwardLeadToCrm(baseLead);
		expect(result.success).toBe(false);
	});

	it('should report failure on timeout / network error without throwing', async () => {
		const timeout = new Error('The operation was aborted due to timeout');
		timeout.name = 'TimeoutError';
		fetchMock.mockRejectedValueOnce(timeout);
		const timedOut = await forwardLeadToCrm(baseLead);
		expect(timedOut.success).toBe(false);
		expect(timedOut.error).toContain('timed out');

		fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
		const networkFail = await forwardLeadToCrm(baseLead);
		expect(networkFail.success).toBe(false);
		expect(networkFail.error).toContain('network error');
	});
});
