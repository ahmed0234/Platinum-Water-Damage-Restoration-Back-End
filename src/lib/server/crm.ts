import { getWebhookSecret } from './config.js';
import type { LeadSubmissionData } from './validation.js';

export const CRM_WEBHOOK_URL = 'https://trio-callrail-bridge.vercel.app/api/lead';
const CRM_TIMEOUT_MS = 5000;

export interface CrmLeadPayload {
	brand: 'PSG';
	name: string;
	phone: string;
	email?: string;
	service: string;
	damage: string;
	zip: string;
	message?: string;
	gclid?: string;
	sms_consent: 'yes' | 'no';
	page?: string;
}

export interface ForwardLeadResult {
	success: boolean;
	contactId?: string;
	error?: string;
}

/**
 * Maps a validated lead to the GoHighLevel bridge payload.
 * Optional fields are omitted rather than sent as empty strings.
 */
export function buildCrmPayload(data: LeadSubmissionData): CrmLeadPayload {
	const payload: CrmLeadPayload = {
		brand: 'PSG',
		name: data.name,
		phone: data.phone,
		service: data.service,
		damage: data.damage,
		zip: data.zip,
		sms_consent: data.sms_consent === 'yes' ? 'yes' : 'no'
	};

	if (data.email) payload.email = data.email;
	if (data.message) payload.message = data.message;
	if (data.gclid) payload.gclid = data.gclid;
	if (data.page) payload.page = data.page;

	return payload;
}

/**
 * Forwards a lead to the GoHighLevel CRM bridge. Never throws: failures are logged
 * (without the secret or customer details) and reported in the result so the caller
 * can keep the email flow and user-facing response unaffected.
 */
export async function forwardLeadToCrm(data: LeadSubmissionData): Promise<ForwardLeadResult> {
	const secret = getWebhookSecret();
	if (!secret) {
		console.error(
			`[CrmService] WEBHOOK_SECRET is not configured. Skipped CRM forward for submission ${data.submission_id}.`
		);
		return { success: false, error: 'CRM webhook is not configured.' };
	}

	try {
		const response = await fetch(CRM_WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'X-Webhook-Secret': secret
			},
			body: JSON.stringify(buildCrmPayload(data)),
			signal: AbortSignal.timeout(CRM_TIMEOUT_MS)
		});

		let result: { ok?: unknown; contactId?: unknown } | null = null;
		try {
			result = await response.json();
		} catch {
			result = null;
		}

		if (!response.ok || result?.ok !== true) {
			console.error(
				`[CrmService] CRM bridge did not accept submission ${data.submission_id} (HTTP ${response.status}).`
			);
			return { success: false, error: `CRM bridge responded with HTTP ${response.status}.` };
		}

		const contactId = typeof result.contactId === 'string' ? result.contactId : undefined;
		console.info(
			`[CrmService] Submission ${data.submission_id} forwarded to CRM${contactId ? ` (contact ${contactId})` : ''}.`
		);
		return { success: true, contactId };
	} catch (error) {
		const reason =
			error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
				? `timed out after ${CRM_TIMEOUT_MS}ms`
				: 'network error';
		console.error(
			`[CrmService] CRM forward failed for submission ${data.submission_id} (${reason}).`
		);
		return { success: false, error: `CRM request failed (${reason}).` };
	}
}
