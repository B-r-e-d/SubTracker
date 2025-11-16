# SubTracker - Subscription Tracker

[SubTracker](https://github.com/B-r-e-d/SubTracker) helps you track and manage recurring subscriptions. Keep an overview of costs, currencies, and billing cycles in a simple interface.

## Getting Started

Prerequisites:
- Node.js 20+

Install and run in development:
```bash
npm install
npm run dev
```

Build and start for production:
```bash
npm run build
npm run start
```

## Configuration

Environment variables (create a `.env` file at the project root if needed):

```bash
# Use browser local storage instead of server-side storage (optional)
USE_LOCAL_STORAGE=true

# Optional: API key used by the built-in assistant feature
GEMINI_API_KEY=your_api_key_here
# Optional overrides:
# GEMINI_CHAT_MODEL=gemini-1.5-pro
# GEMINI_SUGGEST_MODEL=gemini-1.5-flash
```

Notes:
- The start script preloads `.env` via dotenv so server-side variables are available at runtime.

## Docker (optional)

Build and run:
```bash
docker build -t subtracker .
docker run -p 7574:7574 --rm --name subtracker subtracker
```

Then visit http://localhost:7574.

## License

UNLICENSED (until decided).
