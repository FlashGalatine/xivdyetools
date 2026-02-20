/**
 * Loading indicator utility using the ⏳ react/unreact pattern.
 *
 * For image-generating commands that take 1-5 seconds, this provides
 * visual feedback by reacting with ⏳ on the user's message,
 * then removing it when processing completes.
 */

const LOADING_EMOJI = encodeURIComponent('⏳');

/** Minimal message interface for react/unreact */
interface ReactableMessage {
  react: (emoji: string) => Promise<void>;
  unreact: (emoji: string) => Promise<void>;
}

/**
 * Execute a function with a ⏳ loading indicator on the source message.
 * The ⏳ reaction is removed after the function completes (success or failure).
 *
 * @param message - The user's message to react on
 * @param fn - The async function to execute
 * @returns The result of the function
 */
export async function withLoadingIndicator<T>(
  message: ReactableMessage,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    await message.react(LOADING_EMOJI);
  } catch {
    // Non-critical — continue even if react fails
  }

  try {
    return await fn();
  } finally {
    try {
      await message.unreact(LOADING_EMOJI);
    } catch {
      // Non-critical — best effort unreact
    }
  }
}
