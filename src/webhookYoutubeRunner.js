import "dotenv/config";
import { WebhookClient } from "discord.js";
import config from "./configs/config.js";
import youtubeFeedService from "./services/youtubeFeedService.js";

const { CHANNELS } = config.YOUTUBE_FEED;
const webhookUrl = config.DISCORD_WEBHOOK_URL;

/**
 * One-shot webhook runner used by GitHub Actions schedule and workflow_dispatch.
 */
async function run() {
  if (!webhookUrl) {
    console.error("[ERROR] DISCORD_WEBHOOK_URL is not set.");
    process.exit(1);
  }

  const webhookClient = new WebhookClient({ url: webhookUrl });

  try {
    await youtubeFeedService.fetchAndProcessChannels(webhookClient, CHANNELS);
    console.info("[INFO] YouTube webhook run completed.");
  } catch (error) {
    console.error("[ERROR] YouTube webhook run failed:", error);
    process.exitCode = 1;
  } finally {
    webhookClient.destroy();
  }
}

await run();
