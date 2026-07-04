import path from "path";
import { promises as fsPromises } from "fs";
import { sendSysErrorMessage } from "./sysErrorEmbed.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the path to the JSON file that caches per-channel info (currently just the @handle)
const CHANNEL_INFO_FILE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "channelInfo.json"
);

/**
 * Loads cached per-channel info from disk.
 */
export async function loadChannelInfo() {
  try {
    const rawData = await fsPromises.readFile(CHANNEL_INFO_FILE_PATH, "utf-8");
    return new Map(Object.entries(JSON.parse(rawData)));
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Map();
    }
    console.error(
      `[ERROR]  Error loading channel info from file: ${CHANNEL_INFO_FILE_PATH}\n`,
      error
    );
    sendSysErrorMessage(
      __filename,
      `- Error loading channel info from file: ${CHANNEL_INFO_FILE_PATH}`
    );
    return new Map();
  }
}

/**
 * Persists updated per-channel info cache to disk.
 */
export async function saveChannelInfo(channelInfo) {
  try {
    await fsPromises.mkdir(path.dirname(CHANNEL_INFO_FILE_PATH), { recursive: true });
    await fsPromises.writeFile(
      CHANNEL_INFO_FILE_PATH,
      JSON.stringify(Object.fromEntries(channelInfo), null, 2) + "\n"
    );
    console.info(
      `[INFO]   Updated channel info written to file: "${CHANNEL_INFO_FILE_PATH}"`
    );
  } catch (error) {
    console.error(
      `[ERROR]  Error updating channel info to file: ${CHANNEL_INFO_FILE_PATH}`,
      error
    );
    sendSysErrorMessage(
      __filename,
      `- Error updating channel info to file: ${CHANNEL_INFO_FILE_PATH}`
    );
  }
}
