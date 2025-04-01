import { TFile, TFolder } from "obsidian";

// Define available LLM providers
export enum LLMProvider {
	CLAUDE = "claude",
	OPENAI = "openai",
}

// Define available prompt types
export enum PromptType {
	TAG_GENERATION = "tag-generation",
}

// Define available models for each provider
export const CLAUDE_MODELS = [
	// Latest Claude 3.7 models
	"claude-3-7-sonnet-20250219",
	// Claude 3.5 models
	"claude-3-5-sonnet-20240620",
	"claude-3-5-sonnet-20241022",
	"claude-3-5-haiku-20241022",
	// Claude 3 models
	"claude-3-opus-20240229",
	"claude-3-sonnet-20240229",
	"claude-3-haiku-20240307",
];

export const OPENAI_MODELS = [
	// Latest reasoning models
	"o3-mini",
	"o1",
	"o1-mini",
	"o1-pro",
	// Flagship chat models
	"gpt-4.5-preview",
	"gpt-4o",
	"gpt-4",
	"gpt-4-turbo",
	"gpt-3.5-turbo",
];

export interface AIExcerptSettings {
	provider: LLMProvider;
	promptType: PromptType;
	claudeApiKey: string;
	claudeModel: string;
	openaiApiKey: string;
	openaiModel: string;
	tagPrefix: string;
}

export interface AIExcerptProvider {
	generateTags(content: string): Promise<string[]>;
}

export interface AIExcerptPlugin {
	settings: AIExcerptSettings;
	saveSettings(): Promise<void>;
	processFile(file: TFile, showNotices?: boolean): Promise<void>;
	processDirectory(folder: TFolder): Promise<void>;
	processAllFiles(): Promise<void>;
	updateStatusBar(processed: number, total: number): void;
}
