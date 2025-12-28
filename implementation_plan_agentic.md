
# Implementation Plan: Agentic Generation Pipeline

## Overview
We will implement an advanced "Agentic Generation" pipeline alongside the existing "Basic Generation". This new pipeline uses **Mastra** to orchestrate a multi-agent workflow that iteratively refines content until it meets a high quality standard (Confidence Score > 85%).

## Core Components

### 1. Agents (The "Team")
We will define three specialized agents using Mastra:
*   **Writer Agent**: Drafts the initial content based on the user's prompt, idea, and research. Basically everything that is collected in the Idea or post content and the settings.
    *   *Tools*: Tavily Web Search (for fact-checking and finding relevant hooks/stats).
*   **Reviewer Agent**: Critiques the draft against the "Anti-Goals", "Tone", and general best practices. Also validate content for accuracy, relevance, and engagement.
    *   *Output*: A structured critique with a `confidence_score` (0-100).
*   **Editor Agent**: Polishes the draft based on the Reviewer's feedback.

### 2. The Workflow ( The "Loop")
The workflow will follow this logic:
1.  **Research & Draft**: Writer Agent creates V1.
2.  **Review Loop**:
    *   Reviewer Agent analyzes the latest draft.
    *   **Check**: If `confidence_score > 85` OR `iterations > 3`:
        *   **Exit**: Return the draft.
    *   **Else**:
        *   Editor Agent refines the draft based on feedback.
        *   **Loop**: Send back to Reviewer.

### 3. Tech Stack
*   **Framework**: `@mastra/core`
*   **Search**: `@tavily/core` (or simple fetch)
*   **Validation**: `zod`

## Database Changes
We need to update the `Settings` table to store:
*   `enableAgenticGeneration` (BOOLEAN, default false)
*   `tavilyApiKey` (TEXT, nullable)

## Implementation Steps

### Phase 1: Infrastructure & Configuration
1.  **Install Dependencies**: `npm install @mastra/core zod @tavily/core`
2.  **Database Migration**: Add columns to `Settings`.
3.  **Frontend Settings**: Add UI in `/settings` to toggle Agentic mode and input Tavily API Key.

### Phase 2: Mastra Setup (Backend)
4.  **Directory Structure**: Create `backend/src/mastra/`
    *   `tools/`: searchTool.ts
    *   `agents/`: writer.ts, reviewer.ts, editor.ts
    *   `workflows/`: postGenerationWorkflow.ts
5.  **Tool Implementation**: Wrap Tavily search as a Mastra Tool.
6.  **Agent Definition**: Configure the 3 agents with distinct system prompts and schemas.
7.  **Workflow Definition**: Implement the loop logic.
8.  **Model Selection**: We will be using OpenRouter models for all the agents. Refer to following example for model selection:

```typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "openrouter/anthropic/claude-3.5-haiku"
});
```
9.  **Mastra Agent Implementation**: Refer to the following directory structure:

```text
├── backend/
│   ├── src/
│   │   └── mastra/
│   │       ├── agents/
│   │       ├── tools/
│   │       ├── workflows/
│   │       └── index.ts
│   ├── package.json
│   └── tsconfig.json
```

### Phase 3: Integration
8.  **Service Layer**: Update `AIService.generate` to check `enableAgenticGeneration`.
    *   If TRUE: Call `MastraPostGenerationWorkflow.execute()`.
    *   If FALSE: Call existing `Basic Generation` logic.
9.  **Frontend Update**: (Optional) Allow per-post override in the "New Idea" modal (e.g., a "Deep Mode" toggle).

## Usage
The user will simply click "Generate Post" as usual. If Agentic mode is enabled, the generation might take longer (15-30s) but will produce higher quality output. We should update the UI to show "Agents working..." instead of just "Generating...".
