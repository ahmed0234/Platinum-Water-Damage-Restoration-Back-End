import { describe, expect, it } from 'vitest';
import {
	escapeHtml,
	renderLeadEmailHtml,
	renderLeadEmailText,
	sendLeadNotificationEmail
} from './email.js';

describe('Email Rendering & Security', () => {
	const sampleDataWithAttribution = {
		service: 'Water damage restoration',
		name: 'Jane Doe',
		phone: '(817) 555-0123',
		zip: '76234',
		zipCode: '76234',
		damage: 'Burst pipe or plumbing leak',
		issue: 'Burst pipe or plumbing leak',
		message: 'Water leaking from ceiling under second floor bathroom.',
		page: 'https://www.platinumsg.com/',
		submission_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
		consent: 'Contact me about this water damage request.',
		gclid: 'EAIaIQobChMI78_xxxxxx',
		utm_source: 'google',
		utm_medium: 'cpc',
		utm_campaign: 'water-damage-restoration'
	};

	const sampleDataWithoutAttribution = {
		service: 'Water damage restoration',
		name: 'John Smith',
		phone: '8175550123',
		zip: '76234',
		zipCode: '76234',
		damage: 'Storm or flood damage',
		issue: 'Storm or flood damage',
		message: '',
		page: 'https://www.platinumsg.com/',
		submission_id: 'e0e29b46-7785-408a-9285-b9f1d0b7d7f2',
		consent: 'Contact me about this water damage request.'
	};

	it('should strictly escape HTML special characters to prevent HTML injection / XSS in email clients', () => {
		const malicious = `<script>alert('XSS')</script> & "quotes"`;
		const escaped = escapeHtml(malicious);

		expect(escaped).not.toContain('<script>');
		expect(escaped).not.toContain('</script>');
		expect(escaped).toContain('&lt;script&gt;');
		expect(escaped).toContain('&lt;/script&gt;');
		expect(escaped).toContain('&amp;');
		expect(escaped).toContain('&quot;');
		expect(escaped).toContain('&#39;');
	});

	it('should render HTML email with all lead fields and marketing attribution', () => {
		const fixedDate = new Date('2026-10-15T12:00:00Z');
		const html = renderLeadEmailHtml(sampleDataWithAttribution, fixedDate);

		// Brand & Header
		expect(html).toContain('New Customer Lead Received');
		expect(html).toContain('Urgent Lead Notification');
		expect(html).toContain('Action Required: Call Customer');
		expect(html).toContain('Call Customer &rarr;');

		// All field labels and values
		expect(html).toContain('Service Requested');
		expect(html).toContain('Water damage restoration');
		expect(html).toContain('Customer Name');
		expect(html).toContain('Jane Doe');
		expect(html).toContain('Phone Number');
		expect(html).toContain('(817) 555-0123');
		expect(html).toContain('Property ZIP Code');
		expect(html).toContain('76234');
		expect(html).toContain('Reported Issue');
		expect(html).toContain('Burst pipe or plumbing leak');
		expect(html).toContain('Customer Message / Additional Details');
		expect(html).toContain('Water leaking from ceiling under second floor bathroom.');

		// Attribution fields
		expect(html).toContain('Advertising &amp; Attribution');
		expect(html).toContain('Google Click ID (gclid)');
		expect(html).toContain('EAIaIQobChMI78_xxxxxx');
		expect(html).toContain('Traffic Source (utm_source)');
		expect(html).toContain('google');
		expect(html).toContain('Marketing Medium (utm_medium)');
		expect(html).toContain('cpc');
		expect(html).toContain('Campaign Name (utm_campaign)');
		expect(html).toContain('water-damage-restoration');

		// Submission details & compliance
		expect(html).toContain('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
		expect(html).toContain('https://www.platinumsg.com/');
		expect(html).toContain('Contact me about this water damage request.');

		// Clickable tel link
		expect(html).toContain('href="tel:8175550123"');
	});

	it('should omit attribution section when tracking parameters are absent', () => {
		const html = renderLeadEmailHtml(sampleDataWithoutAttribution);
		expect(html).not.toContain('Advertising &amp; Attribution');
		expect(html).toContain('<em>None provided</em>');
		expect(html).toContain('e0e29b46-7785-408a-9285-b9f1d0b7d7f2');
	});

	it('should render plain text email matching form contents and attribution', () => {
		const fixedDate = new Date('2026-10-15T12:00:00Z');
		const text = renderLeadEmailText(sampleDataWithAttribution, fixedDate);

		expect(text).toContain('NEW LEAD NOTIFICATION - PLATINUM RESTORATION');
		expect(text).toContain('ACTION REQUIRED:');
		expect(text).toContain('Call Jane Doe at (817) 555-0123');
		expect(text).toContain('Service Requested: Water damage restoration');
		expect(text).toContain('Customer Name:     Jane Doe');
		expect(text).toContain('Phone Number:      (817) 555-0123');
		expect(text).toContain('Property ZIP Code: 76234');
		expect(text).toContain('Reported Issue:    Burst pipe or plumbing leak');
		expect(text).toContain('CUSTOMER MESSAGE / NOTES:');
		expect(text).toContain('Water leaking from ceiling under second floor bathroom.');
		expect(text).toContain('Submission ID: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
		expect(text).toContain('Submitted URL: https://www.platinumsg.com/');
		expect(text).toContain('Google Click ID (gclid): EAIaIQobChMI78_xxxxxx');
		expect(text).toContain('Traffic Source (utm_source): google');
	});
});

describe('sendLeadNotificationEmail execution', () => {
	it('should fail gracefully if RESEND_API_KEY is missing', async () => {
		const originalKey = process.env.RESEND_API_KEY;
		delete process.env.RESEND_API_KEY;

		const result = await sendLeadNotificationEmail({
			service: 'Water damage restoration',
			name: 'Test',
			phone: '8175551234',
			zip: '76234',
			zipCode: '76234',
			damage: 'Pipe burst',
			issue: 'Pipe burst',
			submission_id: 'sub_12345678'
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('Email service is not configured');

		if (originalKey) {
			process.env.RESEND_API_KEY = originalKey;
		}
	});

	it('should fail gracefully if recipient email addresses are not configured', async () => {
		process.env.RESEND_API_KEY = 're_test_key_12345';
		const orig1 = process.env.RECIPIENT_EMAIL_1;
		const orig2 = process.env.RECIPIENT_EMAIL_2;
		const origAll = process.env.RECIPIENT_EMAILS;

		delete process.env.RECIPIENT_EMAIL_1;
		delete process.env.RECIPIENT_EMAIL_2;
		delete process.env.RECIPIENT_EMAILS;

		const result = await sendLeadNotificationEmail({
			service: 'Water damage restoration',
			name: 'Test',
			phone: '8175551234',
			zip: '76234',
			zipCode: '76234',
			damage: 'Pipe burst',
			issue: 'Pipe burst',
			submission_id: 'sub_12345678'
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('Recipient email addresses are not configured');

		if (orig1) process.env.RECIPIENT_EMAIL_1 = orig1;
		if (orig2) process.env.RECIPIENT_EMAIL_2 = orig2;
		if (origAll) process.env.RECIPIENT_EMAILS = origAll;
	});
});
