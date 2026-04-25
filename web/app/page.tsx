"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const COMMANDS = [
  { cmd: "/contract-review", desc: "Review a contract for risks and BMW compliance", args: "<file> [--jurisdiction de|us|uk|fr]" },
  { cmd: "/compliance-check", desc: "Check sanctions, LkSG, ESG, GDPR compliance", args: "<topic> [--check-type sanctions|lksg|esg|gdpr|all]" },
  { cmd: "/legal-research", desc: "Jurisdiction-specific statute and case law research", args: "<question> [--jurisdiction de|us|uk|fr|all]" },
  { cmd: "/risk-assessment", desc: "Comprehensive legal risk assessment", args: "<file-or-topic> [--jurisdiction de]" },
  { cmd: "/contract-draft", desc: "Draft a contract from BMW standard templates", args: "<nda|supply|service> [--jurisdiction de]" },
];

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
    const m = line.match(/^\*\*(.+?):\*\*\s*(.+)/);
    if (m) result[m[1]!.trim()] = m[2]!.trim();
  }
  return result;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [task, setTask] = useState<TaskState | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredCommands = prompt.startsWith("/")
    ? COMMANDS.filter((c) => c.cmd.startsWith(prompt.split(" ")[0] ?? ""))
    : [];

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    setShowAutocomplete(e.target.value.startsWith("/"));
  }

  function selectCommand(cmd: string) {
    setPrompt(cmd + " ");
    setShowAutocomplete(false);
    inputRef.current?.focus();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (res.ok) {
      const { path } = await res.json() as { path: string };
      setUploadedFile(path);
      setPrompt((prev) => prev + ` ${path}`);
    }
  }

  async function handleRun() {
    if (!prompt.trim()) return;
    const matterId = `matter-${Date.now()}`;
    const newTask: TaskState = {
      id: matterId,
      matterId,
      prompt,
      status: "running",
      statusText: "Starting agents...",
      artifacts: [],
      activeArtifact: null,
      provenance: null,
    };
    setTask(newTask);

    const res = await fetch("/api/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, matterId }),
    });

    if (!res.ok) {
      setTask((prev) => prev ? { ...prev, status: "error", statusText: "Failed to start task." } : null);
      return;
    }

    // Start polling
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const statusRes = await fetch(`/api/status?matterId=${matterId}`);
      if (!statusRes.ok) return;
      const data = await statusRes.json() as {
        status: TaskStatus;
        statusText: string;
        artifacts: Artifact[];
      };

      setTask((prev) => {
        if (!prev) return null;
        const provenance = data.artifacts.find((a) => a.isProvenance);
        const parsed = provenance ? parseProvenance(provenance.content) : prev.provenance;
        const mainArtifacts = data.artifacts.filter((a) => !a.isProvenance);
        const activeArtifact = prev.activeArtifact
          ? (mainArtifacts.find((a) => a.path === prev.activeArtifact?.path) ?? mainArtifacts[0] ?? null)
          : (mainArtifacts[0] ?? null);

        return {
          ...prev,
          status: data.status,
          statusText: data.statusText,
          artifacts: mainArtifacts,
          activeArtifact,
          provenance: parsed ?? null,
        };
      });

      if (data.status === "done" || data.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const statusColor = task?.status === "running" ? "running"
    : task?.status === "done" ? "done"
    : task?.status === "error" ? "error" : "idle";

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div>
          <div className="header-logo">⚖ Lex</div>
        </div>
        <div className="header-subtitle">BMW Group Legal AI Agent Platform</div>
      </header>

      <div className="main">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">Legal Workflows</div>
          {COMMANDS.map((c) => (
            <button
              key={c.cmd}
              className="sidebar-item"
              onClick={() => { setPrompt(c.cmd + " "); inputRef.current?.focus(); }}
            >
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#0066B2" }}>{c.cmd}</span>
            </button>
          ))}

          <div className="sidebar-section" style={{ marginTop: 16 }}>Agents</div>
          {["contract-agent", "compliance-agent", "research-agent", "risk-agent", "negotiation-agent", "knowledge-agent", "qa-agent"].map((a) => (
            <div key={a} className="sidebar-item" style={{ cursor: "default", fontSize: 12, color: "#6b7280" }}>
              {a}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <div className="content">
          {/* Task input */}
          <div className="task-panel">
            <div className="task-input-row">
              <div className="task-input-wrapper">
                <textarea
                  ref={inputRef}
                  className="task-input"
                  value={prompt}
                  onChange={handleInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRun(); }
                  }}
                  placeholder="/contract-review samples/acme-supplier-nda-draft.md --jurisdiction de"
                  rows={2}
                />
                {showAutocomplete && filteredCommands.length > 0 && (
                  <div className="autocomplete">
                    {filteredCommands.map((c) => (
                      <div key={c.cmd} className="autocomplete-item" onClick={() => selectCommand(c.cmd)}>
                        <span className="cmd">{c.cmd}</span>
                        <span className="desc">{c.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="upload-btn-wrapper">
                <button className="btn btn-secondary">📎 Upload</button>
                <input type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={handleUpload} />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleRun}
                disabled={task?.status === "running"}
              >
                {task?.status === "running" ? "Running..." : "Run"}
              </button>
            </div>
            {uploadedFile && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#0066B2" }}>
                📎 Attached: {uploadedFile}
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="status-bar">
            <div className={`status-dot ${statusColor}`} />
            {task ? task.statusText : "Ready — enter a command or choose a workflow from the sidebar"}
          </div>

          {/* Artifact area */}
          {task ? (
            <div className="artifact-area">
              {/* Artifact list */}
              {task.artifacts.length > 0 && (
                <div className="artifact-list">
                  {task.artifacts.map((a) => (
                    <div
                      key={a.path}
                      className={`artifact-item ${task.activeArtifact?.path === a.path ? "active" : ""}`}
                      onClick={() => setTask((prev) => prev ? { ...prev, activeArtifact: a } : null)}
                    >
                      <div className="name">{a.name}</div>
                      <div className="meta">{new Date(a.mtime).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Content viewer */}
              <div className="artifact-viewer">
                {task.activeArtifact ? (
                  <div className="artifact-content">
                    <div className="markdown">
                      <ReactMarkdown>{task.activeArtifact.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className={`status-dot ${statusColor}`} style={{ width: 16, height: 16, marginBottom: 16 }} />
                    <h2>{task.status === "running" ? "Agents Working..." : "No artifacts yet"}</h2>
                    <p>{task.statusText}</p>
                  </div>
                )}

                {/* Traceability panel */}
                {task.provenance && (
                  <div className="traceability-panel">
                    <div className="trace-title">Traceability</div>
                    {Object.entries(task.provenance).map(([k, v]) => (
                      <div key={k} className="trace-item">
                        <div className="trace-label">{k}</div>
                        <div className="trace-value">
                          {k === "QA result" ? (
                            <span className={`trace-badge ${v.includes("PASS") ? "pass" : v.includes("BLOCKED") ? "fail" : "warn"}`}>{v}</span>
                          ) : k === "Human review gate" ? (
                            <span className={`trace-badge ${v === "APPROVED" ? "pass" : v === "BYPASSED" ? "warn" : "pending"}`}>{v}</span>
                          ) : v}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <h2>BMW Legal AI Platform</h2>
              <p>
                Enter a legal workflow command below, or choose from the sidebar.
                Lex coordinates specialized AI agents to handle contract review,
                compliance checks, legal research, and risk assessment.
              </p>
              <div className="command-chips">
                {COMMANDS.map((c) => (
                  <button
                    key={c.cmd}
                    className="chip"
                    onClick={() => { setPrompt(c.cmd + " "); inputRef.current?.focus(); }}
                  >
                    {c.cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
