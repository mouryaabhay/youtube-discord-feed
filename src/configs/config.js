import "dotenv/config";
import youtubeChannels from "./youtubeChannelsConfig.json" with { type: "json" };

/**
 * Central runtime configuration.
 *
 * DISCORD_WEBHOOK_URL is the only secret (it grants posting access to the
 * Discord channel), so it stays in GitHub Actions Secrets / a local .env
 * file. Every other configurable value lives here so it can be changed in
 * one place without touching GitHub repo settings.
 *
 * Exception: the run schedule. GitHub Actions requires the cron expression
 * to be a literal string in the workflow file, so it's configured in
 * .github/workflows/youtube-notify.yml instead of here.
 */
export default {
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,

  YOUTUBE_FEED: {
    CHANNELS: youtubeChannels.channels,

    // Max characters of the video description shown in the embed.
    DESCRIPTION_LIMIT: 350,

    // Embed sidebar color used when a channel doesn't set its own `color`.
    DEFAULT_EMBED_COLOR: "#ED4245",

    // How long a resolved @handle is cached before being re-scraped.
    HANDLE_CACHE_TTL_MS: 30 * 24 * 60 * 60 * 1000,

    // Retry/backoff settings for transient network failures.
    FEED_FETCH_RETRY: { MAX_RETRIES: 3, INITIAL_DELAY_MS: 1000 },
    HANDLE_FETCH_RETRY: { MAX_RETRIES: 2, INITIAL_DELAY_MS: 1000 },

    // Delays between sends to stay within Discord rate limits.
    THROTTLE_MS: { PER_VIDEO: 300, PER_CHANNEL: 500 },
  },
};
