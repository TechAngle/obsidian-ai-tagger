/**
 * Command registrations, ribbon actions, and context menu integrations.
 */

import { Menu, Notice, Plugin, TAbstractFile, TFile } from 'obsidian';
import { TaggerService } from '../services/tagger-service';

/**
 * Registers all user-facing commands, ribbon icons, and context menus for AI Tagger.
 *
 * @param plugin - The main plugin instance.
 * @param taggerService - The initialized tagger service.
 */
export function registerCommands(plugin: Plugin, taggerService: TaggerService): void {
	// 1. Command Palette: Tag active note
	plugin.addCommand({
		id: 'tag-current-note',
		name: 'Tag current note with AI',
		checkCallback: (checking: boolean) => {
			const activeFile = plugin.app.workspace.getActiveFile();
			const isMarkdown = activeFile instanceof TFile && activeFile.extension === 'md';

			if (checking) {
				return isMarkdown;
			}

			if (activeFile && isMarkdown) {
				void taggerService.tagFile(activeFile);
			}
			return true;
		},
	});

	// 2. Ribbon Icon: Quick tagging from sidebar ribbon
	plugin.addRibbonIcon('tags', 'Tag active note with AI', () => {
		const activeFile = plugin.app.workspace.getActiveFile();
		if (activeFile instanceof TFile && activeFile.extension === 'md') {
			void taggerService.tagFile(activeFile);
		} else {
			new Notice('No active Markdown note to tag.');
		}
	});

	// 3. File Context Menu: Right click on a note in file explorer
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
			if (file instanceof TFile && file.extension === 'md') {
				menu.addItem((item) => {
					item.setTitle('Tag with AI')
						.setIcon('tags')
						.onClick(() => {
							void taggerService.tagFile(file);
						});
				});
			}
		}),
	);
}
