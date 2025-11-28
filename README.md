# LinkedIn Post Scheduler

A powerful, self-hosted application to schedule and publish posts to LinkedIn and Twitter. Features an Idea Board, AI-powered content improvement, and Markdown support.

## Features
- **Multi-Platform Publishing**: Schedule posts for LinkedIn and Twitter.
- **Idea Board**: Capture thoughts and convert them into full posts using AI.
- **AI Smart Writing**: Improve your content with AI (powered by OpenRouter/Claude).
- **Markdown Support**: Use `**bold**` and `*italic*` syntax, automatically converted to Unicode for LinkedIn.
- **Calendar View**: Visualize your content schedule.
- **Draft Management**: Save drafts and refine them later.

## Prerequisites
- **Docker** and **Docker Compose** (Recommended for easiest setup)
- **Node.js** v18+ (If running locally without Docker)

## Quick Start (Docker)

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd post-scheduler
    ```

2.  **Start the application:**
    ```bash
    docker-compose up --build
    ```
    This will build the frontend and backend images and start the services.
    - **Backend**: Runs on port `5002`
    - **Frontend**: Runs on port `5003`

3.  **Access the Dashboard:**
    Open your browser and navigate to [http://localhost:5003](http://localhost:5003).

4.  **Configure Settings:**
    Go to the **Settings** page in the sidebar to configure your API keys:
    - **LinkedIn**: Client ID, Client Secret, Access Token (Long-lived recommended).
    - **Twitter**: API Key, Secret, Access Token, Secret (OAuth 1.0a or 2.0).
    - **OpenRouter**: API Key (for AI features).

## Manual Setup (Local Development)

If you prefer to run the services locally without Docker:

### Backend
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file (optional, defaults are provided in code):
    ```env
    PORT=5002
    DATABASE_URL="file:./dev.db"
    ```
4.  Start the server:
    ```bash
    npm run dev
    ```

### Frontend
1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    (Ensure it runs on port 5003, or update `package.json` script).

## Database
The application uses **SQLite**.
- **Initialization**: The database schema is automatically created/updated on startup via Sequelize (`sync({ alter: true })`). No manual migrations are needed.
- **Location**:
    - **Docker**: Persisted in a docker volume `backend_data` mounted at `/app/data/dev.db`.
    - **Local**: Stored as `dev.db` in the `backend` directory.
- **Never delete the database** file as it will break the application.
