/**
 * Core type definitions and interfaces for the AI Notes Tagger plugin.
 */

/**
 * Plugin configuration settings persisted by Obsidian.
 */
export interface PluginSettings {
	/** API Host endpoint (e.g., http://localhost:11434/v1 or https://api.openai.com/v1). */
	host: string;
	/** Optional API key or bearer token for authentication. */
	apiKey: string;
	/** Model name to use for generating tags (e.g., llama3.2, mistral, gpt-4o-mini). */
	model: string;
	/** Minimum number of tags to generate (must be >= 1 and <= maxTags). */
	minTags: number;
	/** Maximum number of tags to generate (must be >= 1 and >= minTags). */
	maxTags: number;
}

/**
 * Validation result for plugin settings.
 */
export interface ValidationResult {
	/** Whether all settings are currently valid. */
	isValid: boolean;
	/** List of validation error messages, empty if valid. */
	errors: string[];
}

/**
 * Metadata and sanitized content of a note supplied as context to the LLM.
 */
export interface NoteContext {
	/** Full name of the file including extension. */
	fileName: string;
	/** Formatted file creation timestamp. */
	creationDate: string;
	/** Formatted file last modified timestamp. */
	modifyDate: string;
	/** Sanitized, token-minimized content of the note. */
	sanitizedContent: string;
}

/**
 * Structured JSON response expected from the LLM containing generated tags.
 */
export interface TagResponsePayload {
	/** Array of generated keyword tags. */
	tags: string[];
}

/**
 * Message object for OpenAI-compatible chat completion requests.
 */
export interface OpenAIMessage {
	/** Role of the message sender. */
	role: 'system' | 'user' | 'assistant';
	/** Content of the message. */
	content: string;
}

/**
 * Request payload for OpenAI-compatible chat completions.
 */
export interface OpenAIRequestPayload {
	/** Model identifier. */
	model: string;
	/** Array of chat messages. */
	messages: OpenAIMessage[];
	/** Sampling temperature. */
	temperature: number;
	/** Response format specification enforcing JSON schema. */
	response_format: {
		type: 'json_schema';
		json_schema: {
			name: string;
			strict: boolean;
			schema: {
				type: 'object';
				properties: {
					tags: {
						type: 'array';
						items: {
							type: 'string';
						};
						description: string;
					};
				};
				required: ['tags'];
				additionalProperties: false;
			};
		};
	};
}

/**
 * Choice element within an OpenAI-compatible completion response.
 */
export interface OpenAIChatCompletionChoice {
	/** Index of the choice. */
	index?: number;
	/** Message returned by the model. */
	message: {
		role: string;
		content: string | null;
	};
	/** Reason the completion finished. */
	finish_reason?: string | null;
}

/**
 * Response structure returned by OpenAI-compatible chat completion endpoints.
 */
export interface OpenAIChatCompletionResponse {
	/** Unique completion identifier. */
	id?: string;
	/** Object type name. */
	object?: string;
	/** Epoch timestamp of response creation. */
	created?: number;
	/** Model used for completion. */
	model?: string;
	/** Completion choices. */
	choices: OpenAIChatCompletionChoice[];
}

/**
 * Result of merging newly generated tags with existing frontmatter tags.
 */
export interface MergeTagsResult {
	/** Full deduplicated list of tags to store in frontmatter. */
	merged: string[];
	/** Tags that were newly added (did not previously exist). */
	added: string[];
}

/**
 * Type guard to check if an unknown value is a non-null object record.
 *
 * @param value - Unknown value to inspect.
 * @returns True if value is a Record<string, unknown>.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if an unknown parsed response conforms to TagResponsePayload.
 *
 * @param value - Unknown value to inspect.
 * @returns True if value contains a valid string array 'tags' property.
 */
export function isTagResponsePayload(value: unknown): value is TagResponsePayload {
	if (!isRecord(value)) {
		return false;
	}
	const tags: unknown = value['tags'];
	if (!Array.isArray(tags)) {
		return false;
	}
	return (tags as unknown[]).every((item: unknown): item is string => typeof item === 'string');
}

/**
 * Type guard to check if an unknown response conforms to OpenAIChatCompletionResponse.
 *
 * @param value - Unknown value to inspect.
 * @returns True if value has valid choices array with message content.
 */
export function isOpenAIChatResponse(value: unknown): value is OpenAIChatCompletionResponse {
	if (!isRecord(value)) {
		return false;
	}
	const choices: unknown = value['choices'];
	if (!Array.isArray(choices) || choices.length === 0) {
		return false;
	}
	const firstChoice: unknown = (choices as unknown[])[0];
	if (!isRecord(firstChoice)) {
		return false;
	}
	const message: unknown = firstChoice['message'];
	if (!isRecord(message)) {
		return false;
	}
	return typeof message['role'] === 'string';
}
