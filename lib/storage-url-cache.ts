type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();

export function getCachedSignedUrl(path: string): string | null {
	const now = Date.now();
	const hit = cache.get(path);
	if (hit && hit.expiresAt > now) return hit.url;
	return null;
}

export function setCachedSignedUrl(path: string, url: string, ttlSeconds = 600) {
	const now = Date.now();
	cache.set(path, { url, expiresAt: now + ttlSeconds * 1000 - 30_000 });
}


