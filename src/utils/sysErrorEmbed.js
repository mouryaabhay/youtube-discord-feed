/**
 * Webhook mode error reporter (console only).
 */
export async function sendSysErrorMessage(filePath, customMessage) {
  console.error(`[ERROR] ${filePath}\n${customMessage}`);
}
