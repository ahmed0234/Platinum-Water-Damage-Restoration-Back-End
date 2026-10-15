export interface LeadSubmissionData {
	service: string;
	name: string;
	phone: string;
	zip: string;
	damage: string;
	message?: string;
	page?: string;
	submission_id: string;
	consent?: string;

	// Optional advertising attribution parameters
	gclid?: string;
	gbraid?: string;
	wbraid?: string;
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	utm_term?: string;
	utm_content?: string;

	// Compatibility aliases
	zipCode: string;
	issue: string;
	details?: string;
}

// Backwards-compatible alias for existing imports
export type CallbackRequestData = LeadSubmissionData;

export interface ValidationSuccess {
	isValid: true;
	data: LeadSubmissionData;
}

export interface ValidationFailure {
	isValid: false;
	errors: Record<string, string>;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Strips null bytes and control characters while preserving valid text and standard line breaks.
 */
export function sanitizeString(value: string): string {
	// Remove null bytes and dangerous control characters for input safety
	// eslint-disable-next-line no-control-regex
	return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

/**
 * Normalizes and validates incoming form submission input.
 * Implements practical, medium-level validation:
 * - Requires core fields: service, name, phone, zip, damage.
 * - Enforces sensible length limits.
 * - Handles optional fields (message, consent, page, submission_id, tracking parameters).
 * - Gracefully flags invalid data types without crashing.
 */
export function validateFormInput(raw: Record<string, unknown>): ValidationResult {
	const errors: Record<string, string> = {};

	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return {
			isValid: false,
			errors: { payload: 'Payload must be a valid JSON object.' }
		};
	}

	// 1. Service validation (Required, 1-100 characters)
	const rawService = raw.service ?? raw.service_name ?? raw.serviceName;
	let finalService = '';
	if (rawService === undefined || rawService === null) {
		errors.service = 'Service is required.';
	} else if (typeof rawService !== 'string') {
		errors.service = 'Service must be a string.';
	} else {
		finalService = sanitizeString(rawService);
		if (!finalService) {
			errors.service = 'Service is required.';
		} else if (finalService.length > 100) {
			errors.service = 'Service cannot exceed 100 characters.';
		}
	}

	// 2. Name validation (Required, 2-100 characters)
	const rawName = raw.name ?? raw.fullName ?? raw.yourName ?? raw.full_name ?? raw.your_name;
	let finalName = '';
	if (rawName === undefined || rawName === null) {
		errors.name = 'Your name is required.';
	} else if (typeof rawName !== 'string') {
		errors.name = 'Your name must be a string.';
	} else {
		finalName = sanitizeString(rawName);
		if (!finalName) {
			errors.name = 'Your name is required.';
		} else if (finalName.length < 2) {
			errors.name = 'Your name must be at least 2 characters long.';
		} else if (finalName.length > 100) {
			errors.name = 'Your name cannot exceed 100 characters.';
		}
	}

	// 3. Phone validation (Required, 7-15 digits, standard US or international phone)
	const rawPhone = raw.phone ?? raw.phoneNumber ?? raw.phone_number;
	let finalPhone = '';
	if (rawPhone === undefined || rawPhone === null) {
		errors.phone = 'Phone number is required.';
	} else if (typeof rawPhone !== 'string') {
		errors.phone = 'Phone number must be a string.';
	} else {
		finalPhone = sanitizeString(rawPhone);
		if (!finalPhone) {
			errors.phone = 'Phone number is required.';
		} else {
			const digitsOnly = finalPhone.replace(/\D/g, '');
			const validCharsOnly = /^[+]?[\d\s\-().]{7,30}$/;
			if (digitsOnly.length < 7 || digitsOnly.length > 15 || !validCharsOnly.test(finalPhone)) {
				errors.phone = 'Please enter a valid phone number (e.g., (817) 555-0123 or 8175550123).';
			} else if (finalPhone.length > 30) {
				errors.phone = 'Phone number cannot exceed 30 characters.';
			}
		}
	}

	// 4. Property ZIP code validation (Required, 5-digit US ZIP or ZIP+4)
	const rawZip =
		raw.zip ??
		raw.zipCode ??
		raw.propertyZipCode ??
		raw.postalCode ??
		raw.zip_code ??
		raw.property_zip_code;
	let finalZip = '';
	if (rawZip === undefined || rawZip === null) {
		errors.zip = 'Property ZIP code is required.';
		errors.zipCode = 'Property ZIP code is required.';
	} else if (typeof rawZip !== 'string') {
		errors.zip = 'Property ZIP code must be a string.';
		errors.zipCode = 'Property ZIP code must be a string.';
	} else {
		finalZip = sanitizeString(rawZip);
		if (!finalZip) {
			errors.zip = 'Property ZIP code is required.';
			errors.zipCode = 'Property ZIP code is required.';
		} else {
			const usZipRegex = /^\d{5}(-\d{4})?$/;
			if (!usZipRegex.test(finalZip)) {
				const errMsg = 'Please enter a valid 5-digit US ZIP code (e.g., 76234).';
				errors.zip = errMsg;
				errors.zipCode = errMsg;
			}
		}
	}

	// 5. Damage / Water Issue validation (Required, 1-200 characters, not placeholder)
	const rawDamage =
		raw.damage ??
		raw.damage_type ??
		raw.issue ??
		raw.waterIssue ??
		raw.whatHappened ??
		raw.water_issue ??
		raw.what_happened;
	let finalDamage = '';
	if (rawDamage === undefined || rawDamage === null) {
		errors.damage = 'Please select the damage type.';
		errors.issue = 'Please select the water issue (what happened).';
	} else if (typeof rawDamage !== 'string') {
		errors.damage = 'Damage type must be a string.';
		errors.issue = 'Damage type must be a string.';
	} else {
		finalDamage = sanitizeString(rawDamage);
		const placeholderPattern = /^(select(\s+the)?(\s+water)?(\s+(issue|damage))?|none|choose)$/i;
		if (!finalDamage || placeholderPattern.test(finalDamage)) {
			errors.damage = 'Please select the damage type.';
			errors.issue = 'Please select the water issue (what happened).';
		} else if (finalDamage.length > 200) {
			errors.damage = 'Damage description cannot exceed 200 characters.';
			errors.issue = 'Issue description cannot exceed 200 characters.';
		}
	}

	// 6. Message / Details validation (Optional, up to 2000 characters)
	const rawMessage =
		raw.message ??
		raw.details ??
		raw.tellUsMore ??
		raw.additionalDetails ??
		raw.tell_us_more ??
		raw.additional_details ??
		raw.notes;
	let finalMessage: string | undefined = undefined;
	if (rawMessage !== undefined && rawMessage !== null) {
		if (typeof rawMessage !== 'string') {
			errors.message = 'Message must be a string.';
			errors.details = 'Details must be a string.';
		} else {
			const sanitized = sanitizeString(rawMessage);
			if (sanitized.length > 2000) {
				errors.message = 'Message cannot exceed 2000 characters.';
				errors.details = 'Additional details cannot exceed 2000 characters.';
			} else {
				finalMessage = sanitized;
			}
		}
	}

	// 7. Page URL validation (Optional / system field, up to 2000 characters)
	const rawPage = raw.page ?? raw.page_url ?? raw.pageUrl ?? raw.url;
	let finalPage: string | undefined = undefined;
	if (rawPage !== undefined && rawPage !== null) {
		if (typeof rawPage !== 'string') {
			errors.page = 'Page URL must be a string.';
		} else {
			const sanitized = sanitizeString(rawPage);
			if (sanitized.length > 2000) {
				errors.page = 'Page URL cannot exceed 2000 characters.';
			} else if (sanitized.length > 0) {
				try {
					const parsed = new URL(sanitized);
					if (!['http:', 'https:'].includes(parsed.protocol)) {
						errors.page = 'Page URL must use HTTP or HTTPS protocol.';
					} else {
						finalPage = sanitized;
					}
				} catch {
					if (sanitized.startsWith('/')) {
						finalPage = sanitized;
					} else {
						errors.page = 'Page URL must be a valid URL.';
					}
				}
			}
		}
	}

	// 8. Submission ID validation (Optional / system field, UUID v4 or 8-128 chars; auto-generates if omitted)
	const rawSubmissionId = raw.submission_id ?? raw.submissionId ?? raw.id;
	let finalSubmissionId = '';
	if (rawSubmissionId !== undefined && rawSubmissionId !== null) {
		if (typeof rawSubmissionId !== 'string') {
			errors.submission_id = 'Submission ID must be a string.';
		} else {
			const sanitized = sanitizeString(rawSubmissionId);
			if (sanitized.length < 8 || sanitized.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
				errors.submission_id = 'Submission ID must be a valid identifier format.';
			} else {
				finalSubmissionId = sanitized;
			}
		}
	} else {
		finalSubmissionId = crypto.randomUUID();
	}

	// 9. Consent text validation (Optional / system field, max 500 characters)
	const rawConsent = raw.consent ?? raw.consent_text ?? raw.consentText;
	let finalConsent: string | undefined = undefined;
	if (rawConsent !== undefined && rawConsent !== null) {
		if (typeof rawConsent !== 'string') {
			errors.consent = 'Consent must be a string.';
		} else {
			const sanitized = sanitizeString(rawConsent);
			if (sanitized.length > 500) {
				errors.consent = 'Consent text cannot exceed 500 characters.';
			} else if (sanitized.length > 0) {
				finalConsent = sanitized;
			}
		}
	}

	// 10. Tracking / attribution parameters (Optional strings, max 255 characters each)
	const trackingFields = [
		'gclid',
		'gbraid',
		'wbraid',
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_term',
		'utm_content'
	] as const;

	const trackingData: Partial<Record<(typeof trackingFields)[number], string>> = {};

	for (const field of trackingFields) {
		const val = raw[field];
		if (val !== undefined && val !== null) {
			if (typeof val !== 'string') {
				errors[field] = `${field} must be a string.`;
			} else {
				const sanitized = sanitizeString(val);
				if (sanitized.length > 255) {
					errors[field] = `${field} cannot exceed 255 characters.`;
				} else if (sanitized.length > 0) {
					trackingData[field] = sanitized;
				}
			}
		}
	}

	if (Object.keys(errors).length > 0) {
		return { isValid: false, errors };
	}

	return {
		isValid: true,
		data: {
			service: finalService,
			name: finalName,
			phone: finalPhone,
			zip: finalZip,
			damage: finalDamage,
			message: finalMessage,
			page: finalPage,
			submission_id: finalSubmissionId,
			consent: finalConsent,
			...trackingData,
			// Backwards-compatibility aliases
			zipCode: finalZip,
			issue: finalDamage,
			details: finalMessage
		}
	};
}

/**
 * Normalizes input keys for inspection or legacy helpers.
 */
export function normalizeFormInput(raw: Record<string, unknown>): {
	service: string;
	name: string;
	phone: string;
	zipCode: string;
	zip: string;
	issue: string;
	damage: string;
	details: string;
	message: string;
} {
	const sanitized = (val: unknown): string => (typeof val === 'string' ? sanitizeString(val) : '');

	const service = sanitized(raw.service ?? raw.service_name ?? raw.serviceName);
	const name = sanitized(
		raw.name ?? raw.fullName ?? raw.yourName ?? raw.full_name ?? raw.your_name
	);
	const phone = sanitized(raw.phone ?? raw.phoneNumber ?? raw.phone_number);
	const zip = sanitized(
		raw.zip ??
			raw.zipCode ??
			raw.propertyZipCode ??
			raw.postalCode ??
			raw.zip_code ??
			raw.property_zip_code
	);
	const damage = sanitized(
		raw.damage ??
			raw.damage_type ??
			raw.issue ??
			raw.waterIssue ??
			raw.whatHappened ??
			raw.water_issue ??
			raw.what_happened
	);
	const message = sanitized(
		raw.message ??
			raw.details ??
			raw.tellUsMore ??
			raw.additionalDetails ??
			raw.tell_us_more ??
			raw.additional_details ??
			raw.notes
	);

	return {
		service,
		name,
		phone,
		zip,
		zipCode: zip,
		damage,
		issue: damage,
		details: message,
		message
	};
}
