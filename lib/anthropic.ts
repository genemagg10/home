import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Opus 4.8 for the chat ("Ask the House") — best reasoning over the manual.
export const CHAT_MODEL = process.env.HOMEBASE_CHAT_MODEL || "claude-opus-4-8";

// Haiku 4.5 for cheap structured extraction/tagging of uploads.
export const EXTRACT_MODEL = process.env.HOMEBASE_EXTRACT_MODEL || "claude-haiku-4-5";
