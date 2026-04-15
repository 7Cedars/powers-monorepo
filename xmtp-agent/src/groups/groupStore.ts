// Persistent JSON store for groupName → conversationId mapping
// This avoids relying on XMTP sync/list to find groups by name

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { config } from '../config/env.js';

interface GroupMapping {
  [groupName: string]: string; // groupName → conversationId
}

const STORE_FILENAME = 'group-mappings.json';

function getStorePath(): string {
  const dbDir = config.xmtp.dbDirectory || './data';
  return join(dbDir, STORE_FILENAME);
}

function loadMappings(): GroupMapping {
  const storePath = getStorePath();
  try {
    if (existsSync(storePath)) {
      const data = readFileSync(storePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[groupStore] Failed to load group mappings:', err);
  }
  return {};
}

function saveMappings(mappings: GroupMapping): void {
  const storePath = getStorePath();
  try {
    const dir = dirname(storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(storePath, JSON.stringify(mappings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[groupStore] Failed to save group mappings:', err);
  }
}

/**
 * Saves a groupName → conversationId mapping
 */
export function saveGroupMapping(groupName: string, conversationId: string): void {
  const mappings = loadMappings();
  mappings[groupName] = conversationId;
  saveMappings(mappings);
  console.log(`[groupStore] Saved mapping: ${groupName} → ${conversationId}`);
}

/**
 * Gets the conversationId for a given groupName
 * Returns null if not found
 */
export function getGroupConversationId(groupName: string): string | null {
  const mappings = loadMappings();
  return mappings[groupName] || null;
}

/**
 * Removes a group mapping
 */
export function removeGroupMapping(groupName: string): void {
  const mappings = loadMappings();
  delete mappings[groupName];
  saveMappings(mappings);
  console.log(`[groupStore] Removed mapping for: ${groupName}`);
}

/**
 * Gets all stored group mappings
 */
export function getAllGroupMappings(): GroupMapping {
  return loadMappings();
}