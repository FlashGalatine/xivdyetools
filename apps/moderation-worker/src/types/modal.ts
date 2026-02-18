/**
 * Shared Modal Types and Helpers
 *
 * MOD-REF-002 FIX: Extracted from preset-rejection.ts and ban-reason.ts
 * to eliminate code duplication.
 *
 * @module types/modal
 */

/**
 * Discord modal interaction structure
 */
export interface ModalInteraction {
  id: string;
  token: string;
  application_id: string;
  channel_id?: string;
  message?: {
    id: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: { text?: string };
      timestamp?: string;
    }>;
  };
  member?: {
    user: {
      id: string;
      username: string;
    };
  };
  user?: {
    id: string;
    username: string;
  };
  data?: {
    custom_id?: string;
    components?: ModalComponents;
  };
}

/**
 * Modal component structure (action rows containing text inputs)
 */
export type ModalComponents = Array<{
  type: number;
  components: Array<{
    type: number;
    custom_id: string;
    value: string;
  }>;
}>;

/**
 * Extract the value from a text input component by its custom_id
 *
 * @param components - The modal components array
 * @param customId - The custom_id of the text input to find
 * @returns The text input value, or undefined if not found
 */
export function extractTextInputValue(
  components: ModalComponents | undefined,
  customId: string
): string | undefined {
  if (!components) return undefined;

  for (const actionRow of components) {
    // Action row type is 1
    if (actionRow.type !== 1) continue;

    for (const component of actionRow.components) {
      // Text input type is 4
      if (component.type === 4 && component.custom_id === customId) {
        return component.value;
      }
    }
  }

  return undefined;
}

/**
 * Get the user ID from a modal interaction
 *
 * @param interaction - The modal interaction
 * @returns The user ID, or undefined if not found
 */
export function getModalUserId(interaction: ModalInteraction): string | undefined {
  return interaction.member?.user?.id ?? interaction.user?.id;
}

/**
 * Get the username from a modal interaction
 *
 * @param interaction - The modal interaction
 * @param defaultName - Default name if not found
 * @returns The username or the default name
 */
export function getModalUsername(
  interaction: ModalInteraction,
  defaultName: string = 'Moderator'
): string {
  return interaction.member?.user?.username ?? interaction.user?.username ?? defaultName;
}
