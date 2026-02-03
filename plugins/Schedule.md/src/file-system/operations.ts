/**
 * File system operations for schedule data
 */

import { readdir, readFile, writeFile, unlink, mkdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import type { ScheduleBlock, ScheduleConfig, DEFAULT_CONFIG } from "../types";
import { parseBlockMarkdown, extractIdFromFilename, generateFilename } from "../markdown/parser";
import { serializeBlockToMarkdown } from "../markdown/serializer";

const BLOCKS_DIR = "blocks";
const CONFIG_FILE = "config.json";

/**
 * Find the schedule root directory
 */
export async function findScheduleRoot(startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = startDir;

  while (currentDir !== "/") {
    const schedulePath = join(currentDir, "schedule");
    try {
      const stats = await stat(schedulePath);
      if (stats.isDirectory()) {
        const configPath = join(schedulePath, CONFIG_FILE);
        try {
          await stat(configPath);
          return schedulePath;
        } catch {
          // No config file, continue searching
        }
      }
    } catch {
      // Directory doesn't exist, continue
    }
    currentDir = join(currentDir, "..");
  }

  return null;
}

/**
 * Initialize schedule directory structure
 */
export async function initializeScheduleDir(rootDir: string): Promise<void> {
  const scheduleDir = join(rootDir, "schedule");
  const blocksDir = join(scheduleDir, BLOCKS_DIR);

  await mkdir(scheduleDir, { recursive: true });
  await mkdir(blocksDir, { recursive: true });
}

/**
 * Load configuration
 */
export async function loadConfig(scheduleDir: string): Promise<ScheduleConfig> {
  const configPath = join(scheduleDir, CONFIG_FILE);
  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) as ScheduleConfig;
  } catch {
    // Return default config if file doesn't exist
    const { DEFAULT_CONFIG } = await import("../types");
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration
 */
export async function saveConfig(scheduleDir: string, config: ScheduleConfig): Promise<void> {
  const configPath = join(scheduleDir, CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Load all blocks from disk
 */
export async function loadAllBlocks(scheduleDir: string): Promise<ScheduleBlock[]> {
  const blocksDir = join(scheduleDir, BLOCKS_DIR);
  const blocks: ScheduleBlock[] = [];

  try {
    const files = await readdir(blocksDir);

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = join(blocksDir, file);
      try {
        const content = await readFile(filePath, "utf-8");
        const block = parseBlockMarkdown(content, filePath);
        blocks.push(block);
      } catch (err) {
        console.error(`Error parsing block ${file}:`, err);
      }
    }
  } catch (err) {
    // Blocks directory might not exist yet
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  return blocks;
}

/**
 * Load a single block by ID
 */
export async function loadBlockById(scheduleDir: string, blockId: string): Promise<ScheduleBlock | null> {
  const blocksDir = join(scheduleDir, BLOCKS_DIR);

  try {
    const files = await readdir(blocksDir);

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const id = extractIdFromFilename(file);
      if (id === blockId) {
        const filePath = join(blocksDir, file);
        const content = await readFile(filePath, "utf-8");
        return parseBlockMarkdown(content, filePath);
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Save a block to disk
 */
export async function saveBlock(scheduleDir: string, block: ScheduleBlock): Promise<void> {
  const blocksDir = join(scheduleDir, BLOCKS_DIR);
  await mkdir(blocksDir, { recursive: true });

  const filename = generateFilename(block);
  const filePath = join(blocksDir, filename);
  const content = serializeBlockToMarkdown(block);

  await writeFile(filePath, content, "utf-8");
}

/**
 * Delete a block from disk
 */
export async function deleteBlock(scheduleDir: string, blockId: string): Promise<boolean> {
  const blocksDir = join(scheduleDir, BLOCKS_DIR);

  try {
    const files = await readdir(blocksDir);

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const id = extractIdFromFilename(file);
      if (id === blockId) {
        const filePath = join(blocksDir, file);
        await unlink(filePath);
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Find the file path for a block by ID
 */
export async function findBlockFilePath(scheduleDir: string, blockId: string): Promise<string | null> {
  const blocksDir = join(scheduleDir, BLOCKS_DIR);

  try {
    const files = await readdir(blocksDir);

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const id = extractIdFromFilename(file);
      if (id === blockId) {
        return join(blocksDir, file);
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Rename a block file (when title changes)
 */
export async function renameBlockFile(
  scheduleDir: string,
  oldId: string,
  block: ScheduleBlock
): Promise<void> {
  const blocksDir = join(scheduleDir, BLOCKS_DIR);
  const oldPath = await findBlockFilePath(scheduleDir, oldId);

  if (oldPath) {
    const newFilename = generateFilename(block);
    const newPath = join(blocksDir, newFilename);

    if (oldPath !== newPath) {
      // Delete old file and write new one
      await unlink(oldPath);
    }
  }

  await saveBlock(scheduleDir, block);
}
