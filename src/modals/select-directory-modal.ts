import { App, FuzzySuggestModal, TFolder } from "obsidian";
import { AIExcerptPlugin } from "../types";

export class SelectDirectoryModal extends FuzzySuggestModal<TFolder> {
	private plugin: AIExcerptPlugin;

	constructor(app: App, plugin: AIExcerptPlugin) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder("Select a directory to generate tags for");
	}

	getItems(): TFolder[] {
		return this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder);
	}

	getItemText(folder: TFolder): string {
		return folder.path;
	}

	async onChooseItem(folder: TFolder): Promise<void> {
		await this.plugin.processDirectory(folder);
	}
}
