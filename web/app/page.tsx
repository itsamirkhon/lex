"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

const WORKFLOWS = [
  {
    id: "contract-review",
    label: "Contract Review",
    eyebrow: "Risk and redlines",
    description: "Find non-standard clauses, legal exposure, negotiation points, and BMW policy issues.",
    command: "/contract-review",
    placeholder: "Review the uploaded NDA for supplier-side risk and unusual liability language.",
    defaultJurisdiction: "de",
    accent: "blue",
  },
  {
    id: "compliance-check",
    label: "Compliance Check",
    eyebrow: "Sanctions, ESG, GDPR",
    description: "Screen a counterparty, transaction, or topic across compliance domains.",
    command: "/compliance-check",
    placeholder: "Check Acme GmbH for sanctions and supply-chain compliance concerns.",
    defaultJurisdiction: "de",
    accent: "green",
  },
  {
    id: "legal-research",
    label: "Legal Research",
    eyebrow: "Source-grounded memo",
    description: "Research a legal question with jurisdiction notes, citations, and assumptions.",
    command: "/legal-research",
    placeholder: "Research enforceability of force majeure clauses in German supplier contracts.",
    defaultJurisdiction: "de",
    accent: "purple",
  },
  {
    id: "risk-assessment",
    label: "Risk Assessment",
    eyebrow: "Executive view",
    description: "Turn a document or issue into severity, impact, mitigations, and next actions.",
    command: "/risk-assessment",
    placeholder: "Assess legal and operational risk in the uploaded supplier agreement.",
    defaultJurisdiction: "de",
    accent: "amber",
  },
  {
    id: "contract-draft",
    label: "Contract Draft",
    eyebrow: "First draft",
    description: "Create a structured first draft from BMW templates and your business context.",
    command: "/contract-draft",
    placeholder: "Draft a supplier NDA for Acme GmbH with German jurisdiction.",
    defaultJurisdiction: "de",
    accent: "slate",
  },
] as const;

const JURISDICTIONS = [
  { value: "de", label: "Germany" },
  { value: "uk", label: "United Kingdom" },
  { value: "us", label: "United States" },
  { value: "fr", label: "France" },
  { value: "all", label: "Multi-jurisdiction" },
];

type Workflow = (typeof WORKFLOWS)[number];
type TaskStatus = "idle" | "running" | "done" | "error";

type Artifact = {
  name: string;
  path: string;
  content: string;
  mtime: number;
  isProvenance: boolean;
};

type TaskState = {
  id: string;
  matterId: string;
  prompt: string;
  status: TaskStatus;
  statusText: string;
  artifacts: Artifact[];
  activeArtifact: Artifact | null;
  provenance: Record<string, string> | null;
};

function parseProvenance(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^\*\*(.+?):\*\*\s*(.+)/);
    if (match) result[match[1]!.trim()] = match[2]!.trim();
  }
  return result;
}

function makePrompt(workflow: Workflow, details: string, jurisdiction: string, uploadedFile: string | null): string {
  const parts: string[] = [workflow.command];
  const trimmedDetails = details.trim();
  if (uploadedFile) parts.push(uploadedFile);
  if (trimmedDetails) parts.push(JSON.stringify(trimmedDetails));
  if (jurisdiction) parts.push(`--jurisdiction ${jurisdiction}`);
  return parts.join(" ");
}

function statusStepClass(task: TaskState | null, step: "prepare" | "agents" | "review") {
  if (!task) return "pending";
  if (task.status === "error") return step === "prepare" ? "done" : "error";
  if (step === "prepare") return "done";
  if (step === "agents") return task.status === "running" ? "active" : "done";
  return task.status === "done" ? "done" : "pending";
}

export default function Home() {
  const [workflowId, setWorkflowId] = useState<Workflow["id"]>("contract-review");
  const [jurisdiction, setJurisdiction] = useState("de");
  const [details, setDetails] = useState<string>(WORKFLOWS[0].placeholder);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [task, setTask] = useState<TaskState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);

  const workflow = WORKFLOWS.find((item) => item.id === workflowId) ?? WORKFLOWS[0];
  const prompt = makePrompt(workflow, details, jurisdiction, uploadedFile);
  const isRunning = task?.status === "running";

  function selectWorkflow(nextWorkflow: Workflow) {
    setWorkflowId(nextWorkflow.id);
    setJurisdiction(nextWorkflow.defaultJurisdiction);
    setDetails(nextWorkflow.placeholder);
    setErrorMessage(null);
    setTimeout(() => detailsRef.current?.focus(), 0);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);

    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: form });
    if (!response.ok) {
      setErrorMessage("Upload failed. Try another file or check the server log.");
      return;
    }
    const data = await response.json() as { path: string; filename: string };
    setUploadedFile(data.path);
    setUploadName(data.filename);
  }

  async function handleRun() {
    if (isRunning) return;
    if (!details.trim() && !uploadedFile) {
      setErrorMessage("Add a short instruction or upload a document first.");
      detailsRef.current?.focus();
      return;
    }

    const matterId = `matter-${Date.now()}`;
    const nextTask: TaskState = {
      id: matterId,
      matterId,
      prompt,
      status: "running",
      statusText: "Preparing the legal agents...",
      artifacts: [],
      activeArtifact: null,
      provenance: null,
    };
    setTask(nextTask);
    setErrorMessage(null);

    const response = await fetch("/api/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, matterId }),
    });

    if (!response.ok) {
      setTask((previous) => previous ? { ...previous, status: "error", statusText: "Failed to start the workflow." } : null);
      setErrorMessage("Lex could not start this workflow. Check auth and try again.");
      return;
    }

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const statusResponse = await fetch(`/api/status?matterId=${matterId}`);
      if (!statusResponse.ok) return;

      const data = await statusResponse.json() as {
        status: TaskStatus;
        statusText: string;
        artifacts: Artifact[];
      };

      setTask((previous) => {
        if (!previous) return null;
        const provenanceArtifact = data.artifacts.find((artifact) => artifact.isProvenance);
        const provenance = provenanceArtifact ? parseProvenance(provenanceArtifact.content) : previous.provenance;
        const visibleArtifacts = data.artifacts.filter((artifact) => !artifact.isProvenance);
        const activeArtifact = previous.activeArtifact
          ? (visibleArtifacts.find((artifact) => artifact.path === previous.activeArtifact?.path) ?? visibleArtifacts[0] ?? null)
          : (visibleArtifacts[0] ?? null);

        return {
          ...previous,
          status: data.status,
          statusText: data.statusText,
          artifacts: visibleArtifacts,
          activeArtifact,
          provenance: provenance ?? null,
        };
      });

      if (data.status === "done" || data.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="product-mark">
            <span className="mark-symbol">L</span>
            <span>Lex</span>
          </div>
          <h1>Legal work, routed to the right agents.</h1>
          <p>
            Upload a document or describe the matter. Lex builds the command, starts the agents,
            and keeps the result traceable.
          </p>
        </div>
        <div className="hero-stats" aria-label="Lex workflow summary">
          <div><strong>5</strong><span>workflows</span></div>
          <div><strong>7</strong><span>specialist agents</span></div>
          <div><strong>1</strong><span>matter workspace</span></div>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="workflow-panel" aria-label="Workflow selection">
          <div className="section-heading">
            <span>Choose Workflow</span>
            <small>No slash commands needed</small>
          </div>
          <div className="workflow-list">
            {WORKFLOWS.map((item) => (
              <button
                key={item.id}
                className={`workflow-card ${item.accent} ${item.id === workflow.id ? "selected" : ""}`}
                onClick={() => selectWorkflow(item)}
              >
                <span className="workflow-eyebrow">{item.eyebrow}</span>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="composer-panel">
          <div className="section-heading wide">
            <span>{workflow.label}</span>
            <small>{workflow.command}</small>
          </div>

          <label className="field-label" htmlFor="matter-details">What should Lex do?</label>
          <textarea
            id="matter-details"
            ref={detailsRef}
            className="matter-textarea"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={workflow.placeholder}
          />

          <div className="form-row">
            <label className="select-field">
              <span>Jurisdiction</span>
              <select value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)}>
                {JURISDICTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <label className="upload-card">
              <input type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={handleUpload} />
              <span className="upload-title">{uploadName ? "Document attached" : "Attach document"}</span>
              <span className="upload-subtitle">{uploadName ?? "PDF, DOCX, TXT, or Markdown"}</span>
            </label>
          </div>

          <div className="command-preview">
            <span>Generated command</span>
            <code>{prompt}</code>
          </div>

          {errorMessage && <div className="error-banner">{errorMessage}</div>}

          <div className="action-row">
            <button className="primary-action" onClick={handleRun} disabled={isRunning}>
              {isRunning ? "Running workflow" : "Start legal workflow"}
            </button>
            <button
              className="secondary-action"
              onClick={() => {
                setDetails(workflow.placeholder);
                setUploadedFile(null);
                setUploadName(null);
                setErrorMessage(null);
              }}
              disabled={isRunning}
            >
              Reset
            </button>
          </div>
        </section>

        <aside className="status-panel" aria-label="Workflow status">
          <div className="section-heading">
            <span>Status</span>
            <small>{task?.matterId ?? "No active matter"}</small>
          </div>
          <div className="status-timeline">
            <div className={`timeline-step ${statusStepClass(task, "prepare")}`}>
              <span />
              <div><strong>Prepare</strong><small>Workspace and prompt</small></div>
            </div>
            <div className={`timeline-step ${statusStepClass(task, "agents")}`}>
              <span />
              <div><strong>Agents</strong><small>{task?.statusText ?? "Waiting to start"}</small></div>
            </div>
            <div className={`timeline-step ${statusStepClass(task, "review")}`}>
              <span />
              <div><strong>Review</strong><small>{task?.artifacts.length ? `${task.artifacts.length} artifact ready` : "Results appear here"}</small></div>
            </div>
          </div>

          <div className="agent-stack">
            {["contract-agent", "compliance-agent", "research-agent", "risk-agent", "qa-agent"].map((agent) => <span key={agent}>{agent}</span>)}
          </div>
        </aside>
      </section>

      <section className="results-panel">
        <div className="results-header">
          <div>
            <span className="eyebrow">Results</span>
            <h2>{task?.activeArtifact?.name ?? "Matter output"}</h2>
          </div>
          {task && <span className={`status-pill ${task.status}`}>{task.status}</span>}
        </div>

        {task ? (
          <div className="results-grid">
            <div className="artifact-sidebar">
              <span className="sidebar-title">Artifacts</span>
              {task.artifacts.length > 0 ? task.artifacts.map((artifact) => (
                <button
                  key={artifact.path}
                  className={`artifact-button ${task.activeArtifact?.path === artifact.path ? "active" : ""}`}
                  onClick={() => setTask((previous) => previous ? { ...previous, activeArtifact: artifact } : null)}
                >
                  <strong>{artifact.name}</strong>
                  <span>{new Date(artifact.mtime).toLocaleString()}</span>
                </button>
              )) : (
                <p className="muted-copy">Artifacts will appear as soon as agents write draft or final files.</p>
              )}
            </div>

            <article className="artifact-viewer">
              {task.activeArtifact ? (
                <div className="markdown-body">
                  <ReactMarkdown>{task.activeArtifact.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="waiting-card">
                  <div className="loader-ring" />
                  <h3>{task.status === "running" ? "Agents are working" : "No result selected"}</h3>
                  <p>{task.statusText}</p>
                </div>
              )}
            </article>

            <aside className="trace-panel">
              <span className="sidebar-title">Traceability</span>
              {task.provenance ? Object.entries(task.provenance).map(([key, value]) => (
                <div key={key} className="trace-row">
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
              )) : (
                <p className="muted-copy">Source notes, QA status, and review gates will show here when available.</p>
              )}
            </aside>
          </div>
        ) : (
          <div className="welcome-results">
            <h3>Start with a workflow card above.</h3>
            <p>Lex will create matter outputs under your current workspace and show final files here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
