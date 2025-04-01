import { App, Modal, Notice, Plugin, Setting, TFolder } from "obsidian";
import { AIExcerptPlugin } from "../types";
import { GenerateAllModal } from "./generate-all-modal";
import { SelectDirectoryModal } from "./select-directory-modal";

/**
 * Modal that presents a list of all available AI Excerpt Generator commands
 * for the user to select and execute
 */
export class CommandsModal extends Modal {
	private plugin: Plugin & AIExcerptPlugin;

	constructor(app: App, plugin: Plugin & AIExcerptPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "AI Tag Generator Commands" });
		contentEl.createEl("p", {
			text: "Select a command to execute.",
		});

		// Current file command
		new Setting(contentEl)
			.setName("Generate for Current File")
			.setDesc("Generate tags for the currently active file")
			.addButton((button) => {
				button.setButtonText("Execute").onClick(async () => {
					const activeFile = this.app.workspace.getActiveFile();
					if (activeFile) {
						this.close();
						await this.plugin.processFile(activeFile);
					} else {
						new Notice("No active file");
					}
				});
			});

		// Current directory command
		new Setting(contentEl)
			.setName("Generate for Current Directory")
			.setDesc("Generate tags for all files in the current directory")
			.addButton((button) => {
				button.setButtonText("Execute").onClick(async () => {
					const activeFile = this.app.workspace.getActiveFile();
					if (activeFile) {
						const parent = activeFile.parent;
						if (parent) {
							this.close();
							await this.plugin.processDirectory(parent);
						}
					} else {
						new Notice("No active file to determine directory");
					}
				});
			});

		// Select directory command
		new Setting(contentEl)
			.setName("Generate for Selected Directory")
			.setDesc(
				"Choose a directory and generate tags for all files within it"
			)
			.addButton((button) => {
				button.setButtonText("Execute").onClick(() => {
					this.close();
					new SelectDirectoryModal(this.app, this.plugin).open();
				});
			});

		// All files command
		new Setting(contentEl)
			.setName("Generate for All Files")
			.setDesc("Generate tags for all markdown files in the vault")
			.addButton((button) => {
				button.setButtonText("Execute").onClick(() => {
					this.close();
					new GenerateAllModal(this.app, this.plugin).open();
				});
			});

		// Close button at the bottom
		const footerEl = contentEl.createDiv();
		footerEl.style.textAlign = "center";
		const closeButton = footerEl.createEl("button", { text: "Close" });
		closeButton.addEventListener("click", () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
