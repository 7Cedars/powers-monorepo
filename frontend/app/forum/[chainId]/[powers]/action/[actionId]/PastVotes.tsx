"use client";

import { useEffect, useState } from "react";
import { Action, Powers } from "@/context/types";
import { ArrowPathIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useParams } from "next/navigation";
import { parseChainId } from "@/utils/parsers";
import { usePublicClient, useChains } from "wagmi";
import { powersAbi } from "@/context/abi";
import { wagmiConfig } from "@/context/wagmiConfig";
import { getEnsName } from "@wagmi/core";
import { useBlocks } from "@/hooks/useBlocks";
import { toFullDateFormat, toEurTimeFormat } from "@/utils/toDates";

interface PastVotesProps {
  action: Action;
  mandate: any;
  powers: Powers;
}

type VoteData = {
  voter: `0x${string}`;
  support: number;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  ensName: string | null;
};

/**
 * PastVotes - Displays a list of all votes cast on an action
 * Shows: voter address/ENS, vote type, timestamp, and transaction hash
 */
export const PastVotes: React.FC<PastVotesProps> = ({ action, mandate, powers }) => {
  const { chainId } = useParams<{ chainId: string }>();
  const publicClient = usePublicClient();
  const chains = useChains();
  const { timestamps, fetchTimestamps } = useBlocks();
  
  const [votes, setVotes] = useState<VoteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportedChain = chains.find((chain) => chain.id === parseChainId(chainId));

  // Calculate vote end block
  const voteEnd = mandate?.conditions?.votingPeriod && action?.proposedAt
    ? action.proposedAt + mandate.conditions.votingPeriod
    : 0n;

  // Helper to truncate addresses, preferring ENS names
  const parseAddress = (address: string, ensName: string | null): string => {
    if (ensName) return ensName;
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Helper to get vote label
  const getVoteLabel = (support: number): string => {
    switch (support) {
      case 0: return "AGAINST";
      case 1: return "FOR";
      case 2: return "ABSTAIN";
      default: return "UNKNOWN";
    }
  };

  // Helper to get vote color
  const getVoteColor = (support: number): string => {
    switch (support) {
      case 0: return "text-red-500";
      case 1: return "text-green-500";
      case 2: return "text-muted-foreground";
      default: return "text-muted-foreground";
    }
  };

  // Fetch votes from blockchain
  const fetchVotes = async () => {
    if (!action?.actionId || !action?.proposedAt || !voteEnd) {
      setError("Invalid action data");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch VoteCast event logs
      const logs = await publicClient?.getContractEvents({
        address: powers?.contractAddress as `0x${string}`,
        abi: powersAbi,
        eventName: "VoteCast",
        args: { actionId: BigInt(action.actionId) },
        fromBlock: BigInt(action.proposedAt),
        toBlock: BigInt(voteEnd),
      });

      if (!logs || logs.length === 0) {
        setVotes([]);
        setLoading(false);
        return;
      }

      // Process logs and fetch ENS names
      const votePromises = logs.map(async (log: any): Promise<VoteData> => {
        let ensName: string | null = null;

        try {
          ensName = await getEnsName(wagmiConfig, {
            address: log.args.voter as `0x${string}`,
          });
        } catch (ensError) {
          // ENS lookup failed, continue without ENS name
          console.log("ENS lookup failed for:", log.args.voter);
        }

        return {
          voter: log.args.account as `0x${string}`,
          support: log.args.support as number,
          blockNumber: log.blockNumber as bigint,
          transactionHash: log.transactionHash as `0x${string}`,
          ensName,
        };
      });

      const votesData = await Promise.all(votePromises);

      // Filter out any invalid votes
      const validVotes = votesData.filter(
        (vote): vote is VoteData =>
          vote.blockNumber !== null &&
          vote.transactionHash !== null &&
          typeof vote.blockNumber === "bigint" &&
          typeof vote.transactionHash === "string"
      );

      // Sort by block number (newest first)
      validVotes.sort((a, b) => Number(b.blockNumber - a.blockNumber));

      setVotes(validVotes);

      // Fetch timestamps for all vote blocks
      const blockNumbers = validVotes.map((vote) => vote.blockNumber);
      if (blockNumbers.length > 0) {
        fetchTimestamps(blockNumbers, chainId);
      }
    } catch (err) {
      console.error("Error fetching votes:", err);
      setError("Failed to fetch votes");
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch votes on mount
  useEffect(() => {
    if (powers && action && mandate) {
      fetchVotes();
    }
  }, [action.actionId, powers?.contractAddress]);

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
            Past Votes ({votes.length})
          </h4>
        </div>
        <button
          onClick={fetchVotes}
          disabled={loading}
          className="flex items-center justify-center rounded-md p-1.5 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh Votes"
        >
          <ArrowPathIcon
            className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            <span>Loading votes...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      ) : votes.length > 0 ? (
        <div className="overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full table-auto text-xs">
              <thead className="sticky top-0 bg-muted/50 border-b border-border">
                <tr className="text-left">
                  <th className="px-3 py-2 font-normal text-muted-foreground uppercase tracking-wider">
                    Voter
                  </th>
                  <th className="px-3 py-2 font-normal text-muted-foreground uppercase tracking-wider">
                    Vote
                  </th>
                  <th className="px-3 py-2 font-normal text-muted-foreground uppercase tracking-wider">
                    Date & Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {votes.map((vote, index) => {
                  const timestampData = timestamps.get(`${chainId}:${vote.blockNumber}`);
                  const timestamp = timestampData?.timestamp;
                  
                  let formattedDate = "Loading...";
                  if (timestamp && timestamp > 0n) {
                    const timestampNumber = Number(timestamp);
                    if (!isNaN(timestampNumber) && timestampNumber > 0) {
                      try {
                        formattedDate = `${toFullDateFormat(timestampNumber)}: ${toEurTimeFormat(timestampNumber)}`;
                      } catch (error) {
                        formattedDate = "Invalid date";
                      }
                    }
                  }

                  return (
                    <tr key={index} className="hover:bg-muted/20 transition-colors">
                      {/* Voter */}
                      <td className="px-3 py-2">
                        <span className="text-foreground font-mono">
                          {parseAddress(vote.voter, vote.ensName)}
                        </span>
                      </td>

                      {/* Vote type */}
                      <td className="px-3 py-2">
                        <span className={`font-medium ${getVoteColor(vote.support)}`}>
                          {getVoteLabel(vote.support)}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="px-3 py-2">
                        <span className="text-muted-foreground font-mono">
                          {formattedDate}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 bg-muted/10">
          <p className="text-xs text-muted-foreground">No votes cast yet</p>
        </div>
      )}
    </div>
  );
};
