/**
 * Extracts the origin from a Request, checking both 'origin' and 'referer' headers.
 */
export function extractRequestOrigin(request: Request): string | null {
	const originHeader = request.headers.get('origin');
	if (originHeader) {
		return originHeader.trim().replace(/\/+$/, '');
	}

	const refererHeader = request.headers.get('referer');
	if (refererHeader) {
		try {
			const parsed = new URL(refererHeader);
			return parsed.origin.replace(/\/+$/, '');
		} catch {
			return null;
		}
	}

	return null;
}

/**
 * Validates whether the given origin is present in the allowed origins list.
 * Supports wildcard '*', wildcard subdomain patterns (e.g. 'https://*.vercel.app'),
 * and ignores case & trailing slashes.
 */
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
	// If wildcard is present, allow all
	if (allowedOrigins.includes('*')) {
		return true;
	}

	// If no allowed origins are configured or no origin is provided, reject
	if (!origin || allowedOrigins.length === 0) {
		return false;
	}

	const normalizedOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();

	return allowedOrigins.some((allowed) => {
		const normalizedAllowed = allowed.trim().replace(/\/+$/, '').toLowerCase();
		if (normalizedAllowed === normalizedOrigin) {
			return true;
		}

		// Support wildcard subdomain patterns like https://*.vercel.app or https://*.platinumsg.com
		if (normalizedAllowed.includes('*')) {
			const parts = normalizedAllowed.split('*');
			if (parts.length === 2) {
				const [prefix, suffix] = parts;
				if (
					normalizedOrigin.startsWith(prefix) &&
					normalizedOrigin.endsWith(suffix) &&
					normalizedOrigin.length >= prefix.length + suffix.length
				) {
					const wildcardPart = normalizedOrigin.slice(
						prefix.length,
						normalizedOrigin.length - suffix.length
					);
					return /^[a-z0-9-]+$/.test(wildcardPart);
				}
			}
		}

		return false;
	});
}

/**
 * Builds standard CORS headers for allowed origins.
 */
export function getCorsHeaders(
	origin: string | null,
	allowedOrigins: string[]
): Record<string, string> {
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Accept',
		'Access-Control-Max-Age': '86400',
		Vary: 'Origin'
	};

	if (allowedOrigins.includes('*')) {
		headers['Access-Control-Allow-Origin'] = '*';
	} else if (origin && isOriginAllowed(origin, allowedOrigins)) {
		headers['Access-Control-Allow-Origin'] = origin;
	}

	return headers;
}
