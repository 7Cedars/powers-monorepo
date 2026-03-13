import { Powers, Mandate } from "@/context/types"

/**
 * Identifies mandate flows by analyzing condition dependencies.
 * 
 * A "flow" is a group of mandates that are linked together through
 * conditions.needFulfilled and conditions.needNotFulfilled requirements.
 * 
 * @param powers - The Powers object containing mandates with their conditions
 * @returns An array of arrays, where each inner array contains mandateIds that form a flow
 * 
 * @example
 * // If Mandate 2 needs Mandate 1 fulfilled, and Mandate 3 needs Mandate 2 fulfilled:
 * // Returns: [[1n, 2n, 3n], [4n], [5n, 6n]]
 * const flows = identifyFlows(powers)
 */
export function identifyFlows(powers: Powers): bigint[][] {
  if (!powers.mandates || powers.mandates.length === 0) {
    return []
  }

  // Filter to only active mandates (matching PowersFlow.tsx logic)
  const activeMandates = powers.mandates.filter(mandate => mandate.active)
  
  if (activeMandates.length === 0) {
    return []
  }

  // Build dependency maps (matching createHierarchicalLayout logic)
  const dependencies = new Map<string, Set<string>>()
  const dependents = new Map<string, Set<string>>()
  
  // Initialize maps for all mandates
  activeMandates.forEach(mandate => {
    const mandateId = String(mandate.index)
    dependencies.set(mandateId, new Set())
    dependents.set(mandateId, new Set())
  })
  
  // Populate dependency relationships
  activeMandates.forEach(mandate => {
    const mandateId = String(mandate.index)
    if (mandate.conditions) {
      // Handle needFulfilled dependency
      if (mandate.conditions.needFulfilled != null && mandate.conditions.needFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needFulfilled)
        if (dependencies.has(targetId)) {
          dependencies.get(mandateId)?.add(targetId)
          dependents.get(targetId)?.add(mandateId)
        }
      }
      
      // Handle needNotFulfilled dependency
      if (mandate.conditions.needNotFulfilled != null && mandate.conditions.needNotFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needNotFulfilled)
        if (dependencies.has(targetId)) {
          dependencies.get(mandateId)?.add(targetId)
          dependents.get(targetId)?.add(mandateId)
        }
      }
    }
  })

  // Find connected components using traversal (matching findConnectedNodes logic)
  const visited = new Set<string>()
  const flows: bigint[][] = []

  // Recursive traversal function to find all nodes in a connected component
  function traverse(nodeId: string, component: Set<string>) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    component.add(nodeId)
    
    // Traverse all dependencies
    const deps = dependencies.get(nodeId) || new Set()
    deps.forEach(depId => traverse(depId, component))
    
    // Traverse all dependents
    const dependentNodes = dependents.get(nodeId) || new Set()
    dependentNodes.forEach(depId => traverse(depId, component))
  }

  // Find all connected components
  activeMandates.forEach(mandate => {
    const mandateId = String(mandate.index)
    if (!visited.has(mandateId)) {
      const component = new Set<string>()
      traverse(mandateId, component)
      
      if (component.size > 0) {
        // Convert strings back to bigints and sort
        const flow = Array.from(component)
          .map(id => BigInt(id))
          .sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
        flows.push(flow)
      }
    }
  })

  return flows
}
