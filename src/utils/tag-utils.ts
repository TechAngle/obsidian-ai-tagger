/**
 * Tag manipulation, hashtag formatting, and header tag parsing utilities.
 */

import { MergeTagsResult } from '../types';

/**
 * Normalizes a raw tag string to comply with Obsidian tag rules.
 * Strips leading hash, trims whitespace, replaces spaces with hyphens,
 * removes illegal characters, and enforces non-numeric prefix if needed.
 *
 * @param rawTag - Raw tag string to normalize.
 * @returns Cleaned Obsidian-compatible tag string, or null if invalid/empty.
 */
export function normalizeTag(rawTag: string): string | null {
	if (typeof rawTag !== 'string') {
		return null;
	}

	let tag = rawTag.trim();

	// Strip leading hash symbols
	while (tag.startsWith('#')) {
		tag = tag.slice(1).trim();
	}

	// Remove surrounding quotes
	tag = tag.replace(/^["']|["']$/g, '');

	// Replace whitespace sequences with hyphens
	tag = tag.replace(/\s+/g, '-');

	// Remove characters that Obsidian disallows in tags
	tag = tag.replace(/[^a-zA-Z0-9_/-]/g, '');

	// Collapse multiple consecutive hyphens or slashes
	tag = tag.replace(/-+/g, '-').replace(/\/+/g, '/');

	// Trim leading and trailing hyphens or slashes
	tag = tag.replace(/^[/-]+|[/-]+$/g, '');

	// Obsidian tags cannot consist solely of numbers
	if (/^\d+$/.test(tag)) {
		tag = `tag-${tag}`;
	}

	if (tag.length === 0) {
		return null;
	}

	return tag.toLowerCase();
}

/**
 * Merges newly generated tags into an existing tag list.
 * Deduplicates tags case-insensitively, preserves existing tag order,
 * and appends new tags to the end.
 *
 * @param existingTags - Tags currently present.
 * @param newTags - Newly generated tags from the LLM.
 * @returns Object containing the merged tags array and newly added tags.
 */
export function mergeTags(
	existingTags: readonly string[],
	newTags: readonly string[],
): MergeTagsResult {
	const seen = new Set<string>();
	const merged: string[] = [];
	const added: string[] = [];

	for (const tag of existingTags) {
		const normalized = normalizeTag(tag);
		if (normalized && !seen.has(normalized)) {
			seen.add(normalized);
			merged.push(normalized);
		}
	}

	for (const tag of newTags) {
		const normalized = normalizeTag(tag);
		if (normalized && !seen.has(normalized)) {
			seen.add(normalized);
			merged.push(normalized);
			added.push(normalized);
		}
	}

	return { merged, added };
}

/**
 * Regular expression matching a line consisting exclusively of hashtags at the top of content.
 * e.g., `#tag1 #tag-two #topic/sub`
 */
const HASHTAG_LINE_REGEX = /^([ \t]*#[a-zA-Z0-9_/-]+[ \t]*)+\r?\n?/;

/**
 * Extracts hashtags from a hashtag line string.
 *
 * @param line - Raw line string containing hashtags.
 * @returns Array of tag names without the leading `#`.
 */
export function parseHashtagLine(line: string): string[] {
	const matches = line.match(/#[a-zA-Z0-9_/-]+/g);
	if (!matches) {
		return [];
	}

	const tags: string[] = [];
	for (const match of matches) {
		const cleaned = normalizeTag(match);
		if (cleaned) {
			tags.push(cleaned);
		}
	}
	return Array.from(new Set(tags));
}

/**
 * Inserts or appends hashtags at the beginning of the file.
 *
 * If frontmatter exists at the top of the file:
 * - Hashtags are inserted/appended immediately after the closing `---` frontmatter delimiter.
 *
 * If no frontmatter exists:
 * - Hashtags are inserted/appended at the very first line of the file.
 *
 * If a hashtag line is already present at that position:
 * - The new tags are appended to that line (avoiding duplicates).
 *
 * @param fileContent - Original file content.
 * @param newTags - Tags to insert or append.
 * @returns Updated file content with merged tags, and details on added tags.
 */
export function updateFileHashtags(
	fileContent: string,
	newTags: readonly string[],
): { content: string; added: string[]; total: string[] } {
	const frontmatterMatch = fileContent.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	const frontmatterPrefix = frontmatterMatch ? frontmatterMatch[0] : '';
	const body = fileContent.slice(frontmatterPrefix.length);

	const hashtagMatch = body.match(HASHTAG_LINE_REGEX);

	let existingTags: string[] = [];
	let restOfBody = body;

	if (hashtagMatch && hashtagMatch[0]) {
		const existingLine = hashtagMatch[0];
		existingTags = parseHashtagLine(existingLine);
		restOfBody = body.slice(existingLine.length);
	}

	const { merged, added } = mergeTags(existingTags, newTags);

	if (merged.length === 0) {
		return { content: fileContent, added: [], total: existingTags };
	}

	const formattedHashtagLine = merged.map((t) => `#${t}`).join(' ') + '\n\n';

	// Trim redundant leading newlines from the rest of the body
	const cleanBody = restOfBody.replace(/^\r?\n+/, '');

	const updatedContent = `${frontmatterPrefix}${formattedHashtagLine}${cleanBody}`;

	return {
		content: updatedContent,
		added,
		total: merged,
	};
}
