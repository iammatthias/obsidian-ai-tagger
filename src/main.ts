import { App, Menu, Notice, Plugin, TFile, TFolder } from "obsidian";
import { AIExcerptPlugin, AIExcerptSettings } from "./types";
import { DEFAULT_SETTINGS, AIExcerptSettingTab } from "./settings";
import { GenerateAllModal } from "./modals/generate-all-modal";
import { SelectDirectoryModal } from "./modals/select-directory-modal";
import { CommandsModal } from "./modals/commands-modal";
import { FileProcessor } from "./services/file-processor";
import { Prompts } from "./utils/prompts";
import { ProviderFactory } from "./providers/provider-factory";
import { TagUtils } from "./utils/tag-utils";

/**
 * AI Tag Generator Plugin
 *
 * This plugin automatically generates relevant tags for markdown files in Obsidian
 * using AI models (Claude or OpenAI). It adds or updates the tags field in frontmatter.
 *
 * The plugin provides multiple ways to process files:
 * - Current file only
 * - Current directory
 * - Selected directory
 * - All files in vault
 */
export default class AITagGenerator extends Plugin implements AIExcerptPlugin {
	settings: AIExcerptSettings;
	fileProcessor: FileProcessor | null;
	statusBarItem: HTMLElement | null = null;

	/**
	 * Initializes the plugin, loads settings, and registers commands and UI elements
	 */
	async onload() {
		await this.loadSettings();

		console.log("Initializing AI Tag Generator plugin");

		// Initialize the status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar(0, 0);

		// Initialize the prompt system
		try {
			Prompts.initialize(this.app);

			// Load all prompts into memory
			try {
				await Prompts.loadAllPrompts();
			} catch (error) {
				console.error("Error loading prompt templates:", error);
				new Notice(
					"Some prompt templates could not be loaded, but the plugin will still function with fallbacks."
				);
			}
		} catch (error) {
			console.error("Critical error initializing prompt system:", error);
			new Notice(
				"Failed to initialize prompt system. The plugin may not function correctly."
			);
		}

		// Initialize the tag utilities
		try {
			TagUtils.initialize(this.app);
		} catch (error) {
			console.error("Error initializing tag utilities:", error);
			new Notice(
				"Failed to initialize tag utilities. Tag consistency features may be limited."
			);
		}

		// Initialize the provider factory
		try {
			ProviderFactory.initialize();
		} catch (error) {
			console.error("Error initializing provider factory:", error);
		}

		// Initialize the file processor
		this.fileProcessor = new FileProcessor(
			this.app.vault,
			this.app.fileManager,
			this.settings,
			this
		);

		// Add ribbon icon for the plugin
		this.addRibbonIcon("tag", "AI Tag Commands", () => {
			new CommandsModal(this.app, this).open();
		});

		// Add command to generate tags for current file
		this.addCommand({
			id: "generate-tags-current-file",
			name: "Generate tags for current file",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === "md") {
					if (!checking) {
						this.processFile(activeFile);
					}
					return true;
				}
				return false;
			},
		});

		// Add command to generate tags for current directory
		this.addCommand({
			id: "generate-tags-current-directory",
			name: "Generate tags for current directory",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.parent) {
					if (!checking) {
						this.processDirectory(activeFile.parent);
					}
					return true;
				}
				return false;
			},
		});

		// Add command to generate tags for all files in vault
		this.addCommand({
			id: "generate-tags-all-files",
			name: "Generate tags for all files in vault",
			callback: async () => {
				new GenerateAllModal(this.app, this).open();
			},
		});

		// Add command to select directory and generate tags
		this.addCommand({
			id: "generate-tags-select-directory",
			name: "Generate tags for a selected directory",
			callback: async () => {
				new SelectDirectoryModal(this.app, this).open();
			},
		});

		// Add command to open commands modal
		this.addCommand({
			id: "open-tag-commands-modal",
			name: "Open AI Tag Commands",
			callback: () => {
				new CommandsModal(this.app, this).open();
			},
		});

		// Add settings tab
		this.addSettingTab(new AIExcerptSettingTab(this.app, this));
	}

	/**
	 * Clean up resources when the plugin is disabled
	 */
	onunload() {
		// Clean up resources
		console.log("Unloading AI Tag Generator plugin");

		// Shut down provider factory to clean up any active provider instances
		try {
			ProviderFactory.shutdown();
		} catch (error) {
			console.error("Error shutting down provider factory:", error);
		}

		this.fileProcessor = null;
		this.statusBarItem = null;
	}

	/**
	 * Load plugin settings from storage
	 */
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	/**
	 * Save plugin settings and reinitialize components that depend on settings
	 */
	async saveSettings() {
		await this.saveData(this.settings);

		// Reload prompt templates
		await Prompts.reload();

		// Re-initialize the file processor with new settings
		this.fileProcessor = new FileProcessor(
			this.app.vault,
			this.app.fileManager,
			this.settings,
			this
		);
	}

	/**
	 * Process a single markdown file to add or update its tags
	 * @param file - The file to process
	 * @param showNotices - Whether to show notification messages
	 */
	async processFile(file: TFile, showNotices: boolean = true): Promise<void> {
		if (!this.fileProcessor) {
			new Notice("File processor not initialized");
			return;
		}
		await this.fileProcessor.processFile(file, showNotices);
	}

	/**
	 * Process all markdown files in a directory to add or update tags
	 * @param folder - The folder to process
	 */
	async processDirectory(folder: TFolder): Promise<void> {
		if (!this.fileProcessor) {
			new Notice("File processor not initialized");
			return;
		}
		await this.fileProcessor.processDirectory(folder);
	}

	/**
	 * Process all markdown files in the vault to add or update tags
	 */
	async processAllFiles(): Promise<void> {
		if (!this.fileProcessor) {
			new Notice("File processor not initialized");
			return;
		}
		await this.fileProcessor.processAllFiles();
	}

	/**
	 * Updates the status bar with current processing information
	 * @param processed - Number of files processed
	 * @param total - Total number of files to process
	 */
	updateStatusBar(processed: number, total: number): void {
		if (this.statusBarItem) {
			if (total > 0) {
				const progress = ((processed / total) * 100).toFixed(1);
				this.statusBarItem.setText(
					`Generating tags: ${processed}/${total} (${progress}%)`
				);
				this.statusBarItem.style.display = "inline-flex";
			} else {
				this.statusBarItem.setText("AI Tag: Ready");
				this.statusBarItem.style.display = "inline-flex";
			}
		}
	}
}
