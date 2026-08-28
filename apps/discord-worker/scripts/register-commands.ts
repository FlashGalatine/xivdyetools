/**
 * Discord Slash Command Registration Script
 *
 * This script registers (or updates) slash commands with Discord's API.
 * Run with: npm run register-commands
 *
 * You need to set these environment variables:
 * - DISCORD_TOKEN: Your bot token
 * - DISCORD_CLIENT_ID: Your application's client ID
 *
 * For development, you can also set:
 * - DISCORD_GUILD_ID: Register commands to a specific guild (faster updates)
 *
 * @see https://discord.com/developers/docs/interactions/application-commands
 */

import 'dotenv/config';

// ============================================================================
// Command Definitions
// ============================================================================

import { commands } from '../src/commands/schemas.js';
import { COMMAND_REGISTRY } from '../src/commands/registry.js';
import { localizeCommands, countLocalizations, LOCALE_CODES } from '../src/commands/localize.js';
import { initializeLocale } from '@xivdyetools/bot-logic';

// Roster parity: the registry is the roster of record — refuse to publish a
// schema set that drifts from it (the /about pill index builds from it too).
const schemaNames = commands.map((c) => c.name).sort();
const registryNames = COMMAND_REGISTRY.map((c) => c.name).sort();
if (JSON.stringify(schemaNames) !== JSON.stringify(registryNames)) {
  console.error(`Command roster drift.
  schemas:  ${schemaNames.join(", ")}
  registry: ${registryNames.join(", ")}`);
  process.exit(1);
}

// ============================================================================
// Registration Logic
// ============================================================================

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID; // Optional: for guild-specific commands

  if (!token) {
    console.error('Error: DISCORD_TOKEN environment variable is not set');
    console.log('\nSet it with:');
    console.log('  $env:DISCORD_TOKEN = "your-bot-token"  (PowerShell)');
    console.log('  export DISCORD_TOKEN="your-bot-token"  (Bash)');
    process.exit(1);
  }

  if (!clientId) {
    console.error('Error: DISCORD_CLIENT_ID environment variable is not set');
    console.log('\nSet it with:');
    console.log('  $env:DISCORD_CLIENT_ID = "your-client-id"  (PowerShell)');
    console.log('  export DISCORD_CLIENT_ID="your-client-id"  (Bash)');
    process.exit(1);
  }

  // Determine the registration URL
  // Guild commands update instantly, global commands take up to 1 hour
  const url = guildId
    ? `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${clientId}/commands`;

  // F-03 (2026-08-20 i18n audit): attach description_localizations /
  // name_localizations from the bot-logic locale files before publishing.
  await Promise.all(LOCALE_CODES.map((locale) => initializeLocale(locale)));
  const payload = localizeCommands(commands);
  const localized = countLocalizations(payload);

  console.log(`\nRegistering ${commands.length} commands...`);
  console.log(`Target: ${guildId ? `Guild ${guildId}` : 'Global'}`);
  console.log(`Localized fields: ${localized.descriptions} descriptions, ${localized.choiceNames} choice names`);
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to register commands: ${response.status}`);
      console.error(error);
      process.exit(1);
    }

    const data = await response.json() as Array<{ name: string; id: string }>;
    console.log(`Successfully registered ${data.length} commands:\n`);

    for (const cmd of data) {
      console.log(`  /${cmd.name} (ID: ${cmd.id})`);
    }

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
