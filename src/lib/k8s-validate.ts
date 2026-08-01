import * as yaml from "js-yaml";

/**
 * A lightweight, client-side Kubernetes manifest validator. There's no real
 * cluster behind the Kubernetes course's console (unlike SQL's PGlite, k8s
 * can't run client-side) — so instead of execution, this checks the same
 * structural mistakes that trip people up in real `kubectl apply`: missing
 * required fields, a Deployment's selector not matching its pod template
 * labels, deprecated apiVersions, `:latest` image tags, missing resource
 * requests/limits. It does not replace `kubectl apply --dry-run` or a real
 * schema validator (kubeconform, kubeval) — it's deliberately scoped to the
 * handful of resource kinds and mistakes most useful to teach with.
 */

export type IssueLevel = "error" | "warning" | "info";

export type ValidationIssue = {
  level: IssueLevel;
  message: string;
};

export type DocumentResult = {
  index: number;
  kind?: string;
  name?: string;
  issues: ValidationIssue[];
};

export type ValidationResult =
  | { ok: true; documents: DocumentResult[] }
  | { ok: false; parseError: string };

const KNOWN_KINDS = new Set([
  "Pod",
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "ReplicaSet",
  "Job",
  "CronJob",
  "Service",
  "ConfigMap",
  "Secret",
  "Namespace",
  "ServiceAccount",
  "Ingress",
  "PersistentVolumeClaim",
]);

const DEPRECATED_API_VERSIONS: Record<string, string> = {
  "extensions/v1beta1": "apps/v1 (or networking.k8s.io/v1 for Ingress)",
  "apps/v1beta1": "apps/v1",
  "apps/v1beta2": "apps/v1",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function get(obj: unknown, ...path: string[]): unknown {
  let cur = obj;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function validateManifest(text: string): ValidationResult {
  let rawDocs: unknown[];
  try {
    rawDocs = yaml.loadAll(text);
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      const line = err.mark ? err.mark.line + 1 : undefined;
      return {
        ok: false,
        parseError: line ? `Line ${line}: ${err.reason}` : err.message,
      };
    }
    return { ok: false, parseError: err instanceof Error ? err.message : String(err) };
  }

  const documents: DocumentResult[] = [];
  rawDocs.forEach((doc, index) => {
    if (doc != null) documents.push(validateDocument(doc, index));
  });

  if (documents.length === 0) {
    return { ok: false, parseError: "No YAML documents found — the input is empty." };
  }

  return { ok: true, documents };
}

function validateDocument(doc: unknown, index: number): DocumentResult {
  const issues: ValidationIssue[] = [];

  if (!isRecord(doc)) {
    return {
      index,
      issues: [{ level: "error", message: "Expected a YAML mapping (key: value) for this document." }],
    };
  }

  const apiVersion = doc.apiVersion;
  const kind = doc.kind;
  const name = typeof get(doc, "metadata", "name") === "string"
    ? (get(doc, "metadata", "name") as string)
    : undefined;

  if (typeof apiVersion !== "string" || !apiVersion) {
    issues.push({ level: "error", message: "Missing required field `apiVersion`." });
  } else if (DEPRECATED_API_VERSIONS[apiVersion]) {
    issues.push({
      level: "warning",
      message: `apiVersion \`${apiVersion}\` is deprecated/removed on current Kubernetes — use \`${DEPRECATED_API_VERSIONS[apiVersion]}\`.`,
    });
  }

  if (typeof kind !== "string" || !kind) {
    issues.push({ level: "error", message: "Missing required field `kind`." });
  }

  if (!isRecord(doc.metadata)) {
    issues.push({ level: "error", message: "Missing required field `metadata`." });
  } else if (
    typeof doc.metadata.name !== "string" &&
    typeof doc.metadata.generateName !== "string"
  ) {
    issues.push({ level: "error", message: "`metadata` needs a `name` (or `generateName`)." });
  }

  if (typeof kind === "string" && !KNOWN_KINDS.has(kind)) {
    issues.push({
      level: "info",
      message: `\`${kind}\` isn't a kind this validator has extra checks for — only the fields above were checked.`,
    });
  }

  if (typeof kind === "string" && KNOWN_KINDS.has(kind)) {
    validateByKind(doc, kind, issues);
  }

  return { index, kind: typeof kind === "string" ? kind : undefined, name, issues };
}

function validateByKind(doc: Record<string, unknown>, kind: string, issues: ValidationIssue[]) {
  switch (kind) {
    case "Pod":
      checkContainers(get(doc, "spec", "containers"), issues, "spec.containers");
      break;

    case "Deployment":
    case "StatefulSet":
    case "DaemonSet":
    case "ReplicaSet":
      checkWorkloadTemplate(doc, issues);
      break;

    case "Job": {
      checkContainers(
        get(doc, "spec", "template", "spec", "containers"),
        issues,
        "spec.template.spec.containers"
      );
      const restartPolicy = get(doc, "spec", "template", "spec", "restartPolicy");
      if (restartPolicy === "Always") {
        issues.push({
          level: "error",
          message: "A Job's `spec.template.spec.restartPolicy` can't be `Always` — use `Never` or `OnFailure`.",
        });
      }
      break;
    }

    case "CronJob": {
      const schedule = get(doc, "spec", "schedule");
      if (typeof schedule !== "string" || !schedule.trim()) {
        issues.push({ level: "error", message: "CronJob needs `spec.schedule`." });
      } else if (schedule.trim().split(/\s+/).length !== 5) {
        issues.push({
          level: "warning",
          message: `\`spec.schedule\` ("${schedule}") doesn't look like a 5-field cron expression (minute hour day month weekday).`,
        });
      }
      if (!isRecord(get(doc, "spec", "jobTemplate"))) {
        issues.push({ level: "error", message: "CronJob needs `spec.jobTemplate`." });
      }
      break;
    }

    case "Service": {
      const ports = get(doc, "spec", "ports");
      if (!Array.isArray(ports) || ports.length === 0) {
        issues.push({ level: "error", message: "Service needs at least one entry in `spec.ports`." });
      } else {
        ports.forEach((p, i) => {
          if (!isRecord(p) || typeof p.port !== "number") {
            issues.push({ level: "error", message: `spec.ports[${i}] needs a numeric \`port\`.` });
          }
        });
      }
      const selector = get(doc, "spec", "selector");
      const type = get(doc, "spec", "type");
      if (!isRecord(selector) && type !== "ExternalName") {
        issues.push({
          level: "warning",
          message: "No `spec.selector` — this Service won't route to any Pods unless that's intentional (e.g. a headless/manual-endpoints Service).",
        });
      }
      break;
    }

    case "ConfigMap":
    case "Secret": {
      const hasData = isRecord(get(doc, "data")) && Object.keys(get(doc, "data") as object).length > 0;
      const hasStringData =
        isRecord(get(doc, "stringData")) && Object.keys(get(doc, "stringData") as object).length > 0;
      if (!hasData && !hasStringData) {
        issues.push({ level: "warning", message: "No `data` (or `stringData`) — this is empty." });
      }
      break;
    }

    case "Ingress": {
      const rules = get(doc, "spec", "rules");
      const defaultBackend = get(doc, "spec", "defaultBackend");
      if ((!Array.isArray(rules) || rules.length === 0) && !isRecord(defaultBackend)) {
        issues.push({
          level: "error",
          message: "Ingress needs at least one entry in `spec.rules`, or a `spec.defaultBackend`.",
        });
      }
      break;
    }

    case "PersistentVolumeClaim": {
      const accessModes = get(doc, "spec", "accessModes");
      if (!Array.isArray(accessModes) || accessModes.length === 0) {
        issues.push({ level: "error", message: "PVC needs at least one entry in `spec.accessModes`." });
      }
      if (get(doc, "spec", "resources", "requests", "storage") === undefined) {
        issues.push({ level: "error", message: "PVC needs `spec.resources.requests.storage`." });
      }
      break;
    }
  }
}

function checkWorkloadTemplate(doc: Record<string, unknown>, issues: ValidationIssue[]) {
  const matchLabels = get(doc, "spec", "selector", "matchLabels");
  const templateLabels = get(doc, "spec", "template", "metadata", "labels");

  if (!isRecord(matchLabels) || Object.keys(matchLabels).length === 0) {
    issues.push({ level: "error", message: "Needs `spec.selector.matchLabels` (at least one label)." });
  }
  if (!isRecord(templateLabels) || Object.keys(templateLabels).length === 0) {
    issues.push({ level: "error", message: "Needs `spec.template.metadata.labels` (at least one label)." });
  }

  if (isRecord(matchLabels) && isRecord(templateLabels)) {
    const mismatched = Object.entries(matchLabels).filter(
      ([k, v]) => templateLabels[k] !== v
    );
    if (mismatched.length > 0) {
      issues.push({
        level: "error",
        message:
          "`spec.selector.matchLabels` doesn't match `spec.template.metadata.labels` " +
          `(${mismatched.map(([k, v]) => `${k}=${String(v)}`).join(", ")}) — ` +
          "the controller won't be able to find the Pods it creates. This is the single most " +
          "common hand-written-YAML mistake for this resource type.",
      });
    }
  }

  checkContainers(
    get(doc, "spec", "template", "spec", "containers"),
    issues,
    "spec.template.spec.containers"
  );
}

function checkContainers(containers: unknown, issues: ValidationIssue[], path: string) {
  if (!Array.isArray(containers) || containers.length === 0) {
    issues.push({ level: "error", message: `Needs at least one entry in \`${path}\`.` });
    return;
  }

  containers.forEach((c, i) => {
    if (!isRecord(c)) {
      issues.push({ level: "error", message: `${path}[${i}] must be a mapping.` });
      return;
    }
    if (typeof c.name !== "string" || !c.name) {
      issues.push({ level: "error", message: `${path}[${i}] needs a \`name\`.` });
    }
    const image = c.image;
    if (typeof image !== "string" || !image) {
      issues.push({ level: "error", message: `${path}[${i}] needs an \`image\`.` });
    } else if (!image.includes(":") || image.endsWith(":latest")) {
      issues.push({
        level: "warning",
        message: `${path}[${i}].image ("${image}") has no pinned tag (or uses \`:latest\`) — deployments become non-reproducible, and rollbacks can't target a specific version.`,
      });
    }
    if (!isRecord(c.resources) || (!isRecord(c.resources.requests) && !isRecord(c.resources.limits))) {
      issues.push({
        level: "warning",
        message: `${path}[${i}] has no \`resources.requests\`/\`resources.limits\` — without these, this container can starve others or get OOMKilled unpredictably under load.`,
      });
    }
  });
}
