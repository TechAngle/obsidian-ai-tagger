/**
 * LLM client service utilizing Obsidian's requestUrl for OpenAI-compatible APIs.
 */

import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import {
	NoteContext,
	OpenAIRequestPayload,
	PluginSettings,
	isOpenAIChatResponse,
	isRecord,
	isTagResponsePayload,
} from '../types';
import { normalizeTag } from '../utils/tag-utils';

/**
 * Resolves the full chat completions URL from a user-configured host.
 * Handles trailing slashes, missing '/v1', and existing '/chat/completions' paths.
 *
 * @param host - The base host URL configured in settings.
 * @returns Fully qualified chat completions endpoint URL.
 */
export function resolveChatEndpoint(host: string): string {
	const trimmed = host.trim().replace(/\/+$/, '');
	if (trimmed.endsWith('/chat/completions')) {
		return trimmed;
	}
	if (trimmed.endsWith('/v1')) {
		return `${trimmed}/chat/completions`;
	}
	return `${trimmed}/v1/chat/completions`;
}

/**
 * Extracts and cleans JSON string content from an LLM response.
 * Strips markdown code blocks (e.g., ```json ... ```) if present.
 *
 * @param rawContent - Raw text content returned by the LLM.
 * @returns Cleaned JSON string ready for parsing.
 */
export function cleanJsonContent(rawContent: string): string {
	let cleaned = rawContent.trim();
	if (cleaned.startsWith('```')) {
		cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
		cleaned = cleaned.replace(/\s*```$/, '');
	}
	return cleaned.trim();
}

/**
 * Service class responsible for communicating with OpenAI-compatible LLM endpoints
 * using Obsidian's native requestUrl API.
 */
export class LLMService {
	/**
	 * Generates keyword tags for a given note context using structured JSON schema output.
	 *
	 * @param context - The metadata and sanitized content of the note.
	 * @param settings - The current plugin settings.
	 * @returns A promise resolving to an array of normalized tags.
	 * @throws Error if network request fails or response cannot be parsed.
	 */
	public async generateTags(context: NoteContext, settings: PluginSettings): Promise<string[]> {
		const endpoint = resolveChatEndpoint(settings.host);

		const systemPrompt =
			`You are a specialized note-tagging assistant. Analyze the note's metadata and sanitized content, ` +
			`then extract concise, relevant, and descriptive keyword tags. ` +
			`Generate between ${settings.minTags} and ${settings.maxTags} tags. ` +
			`Tags must be lowercase, use hyphens for multi-word phrases, and exclude '#' symbols. ` +
			`You MUST respond exclusively with a valid JSON object matching the requested schema.`;

		const userPrompt =
			`File Name: ${context.fileName}\n` +
			`Created: ${context.creationDate}\n` +
			`Modified: ${context.modifyDate}\n\n` +
			`Content:\n${context.sanitizedContent}`;

		const payload: OpenAIRequestPayload = {
			model: settings.model.trim(),
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt },
			],
			temperature: 0.2,
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'tags_response',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							tags: {
								type: 'array',
								items: {
									type: 'string',
								},
								description: 'List of keyword tags extracted from the note.',
							},
						},
						required: ['tags'],
						additionalProperties: false,
					},
				},
			},
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (settings.apiKey.trim().length > 0) {
			headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
		}

		const requestParams: RequestUrlParam = {
			url: endpoint,
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
		};

		let response: RequestUrlResponse;
		try {
			response = await requestUrl(requestParams);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`LLM request failed: ${message}`);
		}

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`LLM server returned HTTP status ${response.status}: ${response.text}`);
		}

		return this.parseTagsFromResponse(response, settings);
	}

	/**
	 * Tests connection to the configured LLM endpoint.
	 *
	 * @param settings - Current plugin settings.
	 * @returns Success status and descriptive feedback message.
	 */
	public async testConnection(
		settings: PluginSettings,
	): Promise<{ success: boolean; message: string }> {
		try {
			const endpoint = resolveChatEndpoint(settings.host);
			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
			};

			if (settings.apiKey.trim().length > 0) {
				headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
			}

			const payload: OpenAIRequestPayload = {
				model: settings.model.trim(),
				messages: [
					{
						role: 'system',
						content: 'Respond with JSON {"tags": ["test"]}',
					},
					{
						role: 'user',
						content: 'Test connection',
					},
				],
				temperature: 0.1,
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'tags_response',
						strict: true,
						schema: {
							type: 'object',
							properties: {
								tags: {
									type: 'array',
									items: { type: 'string' },
									description: 'Test tags',
								},
							},
							required: ['tags'],
							additionalProperties: false,
						},
					},
				},
			};

			const response = await requestUrl({
				url: endpoint,
				method: 'POST',
				headers,
				body: JSON.stringify(payload),
			});

			if (response.status >= 200 && response.status < 300) {
				return {
					success: true,
					message: `Connection successful! Model "${settings.model}" responded (HTTP ${response.status}).`,
				};
			}

			return {
				success: false,
				message: `Server returned HTTP ${response.status}: ${response.text}`,
			};
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				message: `Connection error: ${message}`,
			};
		}
	}

	/**
	 * Parses and validates tags from an LLM HTTP response.
	 *
	 * @param response - Response object from requestUrl.
	 * @param settings - Plugin settings for tag boundaries.
	 * @returns Normalized array of tag strings.
	 */
	private parseTagsFromResponse(
		response: RequestUrlResponse,
		settings: PluginSettings,
	): string[] {
		let responseData: unknown = response.json;

		if (!responseData && response.text) {
			try {
				responseData = JSON.parse(response.text);
			} catch {
				throw new Error('Failed to parse response body as JSON.');
			}
		}

		if (!isOpenAIChatResponse(responseData)) {
			throw new Error('Response does not match OpenAI chat completion format.');
		}

		const choice = responseData.choices[0];
		if (!choice || !choice.message || choice.message.content === null) {
			throw new Error('LLM response returned empty message content.');
		}

		const rawContent = choice.message.content;
		const cleanedContent = cleanJsonContent(rawContent);

		let parsedJson: unknown;
		try {
			parsedJson = JSON.parse(cleanedContent);
		} catch {
			throw new Error(`Failed to parse LLM structured content as JSON: "${rawContent}"`);
		}

		let rawTags: string[] = [];

		if (isTagResponsePayload(parsedJson)) {
			rawTags = parsedJson.tags;
		} else if (Array.isArray(parsedJson)) {
			// Fallback: Model returned direct array
			for (const item of parsedJson) {
				if (typeof item === 'string') {
					rawTags.push(item);
				}
			}
		} else if (isRecord(parsedJson)) {
			// Fallback: Check if tags are under alternative key
			const altKey = Object.keys(parsedJson).find((k) => k.toLowerCase().includes('tag'));
			if (altKey && Array.isArray(parsedJson[altKey])) {
				const arr = parsedJson[altKey];
				for (const item of arr) {
					if (typeof item === 'string') {
						rawTags.push(item);
					}
				}
			}
		}

		if (rawTags.length === 0) {
			return [];
		}

		// Normalize and deduplicate tags
		const seen = new Set<string>();
		const validTags: string[] = [];

		for (const tag of rawTags) {
			const normalized = normalizeTag(tag);
			if (normalized && !seen.has(normalized)) {
				seen.add(normalized);
				validTags.push(normalized);
			}
		}

		// Enforce maximum tags count configured in settings
		return validTags.slice(0, settings.maxTags);
	}
}
