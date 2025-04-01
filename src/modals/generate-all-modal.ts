import { App, Modal, Notice } from "obsidian";
import { AIExcerptPlugin } from "../types";

export class GenerateAllModal extends Modal {
	private plugin: AIExcerptPlugin;

	constructor(app: App, plugin: AIExcerptPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Generate Tags for All Files" });
		contentEl.createEl("p", {
			text: "This will check all markdown files in your vault and generate tags where needed. This could take some time depending on the size of your vault.",
		});

		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.textAlign = "center";
		buttonContainer.style.marginTop = "20px";

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.style.marginRight = "10px";
		cancelButton.addEventListener("click", () => this.close());

		const confirmButton = buttonContainer.createEl("button", {
			text: "Proceed",
			cls: "mod-cta",
		});
		confirmButton.addEventListener("click", async () => {
			this.close();
			await this.plugin.processAllFiles();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
