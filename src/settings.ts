/**
 * Settings definitions, validation logic, and settings tab UI.
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import { LLMService } from './services/llm-service';
import { PluginSettings, ValidationResult } from './types';

/**
 * Default settings applied upon initial plugin installation.
 */
export const DEFAULT_SETTINGS: PluginSettings = {
	host: 'http://localhost:11434/v1',
	apiKey: '',
	model: 'llama3.2',
	minTags: 3,
	maxTags: 7,
};

/**
 * Validates the current plugin settings configuration.
 * Enforces non-empty host/model, non-negative tag limits, and min <= max constraints.
 *
 * @param settings - Plugin settings to validate.
 * @returns ValidationResult with status and array of error messages.
 */
export function validateSettings(settings: PluginSettings): ValidationResult {
	const errors: string[] = [];

	const trimmedHost = settings.host.trim();
	if (!trimmedHost) {
		errors.push('Host of server cannot be empty.');
	} else if (!/^https?:\/\//i.test(trimmedHost)) {
		errors.push('Host of server must start with http:// or https://.');
	}

	if (!settings.model.trim()) {
		errors.push('Model name cannot be empty.');
	}

	if (typeof settings.minTags !== 'number' || isNaN(settings.minTags) || settings.minTags < 1) {
		errors.push('Minimum amount of tags must be at least 1 (negative or zero values are blocked).');
	}

	if (typeof settings.maxTags !== 'number' || isNaN(settings.maxTags) || settings.maxTags < 1) {
		errors.push('Maximum amount of tags must be at least 1 (negative or zero values are blocked).');
	}

	if (
		typeof settings.minTags === 'number' &&
		typeof settings.maxTags === 'number' &&
		settings.minTags > settings.maxTags
	) {
		errors.push(
			`Minimum amount of tags (${settings.minTags}) cannot be greater than maximum amount of tags (${settings.maxTags}).`,
		);
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Interface representing the host plugin required by the settings tab.
 */
export interface AITaggerPluginHost {
	app: App;
	settings: PluginSettings;
	saveSettings(): Promise<void>;
	llmService: LLMService;
}

/**
 * Settings tab for configuring LLM connectivity, authentication, model, and tag limits.
 */
export class AITaggerSettingTab extends PluginSettingTab {
	private readonly plugin: AITaggerPluginHost;
	private errorContainerEl: HTMLElement | null = null;

	public constructor(app: App, plugin: AITaggerPluginHost) {
		super(app, plugin as unknown as import('obsidian').Plugin);
		this.plugin = plugin;
	}

	public display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Validation errors banner container
		this.errorContainerEl = containerEl.createDiv({ cls: 'ai-tagger-validation-box' });
		this.updateValidationUI();

		new Setting(containerEl).setName('Server configuration').setHeading();

		// Server Host
		new Setting(containerEl)
			.setName('Host of server')
			.setDesc('Base URL of the server endpoint (default: localhost:11434).')
			.addText((text) =>
				text
					.setPlaceholder('Enter server URL')
					.setValue(this.plugin.settings.host)
					.onChange(async (value) => {
						this.plugin.settings.host = value.trim();
						this.updateValidationUI();
						const validation = validateSettings(this.plugin.settings);
						if (validation.isValid) {
							await this.plugin.saveSettings();
						}
					}),
			);

		// Auth Key
		new Setting(containerEl)
			.setName('Auth key')
			.setDesc('API key or bearer token (optional for local servers, required for OpenAI or secured proxies).')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('Optional API key')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		// Model Name
		new Setting(containerEl)
			.setName('Model name')
			.setDesc('Name of the model to use for generating tags (such as llama3.2, mistral, or GPT-4o-mini).')
			.addText((text) =>
				text
					.setPlaceholder('Enter model name')
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value.trim();
						this.updateValidationUI();
						const validation = validateSettings(this.plugin.settings);
						if (validation.isValid) {
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl).setName('Tag generation').setHeading();

		// Minimum Amount of Tags
		new Setting(containerEl)
			.setName('Minimum amount of tags')
			.setDesc('Minimum number of tags to generate. Must be at least 1 and cannot exceed maximum tags.')
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '1';
				text.inputEl.step = '1';
				text.setValue(String(this.plugin.settings.minTags));
				text.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed)) {
						this.plugin.settings.minTags = parsed;
						this.updateValidationUI();
						const validation = validateSettings(this.plugin.settings);
						if (validation.isValid) {
							await this.plugin.saveSettings();
						}
					} else {
						this.updateValidationUI();
					}
				});
			});

		// Maximum Amount of Tags
		new Setting(containerEl)
			.setName('Maximum amount of tags')
			.setDesc('Maximum number of tags to generate. Must be at least 1 and cannot be less than minimum tags.')
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '1';
				text.inputEl.step = '1';
				text.setValue(String(this.plugin.settings.maxTags));
				text.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed)) {
						this.plugin.settings.maxTags = parsed;
						this.updateValidationUI();
						const validation = validateSettings(this.plugin.settings);
						if (validation.isValid) {
							await this.plugin.saveSettings();
						}
					} else {
						this.updateValidationUI();
					}
				});
			});

		// Test Connection Section
		new Setting(containerEl).setName('Connection test').setHeading();

		const testDescEl = containerEl.createDiv({ cls: 'setting-item-description' });
		testDescEl.setText('Verify connection with your configured server host, auth key, and model.');

		const testResultEl = containerEl.createDiv({ cls: 'ai-tagger-test-result' });

		new Setting(containerEl)
			.setName('Test API connection')
			.setDesc('Sends a lightweight test ping to the configured endpoint.')
			.addButton((button) =>
				button
					.setButtonText('Test connection')
					.setCta()
					.onClick(async () => {
						testResultEl.empty();
						const validation = validateSettings(this.plugin.settings);
						if (!validation.isValid) {
							testResultEl.createDiv({
								text: 'Please fix configuration errors before testing.',
								cls: 'ai-tagger-error-text',
							});
							return;
						}

						button.setDisabled(true);
						button.setButtonText('Testing...');
						testResultEl.createDiv({ text: 'Connecting to server...' });

						try {
							const result = await this.plugin.llmService.testConnection(
								this.plugin.settings,
							);
							testResultEl.empty();
							if (result.success) {
								testResultEl.createDiv({
									text: `✓ ${result.message}`,
									cls: 'ai-tagger-success-text',
								});
							} else {
								testResultEl.createDiv({
									text: `✗ ${result.message}`,
									cls: 'ai-tagger-error-text',
								});
							}
						} finally {
							button.setDisabled(false);
							button.setButtonText('Test connection');
						}
					}),
			);
	}

	/**
	 * Updates the on-screen validation errors container based on current settings state.
	 */
	private updateValidationUI(): void {
		if (!this.errorContainerEl) {
			return;
		}

		this.errorContainerEl.empty();
		const validation = validateSettings(this.plugin.settings);

		if (!validation.isValid) {
			this.errorContainerEl.addClass('has-errors');
			this.errorContainerEl.createDiv({
				text: 'Configuration warnings:',
				cls: 'ai-tagger-validation-header',
			});

			const ul = this.errorContainerEl.createEl('ul', {
				cls: 'ai-tagger-validation-list',
			});

			for (const error of validation.errors) {
				const li = ul.createEl('li');
				li.setText(error);
			}
		} else {
			this.errorContainerEl.removeClass('has-errors');
		}
	}
}
