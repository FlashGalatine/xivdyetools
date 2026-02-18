/**
 * Discord Slash Command Registration Script - Moderation Bot
 *
 * This script registers moderation commands with Discord's API.
 * Run with: npm run register-commands
 *
 * Environment variables:
 * - DISCORD_TOKEN: Your moderation bot token
 * - DISCORD_CLIENT_ID: Your moderation application's client ID
 * - DISCORD_GUILD_ID: (Optional) Register to specific guild for faster updates
 *
 * @see https://discord.com/developers/docs/interactions/application-commands
 */

import 'dotenv/config';

// ============================================================================
// Command Definitions
// ============================================================================

/**
 * Discord command option types
 */
const OptionType = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
} as const;

/**
 * Moderation-only commands for this bot
 */
const commands = [
  {
    name: 'preset',
    description: 'Preset moderation commands (moderators only)',
    options: [
      {
        name: 'moderate',
        description: 'Moderation actions for community presets',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'action',
            description: 'Action to perform',
            type: OptionType.STRING,
            required: true,
            choices: [
              { name: '📋 View Pending', value: 'pending' },
              { name: '✅ Approve', value: 'approve' },
              { name: '❌ Reject', value: 'reject' },
              { name: '📊 Statistics', value: 'stats' },
            ],
          },
          {
            name: 'preset_id',
            description: 'Preset to moderate (for approve/reject)',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'reason',
            description: 'Reason for rejection (required for reject)',
            type: OptionType.STRING,
            required: false,
          },
        ],
      },
      {
        name: 'ban_user',
        description: 'Ban a user from Preset Palettes (hides all their presets)',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'user',
            description: 'User to ban (search by username)',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: 'unban_user',
        description: 'Unban a user from Preset Palettes (restores their presets)',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'user',
            description: 'User to unban (search by username)',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
    ],
  },
];

// ============================================================================
// Registration Logic
// ============================================================================

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token) {
    console.error('Error: DISCORD_TOKEN environment variable is not set');
    console.log('\nSet it with:');
    console.log('  $env:DISCORD_TOKEN = "your-moderation-bot-token"  (PowerShell)');
    console.log('  export DISCORD_TOKEN="your-moderation-bot-token"  (Bash)');
    process.exit(1);
  }

  if (!clientId) {
    console.error('Error: DISCORD_CLIENT_ID environment variable is not set');
    console.log('\nSet it with:');
    console.log('  $env:DISCORD_CLIENT_ID = "your-moderation-client-id"  (PowerShell)');
    console.log('  export DISCORD_CLIENT_ID="your-moderation-client-id"  (Bash)');
    process.exit(1);
  }

  // Determine the registration URL
  const url = guildId
    ? `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${clientId}/commands`;

  console.log('\n=== XIV Dye Tools Moderation Bot ===\n');
  console.log(`Registering ${commands.length} command(s)...`);
  console.log(`Target: ${guildId ? `Guild ${guildId}` : 'Global'}`);
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to register commands: ${response.status}`);
      console.error(error);
      process.exit(1);
    }

    const data = await response.json() as Array<{ name: string; id: string }>;
    console.log(`Successfully registered ${data.length} command(s):\n`);

    for (const cmd of data) {
      console.log(`  /${cmd.name} (ID: ${cmd.id})`);
    }

    console.log('\nSubcommands:');
    console.log('  /preset moderate - View pending, approve/reject presets');
    console.log('  /preset ban_user - Ban a user from Preset Palettes');
    console.log('  /preset unban_user - Unban a user');

    if (!guildId) {
      console.log('\nNote: Global commands may take up to 1 hour to appear.');
      console.log('For faster testing, set DISCORD_GUILD_ID to register guild commands.');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
    process.exit(1);
  }
}

// Run the registration
registerCommands();
