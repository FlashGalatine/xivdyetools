/**
 * Shared result types for command execute functions.
 *
 * EmbedData is a platform-neutral representation of Discord embed content.
 * The adapter layer maps this to the target platform's embed format.
 *
 * @module commands/types
 */

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Platform-neutral embed data returned by execute functions.
 * Discord adapters map this to Discord APIEmbed; other platforms use their own format.
 */
export interface EmbedData {
  title: string;
  description?: string;
  fields?: EmbedField[];
  color: number;
  footer?: string;
}
