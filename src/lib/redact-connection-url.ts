export function redactConnectionUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		if (urlObj.password) {
			urlObj.password = "*****";
		}
		return urlObj.toString();
	} catch {
		// If URL parsing fails, return original URL
		return url;
	}
}
