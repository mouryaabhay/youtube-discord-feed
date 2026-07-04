import "dotenv/config";
import youtubeChannels from "./youtubeChannelsConfig.json" with { type: "json" };

/**
 * Central runtime configuration for webhook mode.
 * Values are loaded from environment variables (GitHub Actions Variables/Secrets or local .env).
 */
export default {
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  YOUTUBE_FEED: {
    DESCRIPTION_LIMIT: parseInt(process.env.YT_DESCRIPTION_LIMIT, 10) || 350,
    CHANNELS: youtubeChannels.channels,
  },
};
