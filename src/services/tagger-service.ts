/**
 * Service that coordinates reading notes, sanitizing text, querying the LLM,
 * and writing hashtags at the beginning of the file.
 */

import { App, Notice, TFile } from 'obsidian';
import { LLMService } from './llm-service';
import { validateSettings } from '../settings';
import { NoteContext, PluginSettings } from '../types';
import { formatTimestamp } from '../utils/date-utils';
import { sanitizeContent } from '../utils/sanitizer';
import { updateFileHashtags } from '../utils/tag-utils';

/**
 * Orchestrates note tag generation and inserting/appending hashtags at the beginning of notes.
 */
export class TaggerService {
	private readonly app: App;
	private readonly llmService: LLMService;
	private readonly getSettings: () => PluginSettings;

	/**
	 * Creates an instance of TaggerService.
	 *
	 * @param app - Obsidian App instance.
	 * @param llmService - Initialized LLM client service.
	 * @param getSettings - Accessor returning the current plugin settings.
	 */
	public constructor(
		app: App,
		llmService: LLMService,
		getSettings: () => PluginSettings,
	) {
		this.app = app;
		this.llmService = llmService;
		this.getSettings = getSettings;
	}

	/**
	 * Analyzes a Markdown file, extracts keywords via LLM, and inserts/appends hashtags at the top.
	 *
	 * @param file - The Markdown file to tag.
	 * @returns Promise that resolves once tagging is complete.
	 */
	public async tagFile(file: TFile): Promise<void> {
		const settings = this.getSettings();

		// Validate settings before proceeding
		const validation = validateSettings(settings);
		if (!validation.isValid) {
			new Notice(`AI tagger: Invalid settings - ${validation.errors[0] ?? 'Please check settings tab.'}`);
			return;
		}

		// Read file content from vault
		let rawContent: string;
		try {
			rawContent = await this.app.vault.read(file);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`AI tagger: Unable to read file "${file.name}": ${message}`);
			return;
		}

		// Minimize text and strip token overhead
		const sanitized = sanitizeContent(rawContent);

		// Handle empty text condition
		if (!sanitized || sanitized.trim().length === 0) {
			new Notice('No text for analysis');
			return;
		}

		// Prepare context for the LLM
		const context: NoteContext = {
			fileName: file.name,
			creationDate: formatTimestamp(file.stat.ctime),
			modifyDate: formatTimestamp(file.stat.mtime),
			sanitizedContent: sanitized,
		};

		const statusNotice = new Notice(`AI tagger: Analyzing "${file.basename}"...`, 0);

		try {
			// Query LLM for tags
			const generatedTags = await this.llmService.generateTags(context, settings);

			if (generatedTags.length === 0) {
				statusNotice.hide();
				new Notice('AI tagger: No tags were generated for this note.');
				return;
			}

			// Insert or append hashtags at the beginning of the file
			const { content: updatedContent, added, total } = updateFileHashtags(
				rawContent,
				generatedTags,
			);

			await this.app.vault.modify(file, updatedContent);

			statusNotice.hide();

			if (added.length > 0) {
				new Notice(`AI tagger: Added ${added.length} tag(s) to "${file.basename}" (${total.length} total).`);
			} else {
				new Notice(`AI tagger: Note "${file.basename}" already contains all generated tags.`);
			}
		} catch (error: unknown) {
			statusNotice.hide();
			const message = error instanceof Error ? error.message : String(error);
			console.error('AI tagger error:', error);
			new Notice(`AI tagger failed: ${message}`);
		}
	}
}
