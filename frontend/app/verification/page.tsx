"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ZKPassport } from "@zkpassport/sdk";
import { parseEther, keccak256, toHex, encodeAbiParameters, parseAbiParameters, encodeFunctionData } from "viem";
import { Button } from "../../components/Button";
import { LoadingBox } from "../../components/LoadingBox";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

// Simple Input Component matching project style
const SimpleInput = ({ value, onChange, placeholder, className = "" }: { value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) => (
  <div className={`w-full flex text-xs items-center rounded-md bg-white pl-2 outline outline-1 outline-gray-300 ${className}`}>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-8 pe-2 text-xs font-mono text-slate-500 placeholder:text-gray-400 focus:outline focus:outline-0"
      placeholder={placeholder}
    />
  </div>
);

// ABI for ZKPassport_PowersRegistry
const REGISTRY_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { name: "pairing", type: "bytes32[]" },
              { name: "siblings", type: "bytes32[][]" },
            ],
            name: "proof",
            type: "tuple",
          },
          { name: "merkle_root", type: "bytes32" },
          { name: "nullifier_hash", type: "bytes32" },
          {
            components: [
              { name: "scope", type: "uint256" },
              { name: "merkle_root", type: "uint256" },
              { name: "attestation_id", type: "uint256" },
              { name: "leaf", type: "uint256" },
            ],
            name: "public_values",
            type: "tuple",
          },
        ],
        name: "proofParams",
        type: "tuple",
      },
      { name: "isIDCard", type: "bool" },
    ],
    name: "verifyAndRegister",
    outputs: [{ name: "identifier", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const AVAILABLE_FIELDS = [
  { id: "name", label: "Name (First & Last)", fields: ["firstName", "lastName"] },
  { id: "nationality", label: "Nationality", fields: ["nationality"] },
  { id: "issuingCountry", label: "Issuing Country", fields: ["issuingCountry"] },
  { id: "gender", label: "Gender", fields: ["gender"] },
  { id: "birthDate", label: "Birth Date", fields: ["birthDate"] },
  { id: "expiryDate", label: "Expiry Date", fields: ["expiryDate"] },
];

export default function VerificationPage() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [proof, setProof] = useState<any>(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [registryAddress, setRegistryAddress] = useState("");

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const generateProof = async () => {
    setIsGeneratingProof(true);
    try {
      const disclosedFields: string[] = [];
      
      selectedFields.forEach(fieldId => {
          const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
          if (field) {
              disclosedFields.push(...field.fields);
          }
      });

      const zkPassport = new ZKPassport();
      const request = {
          domain: "zkpassport.id", 
          scope: "powers", 
          query: {
              disclosure: disclosedFields
          },
          name: "Powers Protocol",
          logo: "https://powers.7cedars.xyz/logo1_notext.png", 
          purpose: "Verify identity for governance participation",
      };

      const generatedProof = await zkPassport.request(request);
      setProof(generatedProof);
    } catch (err) {
      console.error("Proof generation failed:", err);
      alert("Proof generation failed. See console for details.");
    } finally {
      setIsGeneratingProof(false);
    }
  };

  const submitToRegistry = () => {
    if (!proof || !registryAddress) return;

    writeContract({
      address: registryAddress as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "verifyAndRegister",
      args: [proof, false], // Assuming isIDCard is false for now, or detect from proof
    });
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-8">ZKPassport Verification</h1>
        <p className="mb-4">Please connect your wallet to verify your identity.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8 text-center">ZKPassport Verification</h1>
      
      <div className="bg-white/5 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Select Data to Disclose</h2>
        <p className="text-gray-400 mb-4 text-sm">
            Select the information you want to verify and disclose on-chain.
        </p>
        <div className="space-y-4">
          <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Registry Address</label>
              <SimpleInput 
                  value={registryAddress} 
                  onChange={setRegistryAddress} 
                  placeholder="0x..." 
              />
          </div>

          <div className="grid gap-4">
            {AVAILABLE_FIELDS.map((field) => (
              <div key={field.id} className="flex items-center space-x-3 p-3 border border-gray-700 rounded hover:bg-white/5 transition">
                <input
                  type="checkbox"
                  id={field.id}
                  checked={selectedFields.includes(field.id)}
                  onChange={() => handleFieldToggle(field.id)}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <label htmlFor={field.id} className="font-medium cursor-pointer select-none block">
                    {field.label}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/5 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">2. Generate Proof</h2>
        <p className="text-gray-400 mb-4 text-sm">
          Generate a privacy-preserving zero-knowledge proof. 
          Only the selected data will be disclosed to the Registry.
        </p>
        <div className="h-10 w-full">
            <Button 
                onClick={generateProof} 
                statusButton={isGeneratingProof ? "pending" : selectedFields.length === 0 ? "disabled" : "idle"}
            >
            Generate ZK Proof
            </Button>
        </div>
        {proof && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded flex items-center">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mr-2" />
                <span className="text-green-300">Proof Generated Successfully</span>
            </div>
        )}
      </div>

      <div className="bg-white/5 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">3. Submit to Registry</h2>
        <div className="h-10 w-full">
            <Button 
                onClick={submitToRegistry} 
                statusButton={(!proof || isPending || isConfirming) ? "disabled" : "idle"}
            >
            {isPending ? "Confirming..." : isConfirming ? "Verifying..." : "Submit Verification"}
            </Button>
        </div>
        
        {hash && (
            <div className="mt-4 text-center">
                <a 
                    href={`https://etherscan.io/tx/${hash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm"
                >
                    View Transaction
                </a>
            </div>
        )}
        
        {isConfirmed && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mr-2" />
                <span className="text-green-300">Verified & Registered!</span>
            </div>
        )}
        
        {writeError && (
             <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded flex items-center">
                <XCircleIcon className="w-6 h-6 text-red-500 mr-2" />
                <span className="text-red-300 text-sm">Error: {writeError.message}</span>
            </div>
        )}
      </div>
      
      {isConfirming && <LoadingBox />}
    </div>
  );
}
