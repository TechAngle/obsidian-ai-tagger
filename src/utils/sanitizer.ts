/**
 * Text sanitization and token minimization utilities.
 * Strips markdown boilerplate, syntax overhead, code blocks, and noise
 * to optimize prompt token usage for the LLM.
 */

/** Maximum characters of sanitized content sent to the LLM to prevent context overflow. */
export const MAX_CONTENT_LENGTH = 12000;

/**
 * Strips leading YAML frontmatter block from markdown text.
 *
 * @param content - Raw markdown content.
 * @returns Markdown content without frontmatter.
 */
export function stripFrontmatter(content: string): string {
	return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/**
 * Strips markdown fenced code blocks (``` ... ``` or ~~~ ... ~~~)
 * to prevent large code listings from wasting token budget.
 *
 * @param content - Content to sanitize.
 * @returns Content with code blocks removed.
 */
export function stripCodeBlocks(content: string): string {
	return content
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/~~~[\s\S]*?~~~/g, ' ')
		.replace(/`([^`]+)`/g, '$1');
}

/**
 * Strips HTML comments, script/style tags, and standard HTML elements.
 *
 * @param content - Content to sanitize.
 * @returns Content with HTML elements removed.
 */
export function stripHtml(content: string): string {
	return content
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ');
}

/**
 * Normalizes markdown links and removes image embeds.
 *
 * - `![[image.png]]` or `![alt](url)` are stripped completely.
 * - `[[page|alias]]` is replaced with `alias`.
 * - `[[page]]` is replaced with `page`.
 * - `[text](url)` is replaced with `text`.
 *
 * @param content - Content to sanitize.
 * @returns Content with links normalized to plain text.
 */
export function normalizeLinks(content: string): string {
	let text = content;

	// Strip embedded images and files
	text = text.replace(/!\[\[.*?\]\]/g, ' ');
	text = text.replace(/!\[.*?\]\(.*?\)/g, ' ');

	// Normalize Obsidian internal wikilinks [[Target|Display]] -> Display
	text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

	// Normalize standard Markdown links [Display](URL) -> Display
	text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

	// Strip standalone URLs
	text = text.replace(/https?:\/\/[^\s)]+/g, ' ');

	return text;
}

/**
 * Strips remaining markdown syntax noise (headings, blockquotes, list markers, dividers).
 *
 * @param content - Content to sanitize.
 * @returns Content stripped of markdown punctuation.
 */
export function stripMarkdownSyntax(content: string): string {
	let text = content;

	// Remove horizontal rules
	text = text.replace(/^(?:[-*_]\s*){3,}$/gm, ' ');

	// Remove heading markers (e.g., #, ##, ###)
	text = text.replace(/^#{1,6}\s+/gm, '');

	// Remove blockquote markers
	text = text.replace(/^>\s*/gm, '');

	// Remove unordered and ordered list markers (- item, * item, 1. item)
	text = text.replace(/^[\s]*[-*+]\s+/gm, '');
	text = text.replace(/^[\s]*\d+\.\s+/gm, '');

	// Remove bold, italic, and strikethrough markers
	text = text.replace(/[*_~]{1,3}/g, '');

	return text;
}

/**
 * Minimizes and cleanses raw note text to produce an information-dense,
 * token-efficient plain text representation for LLM keyword analysis.
 *
 * @param rawContent - The raw markdown text of the note.
 * @param maxLength - Optional max length cutoff (defaults to MAX_CONTENT_LENGTH).
 * @returns Minimized text, or empty string if no meaningful text remains.
 */
export function sanitizeContent(
	rawContent: string,
	maxLength: number = MAX_CONTENT_LENGTH,
): string {
	if (!rawContent || typeof rawContent !== 'string') {
		return '';
	}

	// 1. Remove YAML frontmatter
	let text = stripFrontmatter(rawContent);

	// 2. Remove code blocks
	text = stripCodeBlocks(text);

	// 3. Remove HTML comments and tags
	text = stripHtml(text);

	// 4. Normalize links and strip images
	text = normalizeLinks(text);

	// 5. Remove markdown formatting syntax
	text = stripMarkdownSyntax(text);

	// 6. Collapse repetitive whitespace and blank lines
	text = text.replace(/[ \t]+/g, ' ');
	text = text.replace(/\r\n/g, '\n');
	text = text.replace(/\n{2,}/g, '\n');

	text = text.trim();

	// 7. Enforce token budget cutoff
	if (text.length > maxLength) {
		text = text.slice(0, maxLength).trim();
	}

	return text;
}
