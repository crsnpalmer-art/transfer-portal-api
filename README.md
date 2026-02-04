# Transfer Portal API

Backend API for the Transfer Portal iOS app. Provides real-time NCAA Football transfer portal data for all 134 FBS teams.

## Data Source

College Football Data API

## Freeze Transfer Snapshot

To keep a post-window snapshot stable, set:

```
FREEZE_TRANSFERS=true
```

When enabled, `/api/transfers` and `/api/transfers/:team` return the bundled snapshot from:
`api/transfers_snapshot_2026-01-16.json`.

Note: Use a fresh commit to trigger Vercel redeploys when configuration changes.

## Built By

**ACP Designs**

---

*This API was vibe coded.*

<!-- deploy trigger -->
