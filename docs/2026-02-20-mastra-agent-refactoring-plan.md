# Mastra Agent Refactoring Plan
**Date**: 2026-02-20
**Goal**: Make the current `Content Strategist Agent` more flexible, human-like, and context-aware by transitioning from a monolithic omni-agent to a dynamic, context-rich multi-agent system.

## Phase 1: Proactive "Few-Shot" Voice Replication
Shift the agent from being reactive (writing then critiquing) to proactive (matching style from the start).

**Steps:**
1. **Fetch Top Posts**: Modify `getRecentPostsTool` (or create a new `getBestPerformingPostsTool`) to selectively fetch the user's highest-performing or favored posts.
2. **Inject Context**: Update the prompt in `createContentCreatorAgent` to explicitly feed 3-5 of the user's best posts directly into the system prompt as `[EXAMPLES OF MY VOICE]`.
3. **Refine Prompt**: Adjust the generation prompt to instruct the agent to analyze the cadence, sentence length, and formatting of the examples and replicate them in the draft.
4. **Remove Reactive Crutches**: Once proactive generation quality is verified, optionally tone down or remove redundant aspects of `selfCritiqueTool` to save tokens and processing time.

## Phase 2: Dynamic "Preference Memory"
Give the agent episodic memory and preference learning capabilities so it doesn't need to be constantly re-prompted about formatting traits and tone.

**Steps:**
1. **Schema Update**: Add a `UserPreferences` table or a dedicated JSON column to the existing models (e.g., `Settings` or `Tenant`) in `backend/src/db.ts` to store specific stylistic instructions.
2. **Create New Tools**:
   - `save_user_preference`: A tool the agent can use to permanently store a user's instruction (e.g., "User prefers simple analogies over statistics").
   - `get_user_preferences`: A tool to retrieve these saved rules at the start of a session.
3. **Tool Integration**: Add `save_user_preference` to the agent's toolbelt and auto-load preferences into the agent's context window during initialization.

**Implementation Status: Done**

## Phase 3: Deep "Document & URL Analysis" Tools
Upgrade external data fetching from generic snippets (Tavily/OpenRouter) to deep content reading.

**Steps:**
1. **Add Web Scraper Tool**: Implement a new tool (e.g., `read_webpage_content`) utilizing Cheerio, Puppeteer, or a dedicated reading API to fetch the full text of a provided URL instead of just search snippets.
2. **Add Document Reader Tool**: Implement an uploaded document parser (e.g., PDF/Markdown) tool (`read_uploaded_document`) that can extract detailed text from reference files.
3. **Integration**: Configure these tools either via MCP or directly in `mastraAgent.ts`. Update agent instructions to use these tools when a user explicitly references a link or document.

## Phase 4: Shift to a Multi-Agent Workflow (Mastra Workflow)
Break the massive "20-tool omni-agent" into specialized agents orchestrated via a Mastra Workflow to improve reasoning depth and reliability.

**Steps:**
1. **Define Specialized Agents**:
   - `Researcher Agent`: Queries memory, reads URLs, checks recent posts. Outputs a `ContextBrief`.
   - `Strategist Agent`: Analyzes the brief and target audience. Outputs a `ContentOutline`.
   - `Writer Agent`: Takes the outline and "Few-Shot" examples, and generates the `Draft`.
   - `Editor Agent`: Runs the `self-critique`, performs fact-checking, and finalizes the post.
2. **Build Workflow**: Implement a Mastra step-by-step workflow (`Workflow` class) linking these agents sequentially, strictly passing output state variables from one step to the next.
3. **Route Integration**: Update the backend chat route handlers to execute this workflow instead of firing the static monolithic agent loop.
