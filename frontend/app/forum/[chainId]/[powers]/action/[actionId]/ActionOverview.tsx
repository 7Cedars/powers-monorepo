"use client";

import { useEffect, useState } from "react";
import { Action, Mandate } from "@/context/types";
import { DocumentTextIcon, KeyIcon, CodeBracketIcon, ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import { decodeAbiParameters, parseAbiParameters } from "viem";
import { parseParamValues } from "@/utils/parsers";
import { SimulationBox } from "@/components/SimulationBox";
import { useMandate } from "@/hooks/useMandate";
import { useWallets } from "@privy-io/react-auth";

interface ActionOverviewProps {
  action: Action;
  mandate: Mandate;
}

/**
 * ActionOverview - Displays key information about an action including:
 * - Abbreviated actionId
 * - Input data (decoded parameters)
 * - Executable output data (simulation results)
 */
export const ActionOverview: React.FC<ActionOverviewProps> = ({ action, mandate }) => {
  const { simulation, simulate } = useMandate();
  const { wallets, ready } = useWallets();
  const [decodedParams, setDecodedParams] = useState<any[]>([]);
  const [hasSimulated, setHasSimulated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Decode input parameters from callData
  useEffect(() => {
    if (!action.callData || action.callData === '0x0' || !mandate.params || mandate.params.length === 0) {
      setDecodedParams([]);
      return;
    }

    try {
      const dataTypes = mandate.params.map(param => param.dataType);
      const values = decodeAbiParameters(
        parseAbiParameters(dataTypes.toString()), 
        action.callData as `0x${string}`
      );
      const valuesParsed = parseParamValues(values);
      setDecodedParams(valuesParsed);
    } catch (error) {
      console.error("Error decoding action parameters:", error);
      setDecodedParams([]);
    }
  }, [action.callData, mandate.params]);

  // Simulate the action to get executable output
  useEffect(() => {
    const runSimulation = async () => {
      if (!action.callData || 
          action.callData === '0x0' || 
          !ready || 
          !wallets || 
          !wallets[0] ||
          hasSimulated) {
        return;
      }

      try {
        await simulate(
          action.caller || (wallets[0].address as `0x${string}`),
          action.callData as `0x${string}`,
          BigInt(action.nonce || 0),
          mandate
        );
        setHasSimulated(true);
      } catch (error) {
        console.error("Error simulating action:", error);
      }
    };

    runSimulation();
  }, [action, mandate, ready, wallets, hasSimulated]);

  // Helper to abbreviate actionId
  const abbreviateActionId = (actionId: string): string => {
    if (!actionId || actionId.length <= 10) return actionId;
    return `${actionId.slice(0, 8)}...${actionId.slice(-8)}`;
  };

  // Helper to format parameter values for display
  const formatParamValue = (value: any, dataType: string): string => {
    if (value === undefined || value === null) return 'N/A';
    
    if (typeof value === 'bigint') {
      return value.toString();
    }
    
    if (Array.isArray(value)) {
      return `[${value.map(v => formatParamValue(v, dataType)).join(', ')}]`;
    }
    
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    
    return String(value);
  };

  // Handle copy to clipboard
  const handleCopyActionId = async () => {
    try {
      await navigator.clipboard.writeText(action.actionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy action ID:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action ID */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <KeyIcon className="h-4 w-4 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Action ID</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-foreground font-mono" title={action.actionId}>
            {abbreviateActionId(action.actionId)}
          </p>
          <button
            onClick={handleCopyActionId}
            className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Copy full Action ID"
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-green-500" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Copy Success Toast */}
      {copied && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2  shadow-lg z-50 text-xs font-mono animate-in fade-in slide-in-from-top-2 duration-200">
          Action ID copied to clipboard!
        </div>
      )}

      {/* Input Data Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Input Data</h4>
        </div>

        {mandate.params && mandate.params.length > 0 ? (
          <div className="space-y-3">
            {mandate.params.map((param, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider min-w-24">
                    {param.varName}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 font-mono">
                    ({param.dataType})
                  </span>
                </div>
                <div className="bg-muted/30 p-2  border border-border">
                  <p className="text-xs text-foreground font-mono break-all">
                    {decodedParams[idx] !== undefined 
                      ? formatParamValue(decodedParams[idx], param.dataType)
                      : 'Loading...'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No input parameters required</p>
        )}
      </div>

      {/* Executable Output Data Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CodeBracketIcon className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Executable Output Data</h4>
        </div>

        {simulation ? (
          <div>
            <SimulationBox mandate={mandate} simulation={simulation} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {hasSimulated ? 'No simulation data available' : 'Loading simulation...'}
          </p>
        )}
      </div>
    </div>
  );
};
