# Release Notes

## [3.1.0-20260220] - 2026-02-20

### Major Changes: Mastra Agent Refactoring
- **Agent Separation**: Decomposed the monolithic `ContentCreatorAgent` into four specialized, sequential agents (Researcher, Strategist, Writer, and Editor) executing as a pipeline, drastically reducing context window limitations and improving text outputs.
- **Dynamic Preference Memory**: Agents now feature Episodic Memory. They can learn, retrieve, and automatically apply specific user preferences and stylistic rules saved across chat sessions via a new backend database schema integration.
- **Proactive Voice Replication**: Agents automatically pull a user's top-performing published posts and dynamically embed them as reference examples in system prompts to aggressively replicate the user's authentic voice.
- **Deep Document Analysis**: Integrated robust URL scraping (`read-webpage-content`), enabling agents to read and parse full articles and documents deeply, cleanly stripped of HTML noise, rather than depending solely on high-level search metadata.

### Backend Improvements
- **Multi-Agent Orchestration**: `MastraAgentService.chat()` now orchestrates the sequential execution loop of Researcher -> Strategist -> Writer -> Editor.
- **Robust Tool Tracking**: Implemented a detailed `onStepFinish` sequence aggregation to correctly accumulate all intermediate tool executions during multi-stage generation.
- **Rigid JSON Enforcement**: Explicit bounding and system prompt limits prevent the Editor Agent from breaking the schema by polluting JSON responses with conversational filler text.

## [3.0.0-20251228] - 2025-12-28 22:45:00

### Major Changes: Multi-Tenancy & Collaboration
- **Tenant-Based Architecture**: Complete migration from user-centric to workspace-centric data isolation.
- **Workspaces (Tenants)**: Users can now belong to multiple workspaces.
- **Team Management**: New "Users" page to view team members and manage access.
- **Invitation System**: Token-based email invitation flow implemented.
- **Workspace Switcher**: Seamless switching between workspaces directly from the sidebar.

### Backend Improvements
- **Refactored Routes**: 
    - `Posts`, `Ideas`, `Analytics`, `Settings`, and `AI` routes now enforce strict tenant isolation.
    - Updated `GET /user-auth/me` to include tenant context and role information.
- **Multi-Tenant Services**:
    - `AIService`: AI generation now uses tenant-specific API keys and tone settings.
    - `LinkedInService` & `TwitterService`: API calls are now scoped by tenant credentials instead of individual user credentials.
    - `SchedulerService`: Background publishing and recurring idea generation are now tenant-aware.
    - `AnalyticsSyncService`: Background analytics syncing now correctly groups and processes posts by tenant.
- **Model Enhancements**: Added `Tenant`, `TenantMember`, and `Invitation` models. Associated `Post`, `Idea`, and `Settings` with `tenantId`.
- **Database Migrations**: SQL and TypeScript scripts added for schema updates and automatic backfilling of existing data into default tenants.

### Frontend Enhancements
- **Workspace-Aware API Client**: Axios interceptor automatically attaches `x-tenant-id` to all requests.
- **AuthContext Upgrade**: Manages multi-tenant state and workspace switching logic.
- **User Management UI**: Implementation of team member listing and invitation revoking.
- **Invitation Acceptance**: Dedicated landing page for joining workspaces via secure tokens.

### Features & Fixes
- Added `postShape`, `effortLevel`, `keyTakeaway`, and `antiGoals` to Ideas for finer control over AI generation.
- Fixed `uuid` module compatibility issue by pins to version 9.0.1 for CommonJS support in `ts-node`.
- Restored sidebar navigation to include "Users" and "Settings".
- Added dynamic dashboard analytics with tenant-scoped data.
