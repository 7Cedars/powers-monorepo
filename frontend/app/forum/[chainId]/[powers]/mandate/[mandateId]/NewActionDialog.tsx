'use client'

import React, { useEffect, useCallback, useState, useMemo } from "react";
import { XMarkIcon, ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { ForumModal } from "../../../../../../components/ForumModal";
import { SelectActionDialog, SelectedActionInfo } from "../../flow/[mandateId]/SelectActionDialog";
import { DynamicInput } from "@/components/DynamicInput";
import { SimulationBox } from "@/components/SimulationBox";
import { setError, useActionStore, useErrorStore, usePowersStore, useStatusStore, setStatus } from "@/context/store";
import { parseMandateError, parseParamValues } from "@/utils/parsers";
import { Action, InputType, Mandate } from "@/context/types";
import { setAction } from "@/context/store";
import { decodeAbiParameters, encodeAbiParameters, parseAbiParameters } from "viem";
import { hashAction } from "@/utils/hashAction";
import { useWallets } from "@privy-io/react-auth";
import { useMandate } from "@/hooks/useMandate";
import { useChecks } from "@/hooks/useChecks";
import { cn } from "@/utils/utils";
import { useRouter, useParams } from "next/navigation";

interface NewActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mandate: Mandate;
}

/**
 * NewActionDialog - A modal for creating new actions (proposals/executions) for a mandate.
 * Uses ForumModal as the wrapper, follows MandateListSheet styling, and implements DynamicForm logic.
 * 
 * @param open - Controls whether the dialog is visible
 * @param onOpenChange - Callback when dialog open state changes
 * @param mandate - The mandate to create an action for
 */
export const NewActionDialog: React.FC<NewActionDialogProps> = ({
  open,
  onOpenChange,
  mandate
}) => {
  const router = useRouter();
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>();
  const action = useActionStore();
  const error = useErrorStore();
  const powers = usePowersStore();
  const status = useStatusStore();
  const { wallets, ready } = useWallets();
  const { simulation, simulate, request, propose } = useMandate();
  const { checks, fetchChecks } = useChecks();

  // Track if we're submitting a transaction (not just simulating)
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Track whether to show the Select Input dialog
  const [showSelectInput, setShowSelectInput] = useState(false);

  const params = mandate.params || [];
  const dataTypes = params.map(param => param.dataType);

  // Get actions from the same flow (excluding current mandate)
  const flowActions = useMemo(() => {
    if (!powers?.flows || !powers?.mandates) return [];
    
    // Find the flow that contains the current mandate
    const targetFlow = powers.flows.find(flow => 
      flow.mandateIds.includes(mandate.index)
    );
    
    if (!targetFlow) return [];
    
    // Get all mandate IDs in the flow (excluding current mandate)
    const flowMandateIds = new Set(
      targetFlow.mandateIds.filter(id => id !== mandate.index)
    );
    
    // Collect all actions from these mandates
    const actions: any[] = [];
    powers.mandates.forEach(m => {
      if (flowMandateIds.has(m.index) && m.actions) {
        m.actions.forEach(a => {
          const blockNumbers = [
            a.proposedAt || 0n,
            a.requestedAt || 0n,
            a.fulfilledAt || 0n,
            a.cancelledAt || 0n
          ].filter(bn => bn > 0n);
          
          const highestBlockNumber = blockNumbers.length > 0 
            ? blockNumbers.reduce((max, bn) => bn > max ? bn : max, 0n)
            : 0n;
          
          if (highestBlockNumber > 0n) {
            actions.push({
              ...a,
              highestBlockNumber
            });
          }
        });
      }
    });
    
    // Sort by highest block number (descending)
    actions.sort((a, b) => {
      if (a.highestBlockNumber > b.highestBlockNumber) return -1;
      if (a.highestBlockNumber < b.highestBlockNumber) return 1;
      return 0;
    });
    
    return actions.slice(0, 25);
  }, [powers, mandate.index]);

  // Reset status when dialog closes
  useEffect(() => {
    if (!open && status.status !== "idle") {
      setStatus({ status: "idle" });
      setError({ error: null });
      setIsSubmitting(false);
    }
  }, [open, status.status]);

  // Navigate to action page on successful transaction
  useEffect(() => {
    if (status.status === "success" && open && isSubmitting && action.actionId) {
      // Small delay to show success state before navigating
      const timer = setTimeout(() => {
        // Navigate to the action page
        router.push(`/forum/${chainId}/${powersAddress}`);
        // Reset state
        onOpenChange(false);
        setStatus({ status: "idle" });
        setError({ error: null });
        setIsSubmitting(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status.status, open, onOpenChange, isSubmitting, action?.actionId, router, chainId, powersAddress]);

  // Handle param value changes
  const handleChange = useCallback((input: InputType | InputType[], index: number) => {
    let currentInput = action.paramValues ? [...action.paramValues] : [];
    currentInput[index] = input;
    setAction({ ...action, paramValues: currentInput, upToDate: false });
  }, [action]);

  // Initialize form when dialog opens or mandate changes
  useEffect(() => {
    if (!open || !mandate) return;

    // Initialize with default values if needed
    if (!action.paramValues || action.paramValues.length !== params.length) {
      const defaultValues = params.map(param => {
        const isArray = param.dataType.indexOf('[]') > -1;
        if (param.dataType.indexOf('string') > -1) {
          return isArray ? [""] : "";
        } else if (param.dataType.indexOf('bool') > -1) {
          return isArray ? [false] : false;
        } else {
          return isArray ? [0] : 0;
        }
      });
      
      setAction({
        ...action,
        mandateId: mandate.index,
        dataTypes,
        paramValues: defaultValues,
        nonce: BigInt(Math.floor(Math.random() * 1000000000000000000000000)).toString(),
        description: "",
        upToDate: false
      });
    }
  }, [open, mandate]);

  // Decode calldata if present
  useEffect(() => {
    if (!action.callData || action.callData === '0x0' || action.upToDate || dataTypes.length === 0) {
      return;
    }

    try {
      const values = decodeAbiParameters(parseAbiParameters(dataTypes.toString()), action.callData as `0x${string}`);
      const valuesParsed = parseParamValues(values);
      
      if (dataTypes.length !== valuesParsed.length) {
        const defaultValues = dataTypes.map(dataType => {
          const isArray = dataType.indexOf('[]') > -1;
          if (dataType.indexOf('string') > -1) {
            return isArray ? [""] : "";
          } else if (dataType.indexOf('bool') > -1) {
            return isArray ? [false] : false;
          } else {
            return isArray ? [0] : 0;
          }
        });
        setAction({ ...action, paramValues: defaultValues, upToDate: true });
      } else {
        setAction({ ...action, paramValues: valuesParsed, upToDate: true });
      }
    } catch (error) {
      console.error("Error decoding abi parameters:", error);
      if (!action.upToDate) {
        const defaultValues = dataTypes.map(dataType => {
          const isArray = dataType.indexOf('[]') > -1;
          if (dataType.indexOf('string') > -1) {
            return isArray ? [""] : "";
          } else if (dataType.indexOf('bool') > -1) {
            return isArray ? [false] : false;
          } else {
            return isArray ? [0] : 0;
          }
        });
        setAction({ ...action, paramValues: defaultValues, upToDate: true });
      }
    }
  }, [mandate.index, action.callData]);

  // Handle simulation and checks
  const handleSimulate = useCallback(async () => {
    setError({ error: null });
    let mandateCalldata: `0x${string}` | undefined;

    // Sanitize param values
    let sanitizedParamValues = action.paramValues || [];
    if (mandate.params) {
      sanitizedParamValues = mandate.params.map((param, i) => {
        let val = action.paramValues?.[i];
        const isArray = param.dataType.indexOf('[]') > -1;
        
        if (val === undefined) {
          if (param.dataType.indexOf('string') > -1) {
            return isArray ? [""] : "";
          } else if (param.dataType.indexOf('bool') > -1) {
            return isArray ? [false] : false;
          } else {
            return isArray ? [0] : 0;
          }
        }

        if (isArray && Array.isArray(val)) {
          return val.map(item => {
            if (param.dataType.indexOf('bool') > -1) {
              return (typeof item === 'boolean') ? item : false;
            }
            if (item !== undefined) return item;
            if (param.dataType.indexOf('string') > -1) return "";
            return 0;
          });
        }
        
        return val;
      });
    }

    // Encode calldata
    if (sanitizedParamValues.length > 0) {
      try {
        mandateCalldata = encodeAbiParameters(
          parseAbiParameters(mandate.params?.map(param => param.dataType).toString() || ""),
          sanitizedParamValues
        );
      } catch (error) {
        setError({ error: error as Error });
        return;
      }
    } else {
      mandateCalldata = '0x0';
    }

    if (mandateCalldata && ready && wallets && powers?.contractAddress) {
      // Fetch checks
      if (fetchChecks) {
        await fetchChecks(mandate, mandateCalldata, BigInt(action.nonce as string), wallets, powers);
      }

      const actionId = hashAction(mandate.index, mandateCalldata, BigInt(action.nonce as string)).toString();

      const newAction: Action = {
        ...action,
        actionId,
        state: 0,
        mandateId: mandate.index,
        caller: wallets[0] ? wallets[0].address as `0x${string}` : '0x0',
        dataTypes: mandate.params?.map(param => param.dataType),
        paramValues: sanitizedParamValues,
        nonce: action.nonce,
        description: action.description,
        callData: mandateCalldata,
        upToDate: true
      };

      console.log("Simulating action with calldata:", mandateCalldata, "and param values:", sanitizedParamValues, "and nonce:", action.nonce);

      setAction(newAction);

      try {
        await simulate(
          wallets[0] ? wallets[0].address as `0x${string}` : '0x0',
          newAction.callData as `0x${string}`,
          BigInt(newAction.nonce as string),
          mandate
        );
      } catch (error) {
        setError({ error: error as Error });
      }
    }
  }, [action, mandate, ready, wallets, powers, fetchChecks, simulate]);

  // Handle action submission (propose or execute)
  const handleSubmit = useCallback(async () => {
    if (!action.callData || !powers || !action.nonce) {
      return;
    }

    const needsVote = mandate.conditions?.quorum && mandate.conditions.quorum > 0n;

    // Mark that we're submitting a transaction
    setIsSubmitting(true);

    try {
      if (needsVote) {
        // Needs a vote - use propose
        await propose(
          mandate.index,
          action.callData as `0x${string}`,
          BigInt(action.nonce),
          action.description || "",
          powers
        );
      } else {
        // Direct execution - use request
        await request(
          mandate,
          action.callData as `0x${string}`,
          BigInt(action.nonce),
          action.description || "",
          powers
        );
      }
      
      // Note: Dialog will auto-close via the useEffect that watches for success status
    } catch (error) {
      setError({ error: error as Error });
      setIsSubmitting(false);
    }
  }, [action, mandate, powers, propose, request]);

  // Handle selecting an action from the flow
  const handleSelectAction = useCallback((selectedActionInfo: SelectedActionInfo) => {
    // Find the full action object
    const selectedAction = flowActions.find(a => a.actionId === selectedActionInfo.actionId);
    if (!selectedAction || !selectedAction.callData) return;
    
    try {
      // Decode callData to get param values
      const values = decodeAbiParameters(
        parseAbiParameters(dataTypes.toString()), 
        selectedAction.callData as `0x${string}`
      );
      const valuesParsed = parseParamValues(values);
      
      // Update the action store with the selected action's data
      // Note: We keep the current description (don't copy it)
      // But we DO copy the nonce (as per requirement)
      setAction({
        ...action,
        mandateId: mandate.index,
        callData: selectedAction.callData,
        nonce: selectedAction.nonce,
        paramValues: valuesParsed,
        dataTypes,
        upToDate: false // Trigger revalidation
      });
      
      // Close the select input dialog
      setShowSelectInput(false);
    } catch (error) {
      console.error("Error loading selected action:", error);
      setError({ error: error as Error });
      setShowSelectInput(false);
    }
  }, [flowActions, dataTypes, mandate.index, action]);

  const needsVote = mandate.conditions?.quorum && mandate.conditions.quorum > 0n;
  console.log("@NewActionDialog: ", {action, error, status, simulation, checks, needsVote});
  
  // For NEW proposals, we need different checks than for executing existing actions
  // When proposing, the action shouldn't exist yet (actionExists should be false)
  // We only care about: authorised, throttlePassed, actionNotFulfilled, mandateFulfilled, mandateNotFulfilled
  const canSubmit = action.upToDate && checks && (() => {
    if (needsVote) {
      // For proposals: action should NOT exist yet, so we skip actionExists and proposalPassed checks
      return checks.authorised === true &&
             checks.throttlePassed === true &&
             checks.actionNotFulfilled === true; 
    } else {
      // For direct execution: use all checks
      return checks.allPassed === true;
    }
  })();

  return (
    <ForumModal open={open} onOpenChange={onOpenChange} className="font-mono max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm text-foreground">Start a New Action</h3>
          <p className="text-xs text-muted-foreground">
            Mandate #{mandate.index.toString()} - {mandate.nameDescription || '[MANDATE NAME]'}
          </p>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Select Input Button */}
      {flowActions.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowSelectInput(true)}
            className="w-full flex items-center justify-center gap-2 px-6 py-2 text-sm uppercase tracking-wider whitespace-nowrap bg-foreground text-background hover:bg-foreground/80 transition-colors"
          >
            Select Input
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {/* Description Input */}
        <div className="flex items-center gap-2">
          <label htmlFor="description" className="text-[10px] text-muted-foreground uppercase tracking-wider min-w-24">
            Description
          </label>
          <input
            type="text"
            name="description"
            id="description"
            value={action.description}
            className="flex-1 bg-background border border-border px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors font-mono"
            placeholder="Enter description of action (or uri) here."
            onChange={(e) => {
              e.preventDefault();
              setAction({ ...action, description: e.target.value, upToDate: false });
            }}
          />
        </div>

        {/* Dynamic Inputs for Params */}
        {params.map((param, index) => (
          <div key={index}>
            {/* <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              {param.varName}
            </label> */}
            <DynamicInput
              dataType={param.dataType}
              varName={param.varName}
              index={index}
              values={action.paramValues && action.paramValues[index] !== undefined ? action.paramValues[index] : ""}
              onChange={(input) => handleChange(input, index)}
            />
          </div>
        ))}

        {/* Nonce Input */}
        <div className="flex items-center gap-2">
          <label htmlFor="nonce" className="text-[10px] text-muted-foreground uppercase tracking-wider min-w-24">
            Nonce
          </label>
          <input
            type="number"
            name="nonce"
            id="nonce"
            value={action.nonce}
            className="flex-1 bg-background border border-border  px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors font-mono"
            placeholder="Enter random number..."
            onChange={(e) => {
              e.preventDefault();
              setAction({ ...action, nonce: e.target.value, upToDate: false });
            }}
          />
          <button
            type="button"
            className="h-9 w-9 flex items-center justify-center  bg-background border border-border hover:bg-muted transition-colors"
            onClick={(e) => {
              e.preventDefault();
              setAction({
                ...action,
                nonce: BigInt(Math.floor(Math.random() * 1000000000000000000000000)).toString(),
                upToDate: false
              });
            }}
          >
            <SparklesIcon className="h-4 w-4" />
          </button>
        </div>
 
        {/* Error Display */}
        {error.error && (
          <div className="w-full text-xs text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 px-3 py-2">
            Failed check: {parseMandateError(error || "Unknown error")}
          </div>
        )}

        {/* Check Button */}
        {(!action.upToDate || checks === undefined) && (
          <button
            type="button"
            onClick={handleSimulate}
            className={cn(
              "w-full border border-border px-4 py-2.5 text-xs text-foreground",
              "bg-muted/10 hover:bg-muted/50 hover:border-foreground/40 transition-colors",
              "uppercase tracking-wider font-mono"
            )}
          >
            Run Checks
          </button>
        )}
      </form>

      {/* Simulation Box */}
      {simulation && action?.upToDate && (
        <div className="mt-4">
          <SimulationBox mandate={mandate} simulation={simulation} />
        </div>
      )}

      {/* Submit Button */}
      {canSubmit ? (
        <button
          onClick={handleSubmit}
          disabled={status.status === "pending" && isSubmitting}
          className={cn(
            "w-full mt-4 border  px-4 py-2.5 text-xs font-mono",
            "uppercase tracking-wider transition-colors",
            "flex items-center justify-center gap-2",
            status.status === "pending" && isSubmitting && "opacity-70 cursor-not-allowed",
            status.status === "success" && isSubmitting && "bg-green-600 text-white border-green-600",
            status.status === "error" && isSubmitting && "bg-red-600 text-white border-red-600",
            (!isSubmitting || status.status === "idle") && "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:border-primary/90"
          )}
        >
          {status.status === "pending" && isSubmitting && (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          )}
          {status.status === "pending" && isSubmitting && "Waiting for Confirmation"}
          {status.status === "success" && isSubmitting && "Transaction Confirmed!"}
          {status.status === "error" && isSubmitting && "Transaction Failed"}
          {(!isSubmitting || status.status === "idle") && (needsVote ? 'Propose Action' : 'Execute Action')}
        </button>
      )
      : 
        action.upToDate && (
          <div className="w-full mt-4 text-xs text-muted-foreground">
            Action cannot be submitted due to failed checks or an error.
          </div>
        )
      }

      {/* Select Input Dialog */}
      <SelectActionDialog
        open={showSelectInput}
        onOpenChange={setShowSelectInput}
        onSelect={handleSelectAction}
        actions={flowActions}
      />
    </ForumModal>
  );
};
