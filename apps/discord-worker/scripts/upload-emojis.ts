/**
 * Discord App Emoji Upload Script
 *
 * Uploads dye emoji images to Discord's Application Emojis feature.
 * Discord allows up to 2,000 emojis per application.
 *
 * Run with: npx tsx scripts/upload-emojis.ts
 *
 * Environment variables:
 * - DISCORD_TOKEN: Your bot token
 * - DISCORD_CLIENT_ID: Your application's client ID
 *
 * @see https://discord.com/developers/docs/resources/emoji
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to emoji files (in the discord-bot project)
const EMOJI_DIR = path.resolve(__dirname, '../../xivdyetools-discord-bot/emoji');

// Path to dye database (in the core project)
const DYE_DATA_PATH = path.resolve(__dirname, '../../xivdyetools-core/src/data/colors_xiv.json');

interface Dye {
  itemID: number | null;
  name: string;
  category: string;
}

interface DiscordEmoji {
  id: string;
  name: string;
}

/**
 * Convert dye name to valid emoji name (alphanumeric + underscore, 2-32 chars)
 */
function dyeNameToEmojiName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')  // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_')          // Collapse multiple underscores
    .replace(/^_|_$/g, '')        // Remove leading/trailing underscores
    .slice(0, 32);                // Max 32 characters
}

/**
 * Read file and convert to base64 data URL
 */
function fileToBase64DataUrl(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(filePath).slice(1);
  const mimeType = ext === 'webp' ? 'image/webp' : `image/${ext}`;
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Get existing emojis from Discord
 */
async function getExistingEmojis(token: string, clientId: string): Promise<Map<string, DiscordEmoji>> {
  const url = `https://discord.com/api/v10/applications/${clientId}/emojis`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bot ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get emojis: ${response.status} - ${error}`);
  }

  const data = await response.json() as { items: DiscordEmoji[] };
  const emojiMap = new Map<string, DiscordEmoji>();

  for (const emoji of data.items || []) {
    emojiMap.set(emoji.name, emoji);
  }

  return emojiMap;
}

/**
 * Upload a single emoji to Discord
 */
async function uploadEmoji(
  token: string,
  clientId: string,
  name: string,
  imageDataUrl: string
): Promise<DiscordEmoji> {
  const url = `https://discord.com/api/v10/applications/${clientId}/emojis`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      image: imageDataUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload emoji "${name}": ${response.status} - ${error}`);
  }

  return response.json() as Promise<DiscordEmoji>;
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token) {
    console.error('Error: DISCORD_TOKEN environment variable is not set');
    process.exit(1);
  }

  if (!clientId) {
    console.error('Error: DISCORD_CLIENT_ID environment variable is not set');
    process.exit(1);
  }

  // Load dye database
  console.log('Loading dye database...');
  const dyeData: Dye[] = JSON.parse(fs.readFileSync(DYE_DATA_PATH, 'utf-8'));

  // Create itemID -> dye name map (skip Facewear dyes with null itemID)
  const dyeMap = new Map<number, string>();
  for (const dye of dyeData) {
    if (dye.itemID !== null && dye.category !== 'Facewear') {
      dyeMap.set(dye.itemID, dye.name);
    }
  }
  console.log(`Loaded ${dyeMap.size} dyes (excluding Facewear)`);

  // Get list of emoji files
  const emojiFiles = fs.readdirSync(EMOJI_DIR)
    .filter(f => f.endsWith('.webp') || f.endsWith('.png'))
    .sort();
  console.log(`Found ${emojiFiles.length} emoji files`);

  // Get existing emojis
  console.log('\nFetching existing emojis from Discord...');
  const existingEmojis = await getExistingEmojis(token, clientId);
  console.log(`Found ${existingEmojis.size} existing emojis`);

  // Process each emoji
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  console.log('\nUploading emojis...\n');

  for (const file of emojiFiles) {
    const itemId = parseInt(path.basename(file, path.extname(file)), 10);
    const dyeName = dyeMap.get(itemId);

    if (!dyeName) {
      console.log(`⚠️  Skipped ${file}: No matching dye found for itemID ${itemId}`);
      skipped++;
      continue;
    }

    const emojiName = dyeNameToEmojiName(dyeName);

    // Check if emoji already exists
    if (existingEmojis.has(emojiName)) {
      console.log(`⏭️  Skipped "${emojiName}" (${dyeName}): Already exists`);
      skipped++;
      continue;
    }

    // Upload emoji
    const filePath = path.join(EMOJI_DIR, file);
    try {
      const imageDataUrl = fileToBase64DataUrl(filePath);
      await uploadEmoji(token, clientId, emojiName, imageDataUrl);
      console.log(`✅ Uploaded "${emojiName}" (${dyeName})`);
      uploaded++;

      // Rate limit: Discord allows 50 requests per second, but be conservative
      await delay(100);
    } catch (error) {
      console.error(`❌ Error uploading "${emojiName}" (${dyeName}): ${error}`);
      errors++;

      // If rate limited, wait longer
      if (error instanceof Error && error.message.includes('429')) {
        console.log('Rate limited, waiting 30 seconds...');
        await delay(30000);
      }
    }
  }

  console.log('\n========================================');
  console.log('Upload complete!');
  console.log(`  ✅ Uploaded: ${uploaded}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log('========================================');

  // Generate emoji mapping file for use in the worker
  console.log('\nGenerating emoji mapping...');

  // Re-fetch to get all emoji IDs
  const finalEmojis = await getExistingEmojis(token, clientId);

  // Create itemID -> emoji format string mapping
  const emojiMapping: Record<number, string> = {};

  for (const [itemId, dyeName] of dyeMap.entries()) {
    const emojiName = dyeNameToEmojiName(dyeName);
    const emoji = finalEmojis.get(emojiName);
    if (emoji) {
      // Discord emoji format: <:name:id>
      emojiMapping[itemId] = `<:${emoji.name}:${emoji.id}>`;
    }
  }

  // Write mapping file
  const mappingPath = path.resolve(__dirname, '../src/data/emoji-mapping.json');
  fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
  fs.writeFileSync(mappingPath, JSON.stringify(emojiMapping, null, 2));
  console.log(`Wrote emoji mapping to ${mappingPath}`);
  console.log(`  Total mapped: ${Object.keys(emojiMapping).length} emojis`);
}

main().catch(console.error);
