import { describe, expect, it } from 'vitest';
import { normalizeFormInput, validateFormInput } from './validation.js';

describe('Form Validation & Normalization', () => {
	it('should correctly normalize form input aliases using normalizeFormInput', () => {
		const normalized = normalizeFormInput({
			service_name: 'Water damage restoration',
			fullName: 'Jane Doe',
			phoneNumber: '8175550123',
			propertyZipCode: '76234',
			whatHappened: 'Storm or flood damage',
			tellUsMore: 'Flooding in basement'
		});
		expect(normalized.service).toBe('Water damage restoration');
		expect(normalized.name).toBe('Jane Doe');
		expect(normalized.phone).toBe('8175550123');
		expect(normalized.zip).toBe('76234');
		expect(normalized.damage).toBe('Storm or flood damage');
		expect(normalized.message).toBe('Flooding in basement');
	});
	const validPayloadWithAttribution = {
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

	const validPayloadWithoutAttribution = {
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

	it('should successfully validate Example Payload 1 (with advertising attribution)', () => {
		const result = validateFormInput(validPayloadWithAttribution);
		expect(result.isValid).toBe(true);
		if (result.isValid) {
			expect(result.data.service).toBe('Water damage restoration');
			expect(result.data.name).toBe('Jane Doe');
			expect(result.data.phone).toBe('8175550123');
			expect(result.data.zip).toBe('76234');
			expect(result.data.damage).toBe('Burst pipe or plumbing leak');
			expect(result.data.message).toBe('Water leaking from ceiling under second floor bathroom.');
			expect(result.data.page).toBe('https://www.platinumsg.com/');
			expect(result.data.submission_id).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
			expect(result.data.consent).toBe('Contact me about this water damage request.');
			expect(result.data.gclid).toBe('EAIaIQobChMI78_xxxxxx');
			expect(result.data.utm_source).toBe('google');
			expect(result.data.utm_medium).toBe('cpc');
			expect(result.data.utm_campaign).toBe('water-damage-restoration');
		}
	});

	it('should successfully validate Example Payload 2 (without attribution and empty message)', () => {
		const result = validateFormInput(validPayloadWithoutAttribution);
		expect(result.isValid).toBe(true);
		if (result.isValid) {
			expect(result.data.service).toBe('Water damage restoration');
			expect(result.data.name).toBe('John Smith');
			expect(result.data.phone).toBe('8175550123');
			expect(result.data.zip).toBe('76234');
			expect(result.data.damage).toBe('Storm or flood damage');
			expect(result.data.message).toBe('');
			expect(result.data.page).toBe('https://www.platinumsg.com/');
			expect(result.data.submission_id).toBe('e0e29b46-7785-408a-9285-b9f1d0b7d7f2');
			expect(result.data.consent).toBe('Contact me about this water damage request.');
			expect(result.data.gclid).toBeUndefined();
			expect(result.data.utm_source).toBeUndefined();
			expect(result.data.utm_medium).toBeUndefined();
			expect(result.data.utm_campaign).toBeUndefined();
		}
	});

	it('should auto-generate submission_id and accept omitted optional fields', () => {
		const minimalPayload = {
			service: 'Water damage restoration',
			name: 'Alice Springs',
			phone: '817-555-4321',
			zip: '76234',
			damage: 'Ceiling or roof leak'
		};
		const result = validateFormInput(minimalPayload);
		expect(result.isValid).toBe(true);
		if (result.isValid) {
			expect(result.data.submission_id).toBeDefined();
			expect(result.data.submission_id.length).toBeGreaterThan(10);
			expect(result.data.page).toBeUndefined();
			expect(result.data.message).toBeUndefined();
			expect(result.data.consent).toBeUndefined();
			expect(result.data.gclid).toBeUndefined();
		}
	});

	it('should support additional tracking fields (gbraid, wbraid, utm_term, utm_content)', () => {
		const payloadWithAllTracking = {
			...validPayloadWithAttribution,
			gbraid: 'sample_gbraid_ios',
			wbraid: 'sample_wbraid_web',
			utm_term: 'emergency flood cleanup',
			utm_content: 'banner_header_cta'
		};
		const result = validateFormInput(payloadWithAllTracking);
		expect(result.isValid).toBe(true);
		if (result.isValid) {
			expect(result.data.gbraid).toBe('sample_gbraid_ios');
			expect(result.data.wbraid).toBe('sample_wbraid_web');
			expect(result.data.utm_term).toBe('emergency flood cleanup');
			expect(result.data.utm_content).toBe('banner_header_cta');
		}
	});

	it('should support frontend field name variations and aliases (camelCase, snake_case)', () => {
		const alternativeFields = {
			service_name: 'Water damage restoration',
			fullName: 'Robert Frost',
			phoneNumber: '8175551234',
			propertyZipCode: '76001-1234',
			whatHappened: 'Appliance or water heater leak',
			tellUsMore: 'Affecting the laundry room and adjacent closet.'
		};
		const result = validateFormInput(alternativeFields);
		expect(result.isValid).toBe(true);
		if (result.isValid) {
			expect(result.data.service).toBe('Water damage restoration');
			expect(result.data.name).toBe('Robert Frost');
			expect(result.data.phone).toBe('8175551234');
			expect(result.data.zip).toBe('76001-1234');
			expect(result.data.zipCode).toBe('76001-1234');
			expect(result.data.damage).toBe('Appliance or water heater leak');
			expect(result.data.issue).toBe('Appliance or water heater leak');
			expect(result.data.message).toBe('Affecting the laundry room and adjacent closet.');
			expect(result.data.details).toBe('Affecting the laundry room and adjacent closet.');
		}
	});

	it('should reject when required fields are missing', () => {
		const result = validateFormInput({});
		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.errors.service).toBeDefined();
			expect(result.errors.name).toBeDefined();
			expect(result.errors.phone).toBeDefined();
			expect(result.errors.zip).toBeDefined();
			expect(result.errors.damage).toBeDefined();
		}
	});

	it('should reject invalid data types without crashing the server', () => {
		const invalidTypes = {
			service: 12345, // Number instead of string
			name: true, // Boolean instead of string
			phone: 8175550123, // Number instead of string
			zip: ['76234'], // Array instead of string
			damage: { issue: 'leak' }, // Object instead of string
			message: 9999, // Number instead of string
			page: false, // Boolean instead of string
			submission_id: 12345, // Number instead of string
			gclid: 98765, // Number instead of string
			utm_source: { src: 'google' } // Object instead of string
		};
		const result = validateFormInput(invalidTypes);
		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.errors.service).toContain('must be a string');
			expect(result.errors.name).toContain('must be a string');
			expect(result.errors.phone).toContain('must be a string');
			expect(result.errors.zip).toContain('must be a string');
			expect(result.errors.damage).toContain('must be a string');
			expect(result.errors.message).toContain('must be a string');
			expect(result.errors.page).toContain('must be a string');
			expect(result.errors.submission_id).toContain('must be a string');
			expect(result.errors.gclid).toContain('must be a string');
			expect(result.errors.utm_source).toContain('must be a string');
		}
	});

	it('should reject name when less than 2 characters or exceeding 100 characters', () => {
		const shortNameResult = validateFormInput({ ...validPayloadWithoutAttribution, name: 'A' });
		expect(shortNameResult.isValid).toBe(false);
		if (!shortNameResult.isValid) {
			expect(shortNameResult.errors.name).toContain('at least 2 characters');
		}

		const longNameResult = validateFormInput({
			...validPayloadWithoutAttribution,
			name: 'A'.repeat(101)
		});
		expect(longNameResult.isValid).toBe(false);
		if (!longNameResult.isValid) {
			expect(longNameResult.errors.name).toContain('cannot exceed 100 characters');
		}
	});

	it('should reject invalid phone numbers and accept various valid formats', () => {
		const invalidPhones = ['', '   ', '123', 'abc-def-ghij', '(817) 12'];
		for (const phone of invalidPhones) {
			const result = validateFormInput({ ...validPayloadWithoutAttribution, phone });
			expect(result.isValid).toBe(false);
			if (!result.isValid) {
				expect(result.errors.phone).toBeDefined();
			}
		}

		const validPhones = [
			'8175550123',
			'(817) 555-0123',
			'817-555-0123',
			'+1 817 555 0123',
			'+1 (817) 555-0123'
		];
		for (const phone of validPhones) {
			const result = validateFormInput({ ...validPayloadWithoutAttribution, phone });
			expect(result.isValid).toBe(true);
		}
	});

	it('should reject invalid ZIP codes and accept 5-digit US ZIP and ZIP+4', () => {
		const invalidZips = ['', '1234', '762345', 'ABCDE', '76234-'];
		for (const zip of invalidZips) {
			const result = validateFormInput({ ...validPayloadWithoutAttribution, zip });
			expect(result.isValid).toBe(false);
			if (!result.isValid) {
				expect(result.errors.zip).toBeDefined();
			}
		}

		const validZips = ['76234', '90210', '10001', '76234-1234'];
		for (const zip of validZips) {
			const result = validateFormInput({ ...validPayloadWithoutAttribution, zip });
			expect(result.isValid).toBe(true);
		}
	});

	it('should reject placeholder values for damage selection', () => {
		const placeholders = [
			'',
			'   ',
			'Select the water issue',
			'select',
			'Select The Damage',
			'none',
			'choose'
		];
		for (const damage of placeholders) {
			const result = validateFormInput({ ...validPayloadWithoutAttribution, damage });
			expect(result.isValid).toBe(false);
			if (!result.isValid) {
				expect(result.errors.damage).toBeDefined();
			}
		}
	});

	it('should accept all screenshot dropdown damage options', () => {
		const options = [
			'Burst pipe or plumbing leak',
			'Appliance or water heater leak',
			'Storm or flood damage',
			'Ceiling or roof leak',
			'Sewage backup or overflow',
			'Other / not sure'
		];
		for (const damage of options) {
			const result = validateFormInput({ ...validPayloadWithoutAttribution, damage });
			expect(result.isValid).toBe(true);
		}
	});

	it('should reject message exceeding 2000 characters', () => {
		const oversizedMessage = 'A'.repeat(2001);
		const result = validateFormInput({
			...validPayloadWithoutAttribution,
			message: oversizedMessage
		});
		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.errors.message).toContain('cannot exceed 2000 characters');
		}
	});

	it('should reject invalid page URL format when provided', () => {
		const invalidPageResult = validateFormInput({
			...validPayloadWithoutAttribution,
			page: 'ftp://invalidscheme.com'
		});
		expect(invalidPageResult.isValid).toBe(false);
		if (!invalidPageResult.isValid) {
			expect(invalidPageResult.errors.page).toContain('HTTP or HTTPS');
		}
	});

	it('should sanitize control characters and strip null bytes', () => {
		const raw = {
			service: 'Water damage\u0000 restoration',
			name: 'John\u0000 Doe\u001F',
			phone: '(817) 555-0123',
			zip: '76234',
			damage: 'Flood issue\u0007',
			message: 'Line 1\nLine 2'
		};
		const result = validateFormInput(raw);
		expect(result.isValid).toBe(true);
		if (result.isValid) {
			expect(result.data.service).toBe('Water damage restoration');
			expect(result.data.name).toBe('John Doe');
			expect(result.data.damage).toBe('Flood issue');
			expect(result.data.message).toBe('Line 1\nLine 2');
		}
	});

	it('should reject non-object payloads', () => {
		// @ts-expect-error testing invalid payload type
		const arrayResult = validateFormInput([1, 2, 3]);
		expect(arrayResult.isValid).toBe(false);

		// @ts-expect-error testing null payload
		const nullResult = validateFormInput(null);
		expect(nullResult.isValid).toBe(false);
	});
});
