// Markdown parser — common emoji map
// Uses emoji data from @univers42/ui-collection (no hardcoded picker list)
import fs from "node:fs";
import path from "node:path";

interface PickerEmojiItem {
  id: string;
  value: string;
  keywords?: string[];
}

function isPickerEmojiItem(value: unknown): value is PickerEmojiItem {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string") return false;
  if (typeof candidate.value !== "string") return false;
  if (
    candidate.keywords !== undefined &&
    (!Array.isArray(candidate.keywords) ||
      candidate.keywords.some((k) => typeof k !== "string"))
  ) {
    return false;
  }
  return true;
}

function loadPickerEmojis(): PickerEmojiItem[] {
  const sourcePath = path.resolve(
    process.cwd(),
    "node_modules/@univers42/ui-collection/dist/library/components/react/emoji-picker/emojiPickerData.js",
  );

  try {
    const source = fs.readFileSync(sourcePath, "utf8");
    const match = /DEFAULT_EMOJI_PICKER_ITEMS\s*=\s*(\[[\s\S]*?\]);/.exec(
      source,
    );
    if (!match) return [];

    // Trusted package source: evaluate only the array literal we extracted.
    // eslint-disable-next-line no-new-func
    const parsed = new Function(`return (${match[1]});`)() as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isPickerEmojiItem);
  } catch {
    return [];
  }
}

const PICKER_EMOJIS: PickerEmojiItem[] = loadPickerEmojis();

const LEGACY_ALIASES: Record<string, string> = {
  thumbsup: "thumbs-up",
  checkmark: "check",
  tada: "party",
  party_popper: "party",
  hammer: "tools",
  wrench: "tools",
};

function addAliasIfMissing(
  map: Record<string, string>,
  alias: string,
  value: string,
): void {
  if (!map[alias]) {
    map[alias] = value;
  }
}

/**
 * Build emoji map from the ui-collection emoji picker data.
 * Maps emoji IDs and keywords to their Unicode values.
 */
function buildEmojiMap(): Record<string, string> {
  const map: Record<string, string> = {};

  // Add canonical IDs and keyword aliases from the picker data.
  for (const item of PICKER_EMOJIS) {
    map[item.id] = item.value;

    for (const keyword of item.keywords ?? []) {
      addAliasIfMissing(map, keyword, item.value);
    }
  }

  // Keep compatibility aliases used by legacy markdown content.
  for (const [legacy, canonical] of Object.entries(LEGACY_ALIASES)) {
    const value = map[canonical];
    if (value) {
      addAliasIfMissing(map, legacy, value);
    }
  }

  return map;
}

export const EMOJI_MAP: Record<string, string> = buildEmojiMap();
