import { erc20Abi, powersAbi } from "@/context/abi";
import { Powers, Status, Token } from "@/context/types";
import { useCallback, useState } from "react";
import { useBalance } from "wagmi";
import { readContract, getPublicClient } from "wagmi/actions";
import { wagmiConfig } from "@/context/wagmiConfig";
import { useParams } from "next/navigation";
import { parseChainId } from "@/utils/parsers";
import { parseAbiItem } from "viem";

export const useAssets = (powers: Powers | undefined) => {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>();
  const { chainId } = useParams<{ chainId: string }>();
  
  const { data: native } = useBalance({
    address: powers?.treasury,
    chainId: parseChainId(chainId),
  });

  // console.log("Native balance:", native);

  const discoverErc20s = async (
    treasuryAddress: `0x${string}`
  ): Promise<`0x${string}`[]> => {
    try {
      const publicClient = getPublicClient(wagmiConfig, { chainId: parseChainId(chainId) });
      if (!publicClient) return [];

      const logs = await publicClient.getLogs({
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
        args: { to: treasuryAddress },
        fromBlock: 0n,
        toBlock: 'latest',
      });

      return [...new Set(logs.map(log => log.address.toLowerCase() as `0x${string}`))];
    } catch {
      return [];
    }
  };

  const fetchErc20s = async (
    tokenAddresses: `0x${string}`[],
    treasuryAddress: `0x${string}`
  ) => {
    let token: `0x${string}`;
    const tokens: Token[] = [];

    for await (token of tokenAddresses) {
      try {
        const name = await readContract(wagmiConfig, {
          abi: erc20Abi,
          address: token,
          functionName: "name",
          chainId: parseChainId(chainId),
        });
        const nameParsed = name as string;

        const symbol = await readContract(wagmiConfig, {
          abi: erc20Abi,
          address: token,
          functionName: "symbol",
          chainId: parseChainId(chainId),
        });
        const symbolParsed = symbol as string;

        const balance = await readContract(wagmiConfig, {
          abi: erc20Abi,
          address: token,
          functionName: "balanceOf",
          args: [treasuryAddress],
          chainId: parseChainId(chainId),
        });
        const balanceParsed = balance as bigint;

        const decimal = await readContract(wagmiConfig, {
          abi: erc20Abi,
          address: token,
          functionName: "decimals",
          chainId: parseChainId(chainId),
        });
        const decimalParsed = decimal as bigint;

        if (nameParsed && symbolParsed && balanceParsed !== undefined && decimalParsed) {
          tokens.push({
            name: nameParsed,
            symbol: symbolParsed,
            balance: balanceParsed,
            decimals: decimalParsed,
            address: token,
            type: "erc20",
          });
        }
      } catch (error) {
        setStatus("error");
        setError("Failed to fetch ERC20 token balances.");
      }
    }
    return tokens;
  };

  const fetchTokens = useCallback(async (powers: Powers) => {
    setStatus("pending");
    setError(null);

    try {
      if (powers.treasury) {
        const savedErc20s: `0x${string}`[] = JSON.parse(
          localStorage.getItem("powersProtocol_savedErc20s") || "[]"
        );

        const discovered = await discoverErc20s(powers.treasury);

        const merged = [
          ...new Set([
            ...savedErc20s.map(a => a.toLowerCase() as `0x${string}`),
            ...discovered,
          ])
        ] as `0x${string}`[];

        if (merged.length > savedErc20s.length) {
          localStorage.setItem("powersProtocol_savedErc20s", JSON.stringify(merged));
        }

        const erc20s: Token[] = await fetchErc20s(merged, powers.treasury);

        if (erc20s) {
          erc20s.sort((a: Token, b: Token) => (a.balance > b.balance ? -1 : 1));
          setTokens(erc20s);
        }
        setStatus("success");
      }
    } catch (e) {
      setError("Failed to fetch treasury address.");
      setStatus("error");
    }

  }, [chainId]);

  const addErc20 = (erc20: `0x${string}`) => {
    setStatus("pending")
    const savedErc20s = JSON.parse(localStorage.getItem("powersProtocol_savedErc20s") || "[]")
    if (!savedErc20s.includes(erc20)) {
      localStorage.setItem("powersProtocol_savedErc20s", JSON.stringify([...savedErc20s, erc20]));
    }
    setStatus("success")
  }

  const resetErc20s = () => {
    setStatus("pending")
    localStorage.removeItem("powersProtocol_savedErc20s")
    setStatus("success")
  }

  return {status, error, tokens, native, fetchTokens, addErc20, resetErc20s }
}
