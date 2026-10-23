/**
 * Main plugin entry point for AI Notes Tagger.
 * Manages plugin lifecycle, settings persistence, and service orchestration.
 */

import { Plugin } from 'obsidian';
import { registerCommands } from './commands';
import { LLMService } from './services/llm-service';
import { TaggerService } from './services/tagger-service';
import { AITaggerPluginHost, AITaggerSettingTab, DEFAULT_SETTINGS } from './settings';
import { PluginSettings } from './types';

/**
 * AI Notes Tagger plugin implementation for Obsidian.
 */
export default class AITaggerPlugin extends Plugin implements AITaggerPluginHost {
	/** Persisted configuration settings. */
	public settings: PluginSettings = DEFAULT_SETTINGS;

	/** LLM client service. */
	public llmService: LLMService = new LLMService();

	/** Tagger service orchestrator. */
	public taggerService!: TaggerService;

	/**
	 * Lifecycle method executed when the plugin is loaded into Obsidian.
	 */
	public async onload(): Promise<void> {
		// 1. Load persisted settings
		await this.loadSettings();

		// 2. Initialize LLM and Tagger services
		this.llmService = new LLMService();
		this.taggerService = new TaggerService(
			this.app,
			this.llmService,
			() => this.settings,
		);

		// 3. Register settings tab
		this.addSettingTab(new AITaggerSettingTab(this.app, this));

		// 4. Register commands, ribbon, and menu events
		registerCommands(this, this.taggerService);
	}

	/**
	 * Lifecycle method executed when the plugin is unloaded or reloaded.
	 */
	public onunload(): void {
		// Cleaned up automatically via Obsidian event registrations
	}

	/**
	 * Loads persisted settings from Obsidian storage, merging with defaults.
	 */
	public async loadSettings(): Promise<void> {
		const loadedData = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
	}

	/**
	 * Persists the current settings to Obsidian storage.
	 */
	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
