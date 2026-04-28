"use client";

import { useEffect, useState } from "react";
import { usePowersStore, useActionStore, useStatusStore, setError, setAction } from "@/context/store";
import { useMandate } from "@/hooks/useMandate";
import { useBlocks } from "@/hooks/useBlocks";
import { useBlockNumber } from "wagmi";
import { useParams } from "next/navigation";
import { parseChainId } from "@/utils/parsers";
import { getConstants } from "@/context/constants";
import { CheckIcon, XMarkIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Action, Powers, Mandate } from "@/context/types";
import { ForumModal } from "@/components/ForumModal";
import { useChecks } from "@/hooks/useChecks";
import { useWallets } from "@privy-io/react-auth";
import { Button } from "@/components/Button";

interface VoteProps {
  action: Action;
  mandate: Mandate;
}

export const Vote: React.FC<VoteProps> = ({ action: propAction, mandate }) => {
  const powers = usePowersStore();
  const action = useActionStore();
  const status = useStatusStore();
  const { chainId } = useParams<{ chainId: string }>();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const constants = getConstants(parseChainId(chainId) as number);
  const { castVote, actionVote, fetchVoteData, request } = useMandate();
  const { checks, fetchChecks, status: checksStatus } = useChecks();
  const { timestamps, fetchTimestamps } = useBlocks();
  const { wallets } = useWallets();

  const [pendingVote, setPendingVote] = useState<bigint | null>(null);
  const [logSupport, setLogSupport] = useState<bigint>();
  const [populatedAction, setPopulatedAction] = useState<Action | undefined>();

  console.log({checks, checksStatus })

  // Calculate vote parameters
  const roleHolders = Number(
    powers?.roles?.find(
      (role) => BigInt(role.roleId) === BigInt(mandate?.conditions?.allowedRole || 0)
    )?.amountHolders
  ) || 0;

  const allVotes =
    Number(actionVote?.forVotes || 0) +
    Number(actionVote?.againstVotes || 0) +
    Number(actionVote?.abstainVotes || 0);

  const quorum = roleHolders > 0
    ? Math.ceil((roleHolders * Number(mandate?.conditions?.quorum || 0)) / 100)
    : 0;

  const threshold = roleHolders > 0
    ? Math.ceil((roleHolders * Number(mandate?.conditions?.succeedAt || 0)) / 100)
    : 0;

  const voteEnd = mandate?.conditions?.votingPeriod && populatedAction?.proposedAt
    ? BigInt(populatedAction.proposedAt) + BigInt(mandate.conditions.votingPeriod)
    : 0n;

  const quorumPassed =
    Number(actionVote?.forVotes || 0) + Number(actionVote?.abstainVotes || 0) >= quorum;
  const thresholdPassed = Number(actionVote?.forVotes || 0) >= threshold;
  const voteActive = populatedAction?.state === 3;
  const voteEnded = blockNumber && voteEnd ? BigInt(blockNumber) >= voteEnd : false;

  // Fetch action data
  useEffect(() => {
    if (propAction) {
      const newPopulatedAction = mandate?.actions?.find(
        (a: Action) => BigInt(a.actionId) === BigInt(propAction.actionId)
      );
      setPopulatedAction(newPopulatedAction || propAction);
    }
  }, [propAction?.actionId, mandate]);

  // Fetch vote data
  useEffect(() => {
    if (powers && mandate && populatedAction) {
      fetchVoteData(populatedAction as Action, powers as Powers);
    }
  }, [populatedAction]);
 
  useEffect(() => {
    if (checksStatus === "success" && checks?.allPassed !== undefined) {
      setAction({
        ...action,
        upToDate: true
      }); // Update action in global state to trigger re-render with new checks status
    }
  }, [checksStatus]);

  // Fetch timestamps
  useEffect(() => {
    if (populatedAction?.proposedAt && voteEnd) {
      fetchTimestamps([BigInt(populatedAction.proposedAt), voteEnd], chainId);
    }
  }, [populatedAction?.proposedAt, voteEnd, chainId]);

  // Fetch checks (including hasVoted) on mount and after successful vote
  useEffect(() => {
    if (powers && mandate && action && wallets.length > 0 && action.callData && status.status !== "pending") {
      fetchChecks(
        mandate,
        action.callData as `0x${string}`,
        BigInt(action.nonce || 0),
        wallets,
        powers as Powers
      );
    }
  }, [populatedAction?.actionId, status.status]);

  const handleVoteClick = (support: bigint) => {
    setPendingVote(support);
  };

  const confirmVote = async () => {
    if (pendingVote !== null && populatedAction) {
      setLogSupport(pendingVote);
      await castVote(BigInt(populatedAction.actionId), pendingVote, powers as Powers);
      setPendingVote(null);
    }
  };

  const getVoteLabel = (support: bigint): string => {
    switch (support) {
      case 1n:
        return "FOR";
      case 0n:
        return "AGAINST";
      case 2n:
        return "ABSTAIN";
      default:
        return "UNKNOWN";
    }
  };

  const getVoteColor = (support: bigint): string => {
    switch (support) {
      case 1n:
        return "text-green-500";
      case 0n:
        return "text-red-500";
      case 2n:
        return "text-muted-foreground";
      default:
        return "text-muted-foreground";
    }
  };

  const timeRemainingMinutes = blockNumber && voteEnd && blockNumber < voteEnd
    ? Math.floor((Number(voteEnd) - Number(blockNumber)) * 60 / constants.BLOCKS_PER_HOUR)
    : 0;

  const handleExecute = async () => {
    if (!mandate || !action || !action.callData) return;
    
    setError({ error: null });

    await request(
      mandate as Mandate,
      action.callData as `0x${string}`,
      BigInt(action.nonce as string),
      action.description as string,
      powers as Powers
    );
  };

  const handleRunChecks = () => {
    if (powers && mandate && action && wallets.length > 0 && action.callData) {
      // console.log("Running checks with data:", {
      //   mandate,
      //   callData: action.callData,
      //   nonce: BigInt(action.nonce || 0),
      //   wallets,
      //   powers
      // });
      fetchChecks(
        mandate,
        action.callData as `0x${string}`,
        BigInt(action.nonce || 0),
        wallets,
        powers as Powers
      );

    }
  };

  // Vote Status Display Component
  const VoteStatusDisplay = () => (
    <div className="space-y-4">
      {voteActive && !voteEnded && (
        <div className="space-y-2">
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Vote Status</h4>
          
          {/* Time Remaining */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Time Remaining:</span>
            <span className="text-foreground font-mono">
              {timeRemainingMinutes > 60
                ? `${Math.floor(timeRemainingMinutes / 60)}h ${timeRemainingMinutes % 60}m`
                : `${timeRemainingMinutes}m`}
            </span>
          </div>

          {/* Quorum */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {quorumPassed ? (
                <CheckIcon className="h-3 w-3 text-green-600" />
              ) : (
                <XMarkIcon className="h-3 w-3 text-red-600" />
              )}
              <span className="text-muted-foreground">Quorum ({mandate?.conditions?.quorum}%):</span>
            </div>
            <span className="text-foreground font-mono">
              {Number(actionVote?.forVotes || 0) + Number(actionVote?.abstainVotes || 0)} / {quorum}
            </span>
          </div>

          {/* Threshold */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {thresholdPassed ? (
                <CheckIcon className="h-3 w-3 text-green-600" />
              ) : (
                <XMarkIcon className="h-3 w-3 text-red-600" />
              )}
              <span className="text-muted-foreground">Threshold ({mandate?.conditions?.succeedAt}%):</span>
            </div>
            <span className="text-foreground font-mono">
              {Number(actionVote?.forVotes || 0)} / {threshold}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // Vote Results Display Component
  const VoteResultsDisplay = () => (
    <div className="space-y-3">
      <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Vote Results</h4>
      
      <div className="text-xs text-muted-foreground mb-3">
        {allVotes}/{roleHolders} votes cast
      </div>

      {/* Vote bars */}
      <div className="space-y-2">
        {[
          { label: "FOR", value: Number(actionVote?.forVotes || 0), color: "text-green-500", bg: "bg-green-500/60" },
          { label: "AGAINST", value: Number(actionVote?.againstVotes || 0), color: "text-red-500", bg: "bg-red-500/60" },
          { label: "ABSTAIN", value: Number(actionVote?.abstainVotes || 0), color: "text-muted-foreground", bg: "bg-muted-foreground/40" },
        ].map((v) => (
          <div key={v.label} className="flex items-center gap-2 text-xs">
            <span className={`${v.color} w-20`}>{v.label}</span>
            <div className="flex-1 h-2 bg-muted/20  overflow-hidden">
              <div
                className={`h-full ${v.bg} `}
                style={{ width: `${allVotes > 0 ? (v.value / allVotes) * 100 : 0}%` }}
              />
            </div>
            <span className="text-muted-foreground w-8 text-right">{v.value}</span>
          </div>
        ))}
      </div>

      {/* Quorum Reached */}
      <div className="pt-2 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {quorumPassed ? (
              <CheckIcon className="h-3 w-3 text-green-600" />
            ) : (
              <XMarkIcon className="h-3 w-3 text-red-600" />
            )}
            <span className="text-muted-foreground">Quorum Reached:</span>
          </div>
          <span className={`font-mono ${quorumPassed ? "text-green-600" : "text-red-600"}`}>
            {Number(actionVote?.forVotes || 0) + Number(actionVote?.abstainVotes || 0)} / {quorum}
          </span>
        </div>
      </div>

      {/* Final outcome */}
      {!voteActive && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <LockClosedIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Voting has ended</span>
          <span
            className={`text-xs font-bold ml-auto ${
              populatedAction?.state === 5 ? "text-green-500" : "text-red-500"
            }`}
          >
            {populatedAction?.state === 5 ? "PASSED" : populatedAction?.state === 4 ? "DEFEATED" : "CLOSED"}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-4">
      {/* Show vote status if active, otherwise show results */}
      {voteActive && !voteEnded && !checks?.hasVoted ? (
        <>
          <VoteStatusDisplay />
          
          {/* Voting Buttons */}
          <div className="space-y-2">
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Cast Your Vote</h4>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleVoteClick(1n)}
                disabled={status.status === "pending"}
                className="w-full border  px-4 py-3 text-xs transition-colors bg-green-500/20 border-green-500 text-green-500 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-mono uppercase tracking-wider"
              >
                {status.status === "pending" && logSupport === 1n ? "VOTING..." : "FOR"}
              </button>
              <button
                onClick={() => handleVoteClick(0n)}
                disabled={status.status === "pending"}
                className="w-full border  px-4 py-3 text-xs transition-colors bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-mono uppercase tracking-wider"
              >
                {status.status === "pending" && logSupport === 0n ? "VOTING..." : "AGAINST"}
              </button>
              <button
                onClick={() => handleVoteClick(2n)}
                disabled={status.status === "pending"}
                className="w-full border  px-4 py-3 text-xs transition-colors bg-muted/50 border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed font-mono uppercase tracking-wider"
              >
                {status.status === "pending" && logSupport === 2n ? "VOTING..." : "ABSTAIN"}
              </button>
            </div>
          </div>
        </>
      ) : checks?.hasVoted ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-3 border-y border-border">
            <CheckIcon className="h-4 w-4" />
            <span>You have already voted on this action</span>
          </div>
          <VoteResultsDisplay />
        </div>
      ) : (
        <VoteResultsDisplay />
      )}

      {/* Execute Button or Run Checks Button - Show when vote has passed */}
      {populatedAction?.state === 5 && (
        <div className="pt-2">
          {action?.upToDate ? (
            <Button
              size={0}
              role={6}
              onClick={handleExecute}
              filled={false}
              selected={true}
              statusButton={
                checks?.allPassed
                  ? status.status === "success"
                    ? "idle"
                    : status.status
                  : "disabled"
              }
            >
              Execute {checks?.allPassed ? "" : " (checks did not pass)"}
            </Button>
          ) : (
            <Button
              size={0}
              role={6}
              onClick={handleRunChecks}
              filled={false}
              selected={true}
              statusButton="idle"
            >
              Run checks
            </Button>
          )}
        </div>
      )}

      {/* Vote Confirmation Modal */}
      <ForumModal open={pendingVote !== null} onOpenChange={(open) => !open && setPendingVote(null)} className="font-mono max-w-md">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm text-foreground font-bold mb-2">Confirm Vote</h3>
            <p className="text-xs text-muted-foreground">
              Cast your vote as{" "}
              <span className={`font-bold ${pendingVote !== null ? getVoteColor(pendingVote) : ""}`}>
                {pendingVote !== null ? getVoteLabel(pendingVote) : ""}
              </span>
              ? This action is recorded on the blockchain and cannot be undone.
            </p>
          </div>
          
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setPendingVote(null)}
              className="px-4 py-2 text-xs border border-border  hover:bg-muted transition-colors font-mono uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              onClick={confirmVote}
              className="px-4 py-2 text-xs bg-primary text-primary-foreground  hover:opacity-90 transition-opacity font-mono uppercase tracking-wider"
            >
              Confirm Vote
            </button>
          </div>
        </div>
      </ForumModal>
    </div>
  );
};
