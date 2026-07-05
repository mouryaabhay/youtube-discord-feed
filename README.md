# YouTube → Discord Video Notifier

[![YouTube New Video Notifier](https://github.com/mouryaabhay/youtube-discord-feed/actions/workflows/youtube-notify.yml/badge.svg?branch=main)](https://github.com/mouryaabhay/youtube-discord-feed/actions/workflows/youtube-notify.yml?query=branch%3Amain)
![Visitors](https://visitor-badge.laobi.icu/badge?page_id=mouryaabhay.youtube-discord-feed)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

If the workflow badge shows `no status`, trigger it once from the Actions
tab using **Run workflow**.

A GitHub Actions runner (adapted from
[anime-rss](https://github.com/mouryaabhay/anime-rss)) that watches one or
more YouTube channels' RSS feeds and posts new uploads to a Discord channel
through a webhook — as a rich embed (title, description, thumbnail, channel
name, publish time) plus a **"Watch on YouTube" link button**. No YouTube API
key required. Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Features

- Watches any number of YouTube channels via their public RSS feed
  (`https://www.youtube.com/feeds/videos.xml?channel_id=...`).
- Posts an embed with title, description, thumbnail, channel name, and
  publish timestamp — plus a link-style button that opens the video.
- Channel name and embed author are read live from the RSS feed on every
  run, so a channel rename is picked up automatically instead of relying on
  the static config value.
- Embed footer shows the channel's `@handle`, resolved once by reading the
  channel page (the RSS feed doesn't expose it) and cached in
  [data/channelInfo.json](data/channelInfo.json) for 30 days so it isn't
  re-fetched on every run.
- First run per channel only records the current latest video as a baseline
  (doesn't post) so the whole back catalog doesn't flood Discord.
- Persistent per-channel state so repeated runs don't repost the same video,
  and a backlog of missed uploads is sent oldest-first.
- Retries transient feed fetch failures with exponential backoff.

---

## GitHub Actions Setup

1. **Clone the repository:**

```bash
git clone https://github.com/mouryaabhay/youtube-discord-feed.git
cd youtube-discord-feed
```

2. **Install dependencies:**

```bash
npm install
```

3. **Add the channels you want to watch** in
   [src/configs/youtubeChannelsConfig.json](src/configs/youtubeChannelsConfig.json):

```json
{
  "channels": [
    {
      "name": "My Favorite Channel",
      "channelId": "UCxxxxxxxxxxxxxxxxxxxxxx",
      "color": "#ED4245",
      "enabled": true
    }
  ]
}
```

   `color` is the embed sidebar color (hex). The default, `#ED4245`, is
   Discord's own red — it reads well on Discord's dark theme without
   glaring like pure `#FF0000`.

   To find a channel's ID from its `@handle` URL: open the channel page,
   view page source, and search for `"channelId"`. Or use a converter site
   that resolves `@handle` → `UC...` channel ID.

4. **Configure GitHub repo settings** (this is the primary runtime
   configuration path).

   - Go to **Settings → Secrets and variables → Actions**.
   - In **Secrets**, create `DISCORD_WEBHOOK_URL` = your Discord webhook URL.
     This is the only value that needs to live in GitHub settings — every
     other configurable value (description length, embed color, retry/
     throttle timing, handle cache TTL) lives in
     [src/configs/config.js](src/configs/config.js).
   - Go to **Settings → Actions → General** and ensure **Workflow
     permissions** is set to **Read and write permissions** (required to
     commit `data/lastSeenVideos.json` and `data/channelInfo.json`).

5. Go to the **Actions** tab, open **YouTube New Video Notifier**, and click
   **Run workflow** once to establish the baseline for each configured
   channel. The first run only records each channel's current latest video —
   it won't post anything.

6. After that, any newly uploaded video is posted automatically on the next
    scheduled run (every 30 minutes, configurable in
   [.github/workflows/youtube-notify.yml](.github/workflows/youtube-notify.yml)).
   GitHub's scheduled triggers aren't exact — on public repos they can slip
   by up to a couple of hours during high load — but that's harmless here:
   each run compares against the last **video actually posted**, not a
   fixed time window, so if a channel uploads several videos between runs
   (or a run is late), every one of them is still sent, oldest first, on
   the next run. Nothing is skipped and nothing is reposted.

## Showing a channel's logo

The workflow doesn't fetch channel avatars (that requires a request beyond
the free RSS feed). Instead, set it once directly on the Discord webhook:

`Server Settings → Integrations → Webhooks → (this webhook) → upload an
avatar image`

Each message overrides the webhook's *name* per channel; it leaves the
avatar alone, so whatever image you upload there shows on every
notification unless you want per-channel avatars (not supported without an
extra API call per channel).

---

## Optional Local Test

1. Create a `.env` file (see [.env.example](.env.example)):

```env
DISCORD_WEBHOOK_URL=
```

2. Run:

```bash
npm start
```

---

## How it works

- [src/services/youtubeFeedService.js](src/services/youtubeFeedService.js)
  fetches each enabled channel's RSS feed, parses the entries (including the
  YouTube/media namespaces for video ID, thumbnail, and description), and
  compares the newest entries against the last-seen video recorded in
  [data/lastSeenVideos.json](data/lastSeenVideos.json).
- The channel's `@handle` is resolved by reading its channel page once and
  cached in [data/channelInfo.json](data/channelInfo.json)
  ([channelInfoCache.js](src/utils/channelInfoCache.js)), refreshed every 30
  days rather than on every run.
- New videos are sent oldest-first as a Discord embed with a "Watch on
  YouTube" link button, then the state file is updated.
- The workflow commits both state files back to the repo so the next run
  knows what's already been posted and doesn't need to re-resolve the
  handle.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)
for how to get set up, guidelines to follow, and what to test before
opening a PR.

## License

MIT — see [LICENSE](LICENSE).
