import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import {
	AIExcerptPlugin,
	AIExcerptSettings,
	CLAUDE_MODELS,
	LLMProvider,
	OPENAI_MODELS,
	PromptType,
} from "./types";

export const DEFAULT_SETTINGS: AIExcerptSettings = {
	provider: LLMProvider.CLAUDE,
	promptType: PromptType.TAG_GENERATION,
	claudeApiKey: "",
	claudeModel: "claude-3-7-sonnet-20250219",
	openaiApiKey: "",
	openaiModel: "gpt-4o",
	tagPrefix: "",
};

export class AIExcerptSettingTab extends PluginSettingTab {
	plugin: AIExcerptPlugin;

	constructor(app: App, plugin: Plugin & AIExcerptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "AI Tag Generator Settings" });

		// LLM Provider Selection
		new Setting(containerEl)
			.setName("AI Provider")
			.setDesc("Select which AI provider to use for generating tags")
			.addDropdown((dropdown) => {
				dropdown
					.addOption(LLMProvider.CLAUDE, "Claude (Anthropic)")
					.addOption(LLMProvider.OPENAI, "OpenAI")
					.setValue(this.plugin.settings.provider)
					.onChange(async (value: string) => {
						this.plugin.settings.provider = value as LLMProvider;
						await this.plugin.saveSettings();
						// Reload the settings UI to show/hide provider-specific settings
						this.display();
					});
			});

		// Claude Settings - Only show if Claude is selected
		if (this.plugin.settings.provider === LLMProvider.CLAUDE) {
			new Setting(containerEl)
				.setName("Claude API Key")
				.setDesc("Your Anthropic API key for Claude")
				.addText((text) =>
					text
						.setPlaceholder("Enter your API key")
						.setValue(this.plugin.settings.claudeApiKey)
						.onChange(async (value) => {
							this.plugin.settings.claudeApiKey = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Claude Model")
				.setDesc(
					"Select which Claude model to use. Claude 3.7 Sonnet offers the best balance of quality and speed. Claude 3.5 Haiku is faster but simpler. Claude 3 Opus is highest quality but slower."
				)
				.addDropdown((dropdown) => {
					CLAUDE_MODELS.forEach((model) => {
						dropdown.addOption(model, model);
					});
					dropdown
						.setValue(this.plugin.settings.claudeModel)
						.onChange(async (value) => {
							this.plugin.settings.claudeModel = value;
							await this.plugin.saveSettings();
						});
				});
		}

		// OpenAI Settings - Only show if OpenAI is selected
		if (this.plugin.settings.provider === LLMProvider.OPENAI) {
			new Setting(containerEl)
				.setName("OpenAI API Key")
				.setDesc("Your OpenAI API key")
				.addText((text) =>
					text
						.setPlaceholder("Enter your API key")
						.setValue(this.plugin.settings.openaiApiKey)
						.onChange(async (value) => {
							this.plugin.settings.openaiApiKey = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("OpenAI Model")
				.setDesc(
					"Select which OpenAI model to use. GPT-4o offers excellent quality and speed. The 'o' series models are specialized for reasoning tasks. GPT-4.5 offers the highest quality but may be slower."
				)
				.addDropdown((dropdown) => {
					OPENAI_MODELS.forEach((model) => {
						dropdown.addOption(model, model);
					});
					dropdown
						.setValue(this.plugin.settings.openaiModel)
						.onChange(async (value) => {
							this.plugin.settings.openaiModel = value;
							await this.plugin.saveSettings();
						});
				});
		}

		// Tag Prefix Setting
		new Setting(containerEl)
			.setName("Tag Prefix")
			.setDesc(
				"Optional prefix for generated tags (e.g., '#'). Leave empty for no prefix."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter prefix")
					.setValue(this.plugin.settings.tagPrefix)
					.onChange(async (value) => {
						this.plugin.settings.tagPrefix = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
