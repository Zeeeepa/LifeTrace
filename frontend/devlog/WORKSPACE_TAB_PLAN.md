# Workspace Tab Roadmap

The preview workspace keeps all state on the client. Use this checklist to graduate it into a production feature without surprising existing users.

## Near term (frontend)
1. **File system bridge** – surface a selectable file tree (reuse `/frontend/lib/store/project` helpers) and stream file contents through a lightweight `/api/files` proxy instead of the local textarea draft.
2. **Chat session identity** – persist chat history per file, storing transcripts in IndexedDB first, then remote storage once APIs are ready.
3. **Bot suggestion cards** – convert the static cards into actionable patch objects (diff preview, accept/reject, expand details).

## Backend/API work
1. **Read-only file API** – expose a safe endpoint that resolves whitelisted paths and returns file contents with syntax metadata.
2. **LLM change planner** – extend the existing `lifetrace/llm` services with a "workspace" channel that can summarize diffs and propose edits.
3. **Change executor** – design a job (likely in `lifetrace/jobs`) that can apply patches inside a sandbox, gated behind explicit user approval.

## Safety & UX
1. **Permission gating** – require explicit confirmation before enabling write-mode; reuse the settings modal toggles for feature flags.
2. **Audit trail** – log each bot-applied change and show breadcrumbs in the action panel.
3. **Error recovery** – integrate git status snapshots so the user can roll back any automated edit with one click.
