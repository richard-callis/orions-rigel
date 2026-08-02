export type CodeToken = {
  text: string;
  kind: "keyword" | "string" | "comment" | "number" | "plain";
};

const SQL_KEYWORDS = new Set(
  [
    "select", "from", "where", "join", "left", "right", "inner", "outer", "full",
    "on", "group", "by", "order", "having", "insert", "into", "values", "update",
    "set", "delete", "create", "table", "index", "view", "materialized", "procedure",
    "function", "returns", "return", "as", "with", "recursive", "union", "all",
    "distinct", "limit", "offset", "case", "when", "then", "else", "end", "and",
    "or", "not", "null", "is", "in", "exists", "between", "like", "ilike", "asc",
    "desc", "default", "primary", "key", "foreign", "references", "constraint",
    "check", "unique", "alter", "add", "drop", "column", "explain", "analyze",
    "partition", "over", "window", "declare", "begin", "language", "plpgsql",
    "if", "loop", "for", "execute", "using", "cast", "trigger", "before", "after",
    "each", "row", "generate_series",
  ].map((s) => s.toLowerCase())
);

const YAML_KEYWORDS = new Set(["true", "false", "null", "yes", "no"]);

/** Lightweight, non-exhaustive tokenizer — enough for readable syntax
 * highlighting in static lesson code blocks, not a full parser. */
export function highlightCode(code: string, language: string): CodeToken[] {
  const lang = language.toLowerCase();
  if (lang === "sql") return tokenize(code, /--[^\n]*/, SQL_KEYWORDS);
  if (lang === "yaml" || lang === "yml") return tokenize(code, /#[^\n]*/, YAML_KEYWORDS);
  return [{ text: code, kind: "plain" }];
}

function tokenize(code: string, commentPattern: RegExp, keywords: Set<string>): CodeToken[] {
  const pattern = new RegExp(
    `(${commentPattern.source})|('(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_][A-Za-z0-9_]*)`,
    "g"
  );

  const tokens: CodeToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: code.slice(lastIndex, match.index), kind: "plain" });
    }
    const [full, comment, string, number, word] = match;
    if (comment) tokens.push({ text: full, kind: "comment" });
    else if (string) tokens.push({ text: full, kind: "string" });
    else if (number) tokens.push({ text: full, kind: "number" });
    else if (word) tokens.push({ text: full, kind: keywords.has(word.toLowerCase()) ? "keyword" : "plain" });
    lastIndex = match.index + full.length;
  }
  if (lastIndex < code.length) {
    tokens.push({ text: code.slice(lastIndex), kind: "plain" });
  }
  return tokens;
}
