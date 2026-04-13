export type MarkdownViewMode = "source" | "live-preview" | "reading";

export interface MarkdownModeState {
  readonly name: MarkdownViewMode;
  getBlockState(): MarkdownViewMode;
  shouldHideMarkdownSymbols(): boolean;
}

export class SourceMode implements MarkdownModeState {
  public readonly name: MarkdownViewMode = "source";

  public getBlockState(): MarkdownViewMode {
    return this.name;
  }

  public shouldHideMarkdownSymbols(): boolean {
    return false;
  }
}

export class LivePreviewMode implements MarkdownModeState {
  public readonly name: MarkdownViewMode = "live-preview";

  public getBlockState(): MarkdownViewMode {
    return this.name;
  }

  public shouldHideMarkdownSymbols(): boolean {
    return true;
  }
}

export class ReadingMode implements MarkdownModeState {
  public readonly name: MarkdownViewMode = "reading";

  public getBlockState(): MarkdownViewMode {
    return this.name;
  }

  public shouldHideMarkdownSymbols(): boolean {
    return true;
  }
}

export function resolveMarkdownMode(
  mode?: MarkdownViewMode,
): MarkdownModeState {
  switch (mode) {
    case "source":
      return new SourceMode();
    case "live-preview":
      return new LivePreviewMode();
    case "reading":
    default:
      return new ReadingMode();
  }
}
