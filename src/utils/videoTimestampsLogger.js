import path from "path";
import { promises as fsPromises } from "fs";
import { sendSysErrorMessage } from "./sysErrorEmbed.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the path to the JSON file that stores per-channel last-seen video state
const VIDEO_TIMESTAMPS_FILE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "lastSeenVideos.json"
);

/**
 * Loads per-channel last-seen video state from disk.
 */
export async function loadLastSeen() {
  try {
    const rawData = await fsPromises.readFile(VIDEO_TIMESTAMPS_FILE_PATH, "utf-8");
    return new Map(Object.entries(JSON.parse(rawData)));
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Map();
    }
    console.error(
      `[ERROR]  Error loading video state from file: ${VIDEO_TIMESTAMPS_FILE_PATH}\n`,
      error
    );
    sendSysErrorMessage(
      __filename,
      `- Error loading video state from file: ${VIDEO_TIMESTAMPS_FILE_PATH}`
    );
    return new Map();
  }
}

/**
 * Persists updated per-channel last-seen video state to disk.
 */
export async function saveLastSeen(lastSeen) {
  try {
    await fsPromises.mkdir(path.dirname(VIDEO_TIMESTAMPS_FILE_PATH), { recursive: true });
    await fsPromises.writeFile(
      VIDEO_TIMESTAMPS_FILE_PATH,
      JSON.stringify(Object.fromEntries(lastSeen), null, 2) + "\n"
    );
    console.info(
      `[INFO]   Updated video state written to file: "${VIDEO_TIMESTAMPS_FILE_PATH}"`
    );
  } catch (error) {
    console.error(
      `[ERROR]  Error updating video state to file: ${VIDEO_TIMESTAMPS_FILE_PATH}`,
      error
    );
    sendSysErrorMessage(
      __filename,
      `- Error updating video state to file: ${VIDEO_TIMESTAMPS_FILE_PATH}`
    );
  }
}
