import Parser from "rss-parser";
import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import config from "../configs/config.js";
import { loadLastSeen, saveLastSeen } from "../utils/videoTimestampsLogger.js";
import { loadChannelInfo, saveChannelInfo } from "../utils/channelInfoCache.js";
import { sendSysErrorMessage } from "../utils/sysErrorEmbed.js";
import { fileURLToPath } from "url";

const { YOUTUBE_FEED } = config;
const __filename = fileURLToPath(import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANONICAL_HANDLE_REGEX = /"canonicalBaseUrl":"\/(@[^"]+)"/;

function parseItemDate(item) {
  const rawDate = item.isoDate || item.pubDate;
  if (!rawDate) return null;

  const parsedDate = new Date(rawDate);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

/**
 * Retries transient operations (network/API) with exponential backoff.
 */
const retryWithBackoff = async (fn, maxRetries = 3, initialDelayMs = 1000) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.warn(`[WARN] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }
};

function feedUrl(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

class youtubeFeedService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ["yt:videoId", "videoId"],
          ["media:group", "mediaGroup"],
        ],
      },
    });
    this.lastSeen = new Map();
    this.lastSeenReady = this.initLastSeen();
    this.channelInfo = new Map();
    this.channelInfoReady = this.initChannelInfo();
  }

  async initLastSeen() {
    this.lastSeen = await loadLastSeen();
  }

  async initChannelInfo() {
    this.channelInfo = await loadChannelInfo();
  }

  /**
   * Resolves a channel's @handle, scraping the channel page only when the cached
   * value is missing or stale (see HANDLE_CACHE_TTL_MS).
   */
  async getChannelHandle(channelId) {
    const cached = this.channelInfo.get(channelId);
    if (cached && Date.now() - cached.fetchedAt < YOUTUBE_FEED.HANDLE_CACHE_TTL_MS) {
      return cached.handle;
    }

    try {
      const { MAX_RETRIES, INITIAL_DELAY_MS } = YOUTUBE_FEED.HANDLE_FETCH_RETRY;
      const response = await retryWithBackoff(
        () => fetch(`https://www.youtube.com/channel/${channelId}`),
        MAX_RETRIES,
        INITIAL_DELAY_MS
      );
      const html = await response.text();
      const match = html.match(CANONICAL_HANDLE_REGEX);
      const handle = match ? match[1] : null;

      this.channelInfo.set(channelId, { handle, fetchedAt: Date.now() });
      await saveChannelInfo(this.channelInfo);
      return handle;
    } catch (error) {
      console.warn(`[WARN] Failed to resolve @handle for channel ${channelId}:`, error);
      return cached?.handle ?? null;
    }
  }

  async fetchAndProcessChannels(webhookClient, channels) {
    await this.lastSeenReady;
    await this.channelInfoReady;

    if (!channels || channels.length === 0) {
      console.warn("[WARN] No YouTube channels configured");
      return;
    }

    const enabledChannels = channels.filter((channel) => channel.enabled);

    for (const { name, channelId, color } of enabledChannels) {
      if (!channelId) continue;

      try {
        const { MAX_RETRIES, INITIAL_DELAY_MS } = YOUTUBE_FEED.FEED_FETCH_RETRY;
        const feed = await retryWithBackoff(
          () => this.parser.parseURL(feedUrl(channelId)),
          MAX_RETRIES,
          INITIAL_DELAY_MS
        );

        // Prefer the feed's live channel title over the static config name, so a
        // channel rename is picked up automatically instead of going stale.
        const channelName = feed.title || name;

        const sortedItems = this.sortItemsByPubDateAsc(feed.items);
        if (sortedItems.length === 0) {
          console.log(`[INFO] No videos found for ${channelName}.`);
          continue;
        }

        const previous = this.lastSeen.get(channelId);

        if (!previous) {
          // First time seeing this channel: record the current latest video without
          // posting, so the whole back catalog doesn't flood Discord.
          const newest = sortedItems[sortedItems.length - 1];
          this.lastSeen.set(channelId, this.buildState(newest));
          await saveLastSeen(this.lastSeen);
          console.info(`[INFO] Recorded baseline video for ${channelName}: ${newest.videoId}`);
          continue;
        }

        // Strictly-newer-than-last-sent, and never the exact video already recorded —
        // guards against duplicate sends even if two entries share a publish timestamp.
        const previousPublishedAt = new Date(previous.publishedAt);
        const newItems = sortedItems.filter((item) => {
          if (item.videoId === previous.videoId) return false;

          const itemDate = parseItemDate(item);
          if (!itemDate) return true;

          return itemDate > previousPublishedAt;
        });

        if (newItems.length === 0) {
          console.log(`[INFO] No new videos for ${channelName}.`);
        } else {
          console.info(`[INFO] ${newItems.length} new video(s) found for ${channelName}, sending oldest-first.`);
        }

        const handle = await this.getChannelHandle(channelId);

        for (const item of newItems) {
          const wasSent = await this.processAndSendVideo(
            webhookClient,
            item,
            { channelName, handle, color }
          );
          if (wasSent) {
            // Persist immediately after each send (not batched at the end) so a crash
            // partway through a backlog can't cause the already-sent videos to be
            // reposted on the next run.
            this.lastSeen.set(channelId, this.buildState(item));
            await saveLastSeen(this.lastSeen);
          }
          // Throttle Discord sends to respect rate limits
          await sleep(YOUTUBE_FEED.THROTTLE_MS.PER_VIDEO);
        }
      } catch (error) {
        this.logFetchError(name, channelId, error);
      }

      // Throttle between channels (rate limit safety)
      await sleep(YOUTUBE_FEED.THROTTLE_MS.PER_CHANNEL);
    }
  }

  buildState(item) {
    return {
      videoId: item.videoId,
      publishedAt: parseItemDate(item)?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * Oldest first, so if a later send fails the state progression stops at a safe point.
   */
  sortItemsByPubDateAsc(items) {
    return [...items].sort(
      (a, b) => {
        const firstDate = parseItemDate(a) ?? new Date(0);
        const secondDate = parseItemDate(b) ?? new Date(0);
        return firstDate - secondDate;
      }
    );
  }

  getThumbnail(item) {
    const thumb = item.mediaGroup?.["media:thumbnail"]?.[0]?.$?.url;
    return thumb || null;
  }

  getDescription(item) {
    const raw = item.mediaGroup?.["media:description"]?.[0];
    const description = typeof raw === "string" ? raw.trim() : "";
    if (!description) return ">>> No description available.";
    if (description.length > YOUTUBE_FEED.DESCRIPTION_LIMIT) {
      return ">>> " + description.slice(0, YOUTUBE_FEED.DESCRIPTION_LIMIT - 1).trimEnd() + "…";
    }
    return ">>> " + description;
  }

  async processAndSendVideo(webhookClient, item, { channelName, handle, color }) {
    try {
      const embed = new EmbedBuilder()
        .setColor(color || YOUTUBE_FEED.DEFAULT_EMBED_COLOR)
        .setTitle(item.title)
        .setURL(item.link)
        .setDescription(this.getDescription(item))
        .setTimestamp(new Date(item.isoDate || item.pubDate));

      if (handle) {
        embed.setFooter({ text: handle });
      }

      const thumbnail = this.getThumbnail(item);
      if (thumbnail) {
        embed.setImage(thumbnail);
      }

      // Button linking to the video
      const button = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Watch on YouTube")
        .setURL(item.link);

      const actionRow = new ActionRowBuilder().addComponents(button);

      await webhookClient.send({
        username: channelName,
        embeds: [embed],
        components: [actionRow],
        // Required for non-application webhooks to keep non-interactive components (link buttons).
        withComponents: true,
      });

      console.info(`[INFO] New video sent for ${channelName}: ${item.title}`);
      return true;
    } catch (error) {
      console.error(`[ERROR] Failed to process video: ${item.link}`, error);
      sendSysErrorMessage(__filename, `- Failed to process video: ${item.link}`);
      return false;
    }
  }

  logFetchError(channelName, channelId, error) {
    console.error(
      `[ERROR] Failed to fetch YouTube feed:\n Channel: ${channelName} (${channelId})\n`,
      error
    );
    sendSysErrorMessage(
      __filename,
      `There was an error fetching the YouTube feed:\n- Channel: ${channelName}\n- Channel ID: ${channelId}\n`
    );
  }
}

export default new youtubeFeedService();
