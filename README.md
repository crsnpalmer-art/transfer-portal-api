# 🏈 Transfer Portal API

Backend API server for the Transfer Portal iOS app. Fetches data from CollegeFootballData.com and serves it to mobile clients.

## Features

- ✅ Fetches real transfer portal data from CFBD
- ✅ 5-minute caching to reduce API calls
- ✅ Data transformation to match iOS app format
- ✅ Team name normalization (handles aliases)
- ✅ CORS enabled for mobile apps
- ✅ Ready for Vercel deployment

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info and available endpoints |
| `/api/transfers` | GET | All transfer data organized by team |
| `/api/transfers/:team` | GET | Transfer data for a specific team |
| `/api/teams` | GET | List all 132 FBS teams |
| `/api/health` | GET | Health check with cache status |
| `/api/refresh` | POST | Force cache refresh |

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/transfer-portal-api.git
cd transfer-portal-api
npm install
```

### 2. Set Environment Variable

Create a `.env` file or set the environment variable:

```bash
CFBD_API_KEY=your_api_key_here
```

### 3. Run Locally

```bash
npm run dev
```

Server will start at http://localhost:3001

## Deploy to Vercel

### Option A: Via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

When prompted, set the `CFBD_API_KEY` environment variable.

### Option B: Via GitHub

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repo
5. Add Environment Variable: `CFBD_API_KEY` = your key
6. Click Deploy

## iOS App Configuration

Update your iOS app's `TransferDataManager.swift`:

```swift
// Change this line:
private let apiBaseURL = "http://localhost:3001"

// To your Vercel URL:
private let apiBaseURL = "https://your-app-name.vercel.app"
```

## API Response Format

### GET /api/transfers

```json
{
  "teams": {
    "Alabama": {
      "playersOut": [
        {
          "name": "Player Name",
          "position": "QB",
          "rating": 85,
          "stars": 4,
          "year": "Jr",
          "status": "Entered",
          "destination": "Texas"
        }
      ],
      "playersIn": [
        {
          "name": "Another Player",
          "position": "WR",
          "rating": 90,
          "stars": 5,
          "year": "So",
          "status": "Committed",
          "from": "Auburn"
        }
      ]
    }
  },
  "totalPlayers": 1500,
  "totalMovement": 3000,
  "lastUpdated": "2025-01-05T12:00:00Z",
  "season": 2025
}
```

## License

MIT
