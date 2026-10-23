/**
 * Date formatting utilities for context generation.
 */

/**
 * Formats a numeric epoch timestamp (milliseconds) into a human-readable ISO-like date string.
 *
 * @param timestamp - The timestamp in milliseconds since epoch.
 * @returns A formatted string in the pattern "YYYY-MM-DD HH:mm:ss" or "Unknown" if invalid.
 */
export function formatTimestamp(timestamp: number): string {
	if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
		return 'Unknown';
	}
	const date = new Date(timestamp);
	if (isNaN(date.getTime())) {
		return 'Unknown';
	}
	return date.toISOString().replace('T', ' ').substring(0, 19);
}
