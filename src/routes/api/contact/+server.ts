import { json, type RequestHandler } from '@sveltejs/kit';
import { getAllowedOrigins } from '#lib/server/config.js';
import { extractRequestOrigin, getCorsHeaders, isOriginAllowed } from '#lib/server/cors.js';
import { sendLeadNotificationEmail } from '#lib/server/email.js';
import { validateFormInput } from '#lib/server/validation.js';

const MAX_PAYLOAD_BYTES = 50 * 1024; // 50 KB

/**
 * Handles CORS Preflight OPTIONS requests.
 */
export const OPTIONS: RequestHandler = async ({ request }) => {
	const origin = extractRequestOrigin(request);
	const allowedOrigins = getAllowedOrigins();

	if (!isOriginAllowed(origin, allowedOrigins)) {
		return json({ success: false, error: 'Origin not allowed' }, { status: 403 });
	}

	const corsHeaders = getCorsHeaders(origin, allowedOrigins);
	return new Response(null, {
		status: 204,
		headers: corsHeaders
	});
};

/**
 * Handles form submission POST requests.
 */
export const POST: RequestHandler = async ({ request }) => {
	const origin = extractRequestOrigin(request);
	const allowedOrigins = getAllowedOrigins();
	const corsHeaders = getCorsHeaders(origin, allowedOrigins);

	// 1. Origin verification
	if (!isOriginAllowed(origin, allowedOrigins)) {
		return json(
			{
				success: false,
				error: 'Origin not allowed. Cross-origin request rejected.'
			},
			{ status: 403, headers: corsHeaders }
		);
	}

	// 2. Payload size protection via Content-Length header
	const contentLength = request.headers.get('content-length');
	if (contentLength) {
		const parsedLength = parseInt(contentLength, 10);
		if (!isNaN(parsedLength) && parsedLength > MAX_PAYLOAD_BYTES) {
			return json(
				{
					success: false,
					error: 'Payload too large. Maximum size is 50KB.'
				},
				{ status: 413, headers: corsHeaders }
			);
		}
	}

	// 3. Payload parsing & malformed JSON check
	let body: Record<string, unknown>;
	try {
		const rawText = await request.text();

		if (!rawText || rawText.trim() === '') {
			return json(
				{
					success: false,
					error: 'Empty request body. Please submit valid form data.'
				},
				{ status: 400, headers: corsHeaders }
			);
		}

		if (rawText.length > MAX_PAYLOAD_BYTES) {
			return json(
				{
					success: false,
					error: 'Payload too large. Maximum size is 50KB.'
				},
				{ status: 413, headers: corsHeaders }
			);
		}

		body = JSON.parse(rawText);

		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return json(
				{
					success: false,
					error: 'Invalid payload structure. Expected a JSON object.'
				},
				{ status: 400, headers: corsHeaders }
			);
		}
	} catch {
		return json(
			{
				success: false,
				error: 'Malformed JSON payload.'
			},
			{ status: 400, headers: corsHeaders }
		);
	}

	// 4. Form fields validation
	const validation = validateFormInput(body);
	if (!validation.isValid) {
		return json(
			{
				success: false,
				error: 'Form validation failed.',
				errors: validation.errors
			},
			{ status: 400, headers: corsHeaders }
		);
	}

	// 5. Send notification email to both recipients using Resend
	const emailResult = await sendLeadNotificationEmail(validation.data);
	if (!emailResult.success) {
		return json(
			{
				success: false,
				error: 'Unable to deliver callback request at this time. Please try again later.'
			},
			{ status: 500, headers: corsHeaders }
		);
	}

	// 6. Successful response
	return json(
		{
			success: true,
			message: 'Callback request received successfully. A specialist will call you shortly.',
			submission_id: validation.data.submission_id
		},
		{ status: 200, headers: corsHeaders }
	);
};
