import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import type { Address } from 'viem';

export interface RegisteredPowers {
  address: Address;
  chainId: number;
}

const REGISTRY_FILE = path.join(config.xmtp.dbDirectory, 'powers-registry.json');

export function getRegistry(): RegisteredPowers[] {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = fs.readFileSync(REGISTRY_FILE, 'utf8');
      return JSON.parse(data) as RegisteredPowers[];
    }
  } catch (error) {
    console.error('Error reading powers registry:', error);
  }
  return [];
}

function saveRegistry(registry: RegisteredPowers[]) {
  try {
    // Ensure directory exists
    if (!fs.existsSync(config.xmtp.dbDirectory)) {
      fs.mkdirSync(config.xmtp.dbDirectory, { recursive: true });
    }
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  } catch (error) {
    console.error('Error saving powers registry:', error);
  }
}

export function registerPowers(address: Address, chainId: number): boolean {
  const registry = getRegistry();
  const exists = registry.some(
    r => r.address.toLowerCase() === address.toLowerCase() && r.chainId === chainId
  );
  
  if (!exists) {
    registry.push({ address, chainId });
    saveRegistry(registry);
    return true;
  }
  return false;
}

export function deregisterPowers(address: Address, chainId: number): boolean {
  const registry = getRegistry();
  const initialLength = registry.length;
  
  const updated = registry.filter(
    r => !(r.address.toLowerCase() === address.toLowerCase() && r.chainId === chainId)
  );
  
  if (updated.length < initialLength) {
    saveRegistry(updated);
    return true;
  }
  return false;
}
