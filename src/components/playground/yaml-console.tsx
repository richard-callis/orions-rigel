"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml as yamlLang } from "@codemirror/lang-yaml";
import { CheckCircle2, AlertTriangle, XCircle, Info, ShieldCheck } from "lucide-react";
import { validateManifest, type ValidationResult, type IssueLevel } from "@/lib/k8s-validate";
import { useSavedSnippets } from "@/lib/use-saved-snippets";
import { SavedSnippetsButton, SaveSnippetButton } from "./saved-snippets";

export type YamlConsoleHandle = {
  runQuery: (yamlText: string) => void;
};

const DEFAULT_MANIFEST = `apiVersion: v1
kind: Pod
metadata:
  name: hello-world
spec:
  containers:
    - name: app
      image: nginx:1.27
`;

const LEVEL_STYLES: Record<IssueLevel, { icon: typeof XCircle; className: string }> = {
  error: { icon: XCircle, className: "text-error" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  info: { icon: Info, className: "text-muted" },
};

export const YamlConsole = forwardRef<YamlConsoleHandle, { courseSlug: string }>(
  function YamlConsole({ courseSlug }, ref) {
    const { signedIn, items: savedQueries, save, remove } = useSavedSnippets(courseSlug);

    const [code, setCode] = useState(DEFAULT_MANIFEST);
    const [result, setResult] = useState<ValidationResult | null>(null);

    function validate(text: string) {
      setResult(validateManifest(text));
    }

    useImperativeHandle(
      ref,
      () => ({
        runQuery: (yamlText: string) => {
          setCode(yamlText);
          validate(yamlText);
        },
      }),
      []
    );

    return (
      <div
        className="flex h-full flex-col"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            validate(code);
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-foreground-secondary">
            <ShieldCheck size={14} className="text-accent" />
            Manifest validator — checks structure client-side, no cluster required
          </div>
          {signedIn && (
            <SavedSnippetsButton
              items={savedQueries}
              onLoad={(item) => setCode(item.content)}
              onDelete={remove}
            />
          )}
        </div>

        <div className="border-b border-border">
          <CodeMirror
            value={code}
            onChange={setCode}
            height="180px"
            theme="dark"
            extensions={[yamlLang()]}
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
          <div className="flex items-center justify-between bg-surface-raised px-3 py-2">
            <span className="text-xs text-muted font-mono">⌘/Ctrl + Enter to validate</span>
            <div className="flex items-center gap-2">
              {signedIn && <SaveSnippetButton disabled={!code.trim()} onSave={(title) => save(title, code)} />}
              <button
                onClick={() => validate(code)}
                disabled={!code.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
              >
                <ShieldCheck size={12} />
                Validate
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 text-sm">
          {!result && (
            <p className="text-muted">Write or paste a manifest, then Validate.</p>
          )}
          {result && !result.ok && (
            <p className="text-error font-mono text-xs whitespace-pre-wrap">{result.parseError}</p>
          )}
          {result && result.ok && (
            <div className="space-y-4">
              {result.documents.map((doc) => (
                <div key={doc.index} className="rounded-lg border border-border">
                  <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-1.5">
                    <span className="font-mono text-xs text-foreground-secondary">
                      {result.documents.length > 1 ? `Document ${doc.index + 1}` : "Document"}
                    </span>
                    {doc.kind && (
                      <span className="eyebrow">
                        {doc.kind}
                        {doc.name ? ` · ${doc.name}` : ""}
                      </span>
                    )}
                    {doc.issues.length === 0 && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 size={12} /> Looks good
                      </span>
                    )}
                  </div>
                  {doc.issues.length > 0 && (
                    <ul className="divide-y divide-border">
                      {doc.issues.map((issue, i) => {
                        const { icon: Icon, className } = LEVEL_STYLES[issue.level];
                        return (
                          <li key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                            <Icon size={14} className={`mt-0.5 shrink-0 ${className}`} />
                            <span className="text-foreground-secondary">{issue.message}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);
