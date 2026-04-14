// Flow identification logic - replicates frontend/utils/identifyFlows.ts

import type { Mandate } from '../utils/types.js';

/**
 * Identifies mandate flows by analyzing condition dependencies.
 * 
 * A "flow" is a group of mandates that are linked together through
 * conditions.needFulfilled and conditions.needNotFulfilled requirements.
 */
export function identifyFlows(mandates: Mandate[], mandateId?: bigint): bigint[][] {
  if (!mandates || mandates.length === 0) {
    return [];
  }

  // Filter to only active mandates (matching frontend logic)
  const activeMandates = mandates.filter(mandate => mandate.active);
  
  if (activeMandates.length === 0) {
    return [];
  }

  // Build dependency maps
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  
  // Initialize maps for all mandates
  activeMandates.forEach(mandate => {
    const id = String(mandate.index);
    dependencies.set(id, new Set());
    dependents.set(id, new Set());
  });
  
  // Populate dependency relationships
  activeMandates.forEach(mandate => {
    const id = String(mandate.index);
    if (mandate.conditions) {
      // Handle needFulfilled dependency
      if (mandate.conditions.needFulfilled != null && mandate.conditions.needFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needFulfilled);
        if (dependencies.has(targetId)) {
          dependencies.get(id)?.add(targetId);
          dependents.get(targetId)?.add(id);
        }
      }
      
      // Handle needNotFulfilled dependency
      if (mandate.conditions.needNotFulfilled != null && mandate.conditions.needNotFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needNotFulfilled);
        if (dependencies.has(targetId)) {
          dependencies.get(id)?.add(targetId);
          dependents.get(targetId)?.add(id);
        }
      }
    }
  });

  // Find connected components using traversal
  const visited = new Set<string>();
  const flows: bigint[][] = [];

  // Recursive traversal function to find all nodes in a connected component
  function traverse(nodeId: string, component: Set<string>) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    component.add(nodeId);
    
    // Traverse all dependencies
    const deps = dependencies.get(nodeId) || new Set();
    deps.forEach(depId => traverse(depId, component));
    
    // Traverse all dependents
    const dependentNodes = dependents.get(nodeId) || new Set();
    dependentNodes.forEach(depId => traverse(depId, component));
  }

  // Find all connected components
  activeMandates.forEach(mandate => {
    const id = String(mandate.index);
    if (!visited.has(id)) {
      const component = new Set<string>();
      traverse(id, component);
      
      if (component.size > 0) {
        // Convert strings back to bigints and sort
        const flow = Array.from(component)
          .map(id => BigInt(id))
          .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
        flows.push(flow);
      }
    }
  });

  // If mandateId is provided, filter to only return the flow containing that mandate
  if (mandateId !== undefined) {
    const targetFlow = flows.find(flow => flow.includes(mandateId));
    return targetFlow ? [targetFlow] : [];
  }

  return flows;
}

/**
 * Gets all flows that contain any of the specified mandates
 */
export function getFlowsContainingMandates(
  allMandates: Mandate[],
  targetMandates: Mandate[]
): bigint[][] {
  const flows = identifyFlows(allMandates);
  const mandateIds = new Set(targetMandates.map(m => m.index));
  
  return flows.filter(flow => 
    flow.some(id => mandateIds.has(id))
  );
}