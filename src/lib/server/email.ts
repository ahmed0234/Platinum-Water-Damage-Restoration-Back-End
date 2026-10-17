import { Resend } from 'resend';
import { getRecipientEmails, getResendApiKey, getResendFromEmail } from './config.js';
import type { LeadSubmissionData } from './validation.js';

/**
 * Escapes characters with special meaning in HTML to prevent HTML injection (XSS in email clients).
 */
export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Formats multi-line user text safely by escaping HTML first, then converting newlines to <br/> tags.
 */
function formatMultilineHtml(str: string): string {
	return escapeHtml(str).replace(/\r?\n/g, '<br/>');
}

/**
 * Renders a clean, high-conversion, professional HTML email for dispatch and specialists.
 */
export function renderLeadEmailHtml(
	data: LeadSubmissionData,
	timestamp: Date = new Date()
): string {
	const serviceName = data.service || 'Water damage restoration';
	const safeService = escapeHtml(serviceName);
	const safeName = escapeHtml(data.name);
	const safePhone = escapeHtml(data.phone);
	const safeZip = escapeHtml(data.zip || data.zipCode || '');
	const damageText = data.damage || data.issue || '';
	const safeDamage = escapeHtml(damageText);
	const messageText =
		data.message !== undefined && data.message !== null ? data.message : (data.details ?? '');
	const safeDetails = messageText ? formatMultilineHtml(messageText) : '<em>None provided</em>';
	const safeSubmissionId = escapeHtml(data.submission_id || 'N/A');
	const safePage = data.page ? escapeHtml(data.page) : '';
	const safeConsent = data.consent ? escapeHtml(data.consent) : '';

	// Clean phone number for tel: link
	const telHref = safePhone.replace(/[^0-9+]/g, '');
	const formattedDate = timestamp.toUTCString();

	// Check if attribution parameters exist
	const trackingItems: Array<{ label: string; value: string }> = [];
	if (data.utm_source)
		trackingItems.push({ label: 'Traffic Source (utm_source)', value: data.utm_source });
	if (data.utm_medium)
		trackingItems.push({ label: 'Marketing Medium (utm_medium)', value: data.utm_medium });
	if (data.utm_campaign)
		trackingItems.push({ label: 'Campaign Name (utm_campaign)', value: data.utm_campaign });
	if (data.utm_term) trackingItems.push({ label: 'Search Term (utm_term)', value: data.utm_term });
	if (data.utm_content)
		trackingItems.push({ label: 'Ad Content (utm_content)', value: data.utm_content });
	if (data.gclid) trackingItems.push({ label: 'Google Click ID (gclid)', value: data.gclid });
	if (data.gbraid) trackingItems.push({ label: 'iOS Click ID (gbraid)', value: data.gbraid });
	if (data.wbraid) trackingItems.push({ label: 'Web Click ID (wbraid)', value: data.wbraid });

	let attributionHtml = '';
	if (trackingItems.length > 0) {
		const rowsHtml = trackingItems
			.map(
				(item) => `
				<tr>
					<td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; width: 40%; font-size: 13px; font-weight: 600; color: #475569;">
						${escapeHtml(item.label)}
					</td>
					<td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; width: 60%; font-size: 13px; color: #0f172a; word-break: break-all;">
						<code style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${escapeHtml(item.value)}</code>
					</td>
				</tr>`
			)
			.join('');

		attributionHtml = `
		<!-- Marketing & Attribution Section -->
		<tr>
			<td style="padding: 0 32px 28px 32px;">
				<h2 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
					Advertising &amp; Attribution
				</h2>
				<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: collapse; background-color: #f8fafc;">
					${rowsHtml}
				</table>
			</td>
		</tr>`;
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>New Lead Notification - Platinum Restoration</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
	<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
		<tr>
			<td align="center">
				<table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">

					<!-- Header Banner -->
					<tr>
						<td style="background-color: #0f172a; padding: 28px 32px; text-align: left; border-bottom: 4px solid #dc2626;">
							<div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #ef4444; font-weight: 700; margin-bottom: 6px;">
								Urgent Lead Notification
							</div>
							<h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
								New Customer Lead Received
							</h1>
							<p style="margin: 4px 0 0 0; font-size: 14px; color: #94a3b8;">
								A new lead has been submitted via the website. Contact the customer promptly.
							</p>
						</td>
					</tr>

					<!-- Call to Action Banner -->
					<tr>
						<td style="background-color: #fef2f2; padding: 18px 32px; border-bottom: 1px solid #fee2e2;">
							<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
								<tr>
									<td style="vertical-align: middle;">
										<div style="font-size: 13px; font-weight: 600; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Action Required: Call Customer</div>
										<div style="font-size: 16px; font-weight: 700; color: #b91c1c; margin-top: 2px;">${safeName} &bull; <a href="tel:${telHref}" style="color: #b91c1c; text-decoration: underline;">${safePhone}</a></div>
									</td>
									<td align="right" style="vertical-align: middle;">
										<a href="tel:${telHref}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 10px 18px; font-size: 13px; font-weight: 700; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">
											Call Customer &rarr;
										</a>
									</td>
								</tr>
							</table>
						</td>
					</tr>

					<!-- Lead Details -->
					<tr>
						<td style="padding: 32px;">
							<h2 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
								Lead &amp; Customer Details
							</h2>

							<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
								<!-- Field: Service -->
								<tr>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 38%; vertical-align: top;">
										<span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Service Requested</span>
									</td>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 62%; vertical-align: top;">
										<span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 14px; padding: 4px 10px; border-radius: 4px; border: 1px solid #bfdbfe;">
											${safeService}
										</span>
									</td>
								</tr>

								<!-- Field: Customer Name -->
								<tr>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
										<span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Customer Name</span>
									</td>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
										<strong style="font-size: 15px; color: #0f172a;">${safeName}</strong>
									</td>
								</tr>

								<!-- Field: Phone Number -->
								<tr>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
										<span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Phone Number</span>
									</td>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
										<a href="tel:${telHref}" style="font-size: 15px; font-weight: 700; color: #dc2626; text-decoration: none;">
											${safePhone}
										</a>
									</td>
								</tr>

								<!-- Field: Property ZIP -->
								<tr>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
										<span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Property ZIP Code</span>
									</td>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
										<span style="display: inline-block; background-color: #f1f5f9; color: #0f172a; font-weight: 700; font-size: 14px; padding: 4px 10px; border-radius: 4px; border: 1px solid #cbd5e1;">
											${safeZip}
										</span>
									</td>
								</tr>

								<!-- Field: Damage / Reported Issue -->
								<tr>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
										<span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Reported Issue</span>
									</td>
									<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
										<strong style="font-size: 15px; color: #0f172a;">${safeDamage}</strong>
									</td>
								</tr>

								<!-- Field: Customer Message / Details -->
								<tr>
									<td style="padding: 14px 0 6px 0; vertical-align: top;" colspan="2">
										<div style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
											Customer Message / Additional Details
										</div>
										<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #dc2626; border-radius: 6px; padding: 14px 16px; font-size: 14px; color: #334155; line-height: 1.6;">
											${safeDetails}
										</div>
									</td>
								</tr>
							</table>
						</td>
					</tr>

					${attributionHtml}

					<!-- Submission Metadata & Footer -->
					<tr>
						<td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b;">
							<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
								<tr>
									<td>
										<div><strong>Submission ID:</strong> <code style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #0f172a;">${safeSubmissionId}</code></div>
										${safePage ? `<div style="margin-top: 4px;"><strong>Submitted From Page:</strong> <a href="${safePage}" style="color: #dc2626; text-decoration: underline;">${safePage}</a></div>` : ''}
										${safeConsent ? `<div style="margin-top: 4px;"><strong>Customer Consent:</strong> &ldquo;${safeConsent}&rdquo;</div>` : ''}
										<div style="margin-top: 4px;"><strong>Received:</strong> ${formattedDate}</div>
										<div style="margin-top: 8px; color: #94a3b8;">Internal team notification delivered securely to configured Platinum specialist recipients via Resend.</div>
									</td>
								</tr>
							</table>
						</td>
					</tr>

				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;
}

/**
 * Plain text representation of the lead email.
 */
export function renderLeadEmailText(
	data: LeadSubmissionData,
	timestamp: Date = new Date()
): string {
	const serviceName = data.service || 'Water damage restoration';
	const zip = data.zip || data.zipCode || '';
	const damage = data.damage || data.issue || '';
	const message =
		data.message !== undefined && data.message !== null ? data.message : (data.details ?? '');

	const lines: string[] = [
		'NEW LEAD NOTIFICATION - PLATINUM RESTORATION',
		'===============================================',
		'A new customer lead was received via the website form. Immediate follow-up required.',
		'',
		'ACTION REQUIRED:',
		'----------------',
		`Call ${data.name} at ${data.phone}`,
		'',
		'LEAD & CUSTOMER DETAILS:',
		'------------------------',
		`Customer Name:     ${data.name}`,
		`Phone Number:      ${data.phone}`,
		`Service Requested: ${serviceName}`,
		`Property ZIP Code: ${zip}`,
		`Reported Issue:    ${damage}`,
		'',
		'CUSTOMER MESSAGE / NOTES:',
		'-------------------------',
		message || 'None provided',
		'',
		'SUBMISSION & COMPLIANCE:',
		'------------------------',
		`Submission ID: ${data.submission_id || 'N/A'}`,
		`Submitted URL: ${data.page || 'N/A'}`,
		`Consent:       ${data.consent || 'N/A'}`,
		`Received:      ${timestamp.toUTCString()}`
	];

	const trackingItems: Array<{ label: string; value: string }> = [];
	if (data.utm_source)
		trackingItems.push({ label: 'Traffic Source (utm_source)', value: data.utm_source });
	if (data.utm_medium)
		trackingItems.push({ label: 'Marketing Medium (utm_medium)', value: data.utm_medium });
	if (data.utm_campaign)
		trackingItems.push({ label: 'Campaign (utm_campaign)', value: data.utm_campaign });
	if (data.utm_term) trackingItems.push({ label: 'Search Term (utm_term)', value: data.utm_term });
	if (data.utm_content)
		trackingItems.push({ label: 'Ad Content (utm_content)', value: data.utm_content });
	if (data.gclid) trackingItems.push({ label: 'Google Click ID (gclid)', value: data.gclid });
	if (data.gbraid) trackingItems.push({ label: 'iOS Click ID (gbraid)', value: data.gbraid });
	if (data.wbraid) trackingItems.push({ label: 'Web Click ID (wbraid)', value: data.wbraid });

	if (trackingItems.length > 0) {
		lines.push('', 'MARKETING & ATTRIBUTION:', '------------------------');
		for (const item of trackingItems) {
			lines.push(`${item.label}: ${item.value}`);
		}
	}

	return lines.join('\n');
}

export interface SendLeadEmailResult {
	success: boolean;
	id?: string;
	error?: string;
}

/**
 * Dispatches the form submission to the configured email recipients using Resend.
 */
export async function sendLeadNotificationEmail(
	data: LeadSubmissionData,
	overrideRecipients?: string[]
): Promise<SendLeadEmailResult> {
	const apiKey = getResendApiKey();
	if (!apiKey) {
		console.error('[EmailService] Missing RESEND_API_KEY environment variable.');
		return {
			success: false,
			error: 'Email service is not configured on the server.'
		};
	}

	const recipients = overrideRecipients ?? getRecipientEmails();
	if (recipients.length === 0) {
		console.error(
			'[EmailService] No recipient email addresses found in RESEND_EMAIL_1 through RESEND_EMAIL_4.'
		);
		return {
			success: false,
			error: 'Recipient email addresses are not configured.'
		};
	}

	const fromEmail = getResendFromEmail();
	const service = data.service || 'Water Damage';
	const zip = data.zip || data.zipCode || '';
	const damage = data.damage || data.issue || 'Request';
	const subject = `🚨 New Lead: ${data.name} (${zip}) - ${service} - ${damage}`;
	const html = renderLeadEmailHtml(data);
	const text = renderLeadEmailText(data);

	try {
		const resend = new Resend(apiKey);
		const { data: resendData, error: resendError } = await resend.emails.send({
			from: fromEmail,
			to: recipients,
			subject,
			html,
			text
		});

		if (resendError) {
			console.error('[EmailService] Resend API error:', resendError.name, resendError.message);
			if (fromEmail.includes('@resend.dev')) {
				console.warn(
					'[EmailService] Notice: RESEND_FROM_EMAIL is using @resend.dev (testing sandbox). Configure RESEND_FROM_EMAIL to use your verified domain (e.g. notifications@ikhtiyaar.com) to allow delivery to all recipients.'
				);
			}
			return {
				success: false,
				error: 'Failed to deliver notification email.'
			};
		}

		return {
			success: true,
			id: resendData?.id
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('[EmailService] Exception while delivering email:', message);
		return {
			success: false,
			error: 'Internal error while sending email notification.'
		};
	}
}
