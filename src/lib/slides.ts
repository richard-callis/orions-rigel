/**
 * Splits a lesson's raw Markdown/MDX into presentation slides.
 *
 * Boundaries: a standalone `---` line, or an `##`/`###` heading. Both are
 * common in this content already (section dividers + subsection headings),
 * so authors don't need to write slides separately from the lesson doc —
 * Present mode and Learn mode render the exact same source.
 */
export function splitIntoSlides(content: string): string[] {
  const lines = content.split("\n");
  const slides: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    const chunk = current.join("\n").trim();
    if (chunk.length > 0) slides.push(chunk);
    current = [];
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      current.push(line);
      continue;
    }

    if (!inFence && line.trim() === "---") {
      flush();
      continue;
    }

    if (!inFence && /^#{2,3}\s/.test(line)) {
      flush();
      current.push(line);
      continue;
    }

    current.push(line);
  }

  flush();
  return slides;
}
