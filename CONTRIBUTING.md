# Contributing to youtube-discord-feed

Thanks for considering a contribution. This repository runs a webhook-only
pipeline that watches YouTube channel RSS feeds and posts new uploads to
Discord.

---

## How to Contribute

1. **Fork the repository** and clone your fork locally:

```bash
git clone https://github.com/<your-username>/youtube-discord-feed.git
cd youtube-discord-feed
```

2. **Install dependencies:**

```bash
npm install
```

3. **Create a branch** for your work:

```bash
git checkout -b feature/your-feature-name
```

4. **Make your changes.**

5. **Test your changes locally** (see [README.md § Optional Local Test](README.md#optional-local-test)).
   There's no automated test suite yet — a Discord PR that adds one is
   welcome. Until then, verify manually:
   - `npm start` against a channel with recent uploads and confirm the
     embed + link button post correctly.
   - Re-run it immediately after and confirm nothing is reposted
     (`data/lastSeenVideos.json` should have advanced).

6. **Submit a Pull Request** with a clear description of your changes and
   why they're needed.

---

## Guidelines

- Keep changes webhook-focused; there's no bot/gateway runtime in this
  project, and it's intentionally out of scope.
- Prefer small, well-scoped pull requests over large sweeping ones.
- Never hardcode secrets. Use a local `.env` (gitignored) for testing and
  GitHub Actions Secrets/Variables for the deployed workflow.
- Preserve the existing safety properties:
  - Oldest-first send order per channel.
  - State (`data/lastSeenVideos.json`) is only advanced after a successful
    send, so a failed send doesn't silently skip a video.
  - New channels get a one-time baseline (record latest video, don't post)
    so the back catalog doesn't flood Discord.
- Keep YouTube feed request volume conservative — avoid tightening the
  schedule far below the current 10-hour interval in
  [.github/workflows/youtube-notify.yml](.github/workflows/youtube-notify.yml)
  without good reason. State is compared against the last video actually
  posted (not a time window), so a longer interval just means bigger
  backlogs get caught up in one run — it doesn't cause missed or duplicate
  posts.

---

## Local Environment Setup

```env
DISCORD_WEBHOOK_URL=
```

See [.env.example](.env.example). `DISCORD_WEBHOOK_URL` is the only value
that needs to be a secret; every other configurable value (description
length, embed color, retry/throttle timing, handle cache TTL) lives in
[src/configs/config.js](src/configs/config.js) — edit it directly rather
than adding new env vars or GitHub repo variables.
