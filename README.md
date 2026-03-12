# DraftFlow

A self-hosted, AI-powered social media scheduling platform. Create, refine, and publish posts to LinkedIn and Twitter with AI assistance, trend tracking, and a weekly digest feature.

## Features

- **Multi-Platform Publishing** — Schedule and publish posts to LinkedIn and Twitter/X
- **Idea Board** — Capture ideas and convert them into polished posts with AI
- **AI Writing Assistant** — Generate, improve, and iterate on content using Claude/OpenRouter
- **Trending Topics** — Discover what's trending in your industry with web search (Tavily)
- **Weekly Digest** — Auto-curate the biggest stories of the week into a short-form post
- **Calendar View** — Visualize your content schedule at a glance
- **Recurring Posts** — Set up ideas that auto-generate on a daily, weekly, or monthly schedule
- **Multi-Tenant** — Support for multiple workspaces and team collaboration
- **Markdown Support** — Write in `**bold**` and `*italic*`, auto-converted to Unicode for LinkedIn
- **MCP Integration** — Extend AI capabilities with Model Context Protocol servers

## Architecture

```
frontend/          Next.js (React 19) dashboard
backend/           Express + TypeScript API server
  ├── src/
  │   ├── routes/       API endpoints
  │   ├── services/     Business logic (AI, LinkedIn, Twitter, Scheduler)
  │   ├── middleware/   Auth middleware
  │   └── db.ts         Sequelize models (SQLite)
  └── migrations/       SQL migration files
```

## Quick Start (Docker)

```bash
git clone https://github.com/AppGambitStudio/DraftFlow.git
cd draftflow

# Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_SECRET (required) and other keys

# Start everything
docker-compose up --build
```

- **Frontend**: http://localhost:5003
- **Backend API**: http://localhost:5002

## Local Development

### Prerequisites

- Node.js v18+
- npm

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — JWT_SECRET is required
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on port 5003, backend on port 5002.

### First Run

1. Open http://localhost:5003 and create an account (Sign Up)
2. Go to **Settings** and configure:
   - **OpenRouter API Key** — Required for AI features ([openrouter.ai](https://openrouter.ai))
   - **LinkedIn OAuth** — Client ID & Secret for LinkedIn publishing
   - **Twitter OAuth** — Client ID & Secret for Twitter publishing
   - **Tavily API Key** — Optional, for web search / trending topics ([tavily.com](https://tavily.com))

### OAuth Callback URLs

When setting up OAuth apps on LinkedIn/Twitter developer portals:

- **LinkedIn**: `http://localhost:5002/api/auth/linkedin/callback`
- **Twitter**: `http://localhost:5002/api/auth/twitter/callback`

## Database

DraftFlow uses **SQLite** via Sequelize ORM.

- New tables are auto-created on startup via `sequelize.sync()`
- Schema changes to existing tables require manual migrations

### Running Migrations

Migrations are SQL files in `backend/migrations/`. Apply them with:

```bash
cd backend
sqlite3 dev.db < migrations/YYYYMMDD_HHMMSS_description.sql
```

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for all available variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret key for JWT token signing |
| `DATABASE_URL` | No | SQLite path (default: `file:./dev.db`) |
| `PORT` | No | Backend port (default: `5002`) |
| `FRONTEND_URL` | No | Frontend URL for invite links (default: `http://localhost:3000`) |
| `LINKEDIN_CLIENT_ID` | No | LinkedIn OAuth (can also set in Settings UI) |
| `LINKEDIN_CLIENT_SECRET` | No | LinkedIn OAuth secret |
| `TWITTER_CLIENT_ID` | No | Twitter OAuth (can also set in Settings UI) |
| `TWITTER_CLIENT_SECRET` | No | Twitter OAuth secret |

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, Recharts
- **Backend**: Express 5, TypeScript, Sequelize, SQLite
- **AI**: OpenRouter API (Claude, GPT, etc.), Tavily web search
- **Agent Framework**: Mastra.io with MCP support

## License

[ISC](LICENSE)
