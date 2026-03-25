/**
 * Helper functions for serializing and deserializing data with BigInt values to/from localStorage
 * 
 * JavaScript's JSON.stringify() cannot serialize BigInt values, so we need to convert them
 * to strings before storing and convert them back when loading.
 */

/**
 * Recursively converts all BigInt values in an object to strings
 * Handles nested objects and arrays
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle BigInt primitives
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => serializeBigInt(item));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeBigInt(obj[key]);
      }
    }
    return serialized;
  }
  
  // Return primitive values as-is
  return obj;
}

/**
 * Recursively converts string representations of BigInt back to BigInt
 * Handles nested objects and arrays
 * 
 * Known BigInt fields in the Powers type:
 * - chainId, foundedAt, mandateCount (Powers)
 * - index (Mandate)
 * - allowedRole, timelock, needNotFulfilled, needFulfilled, quorum, succeedAt, throttleExecution, votingPeriod (Conditions)
 * - roleId, amountHolders (Role)
 * - since (Member)
 * - mandateId, proposedAt, requestedAt, fulfilledAt, cancelledAt, voteStart, voteDuration, voteEnd, againstVotes, forVotes, abstainVotes (Action)
 * - And many more nested fields
 */
function deserializeBigInt(obj: any, currentPath: string[] = []): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item, index) => deserializeBigInt(item, [...currentPath, `[${index}]`]));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const deserialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        // Check if this key is a known BigInt field and the value is a string that looks like a number
        if (isBigIntField(key, currentPath) && typeof value === 'string' && /^\d+$/.test(value)) {
          try {
            deserialized[key] = BigInt(value);
          } catch {
            // If conversion fails, keep as string
            deserialized[key] = value;
          }
        } else {
          deserialized[key] = deserializeBigInt(value, [...currentPath, key]);
        }
      }
    }
    return deserialized;
  }
  
  // Return primitive values as-is
  return obj;
}

/**
 * Determines if a field at a given path should be treated as a BigInt
 * This helps identify which string values should be converted back to BigInt
 */
function isBigIntField(key: string, path: string[]): boolean {
  // Top-level Powers fields
  const topLevelBigIntFields = ['chainId', 'foundedAt', 'mandateCount'];
  if (path.length === 0 && topLevelBigIntFields.includes(key)) {
    return true;
  }
  
  // Mandate fields
  const mandateFields = ['index'];
  if (path.includes('mandates') && mandateFields.includes(key)) {
    return true;
  }
  
  // Conditions fields
  const conditionFields = [
    'allowedRole', 'timelock', 'needNotFulfilled', 'needFulfilled',
    'quorum', 'succeedAt', 'throttleExecution', 'votingPeriod'
  ];
  if (path.includes('conditions') && conditionFields.includes(key)) {
    return true;
  }
  
  // Role fields
  const roleFields = ['roleId', 'amountHolders'];
  if (path.includes('roles') && roleFields.includes(key)) {
    return true;
  }
  
  // Member fields
  const memberFields = ['since'];
  if (path.includes('members') && memberFields.includes(key)) {
    return true;
  }
  
  // Action fields
  const actionFields = [
    'mandateId', 'proposedAt', 'requestedAt', 'fulfilledAt', 'cancelledAt',
    'voteStart', 'voteDuration', 'voteEnd', 'againstVotes', 'forVotes', 'abstainVotes'
  ];
  if (path.includes('actions') && actionFields.includes(key)) {
    return true;
  }
  
  // Token fields
  const tokenFields = ['balance', 'decimals'];
  if (tokenFields.includes(key)) {
    return true;
  }
  
  // BlockRange fields
  const blockRangeFields = ['from', 'to'];
  if (blockRangeFields.includes(key)) {
    return true;
  }
  
  return false;
}

/**
 * Serializes data with BigInt values to a JSON string safe for localStorage
 */
export function stringifyWithBigInt(data: any): string {
  return JSON.stringify(serializeBigInt(data));
}

/**
 * Deserializes a JSON string from localStorage back to data with BigInt values
 */
export function parseWithBigInt<T>(jsonString: string): T {
  const parsed = JSON.parse(jsonString);
  return deserializeBigInt(parsed) as T;
}