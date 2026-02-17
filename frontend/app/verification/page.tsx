"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ZKPassport, ProofResult } from "@zkpassport/sdk";
import { parseEther, keccak256, toHex, encodeAbiParameters, parseAbiParameters, encodeFunctionData } from "viem";
import { Button } from "../../components/Button";
import { LoadingBox } from "../../components/LoadingBox";
import { CheckCircleIcon, XCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import ZKPassportPowersRegistry from "../../context/builds/ZKPassport_PowersRegistry.json";
import QRCode from "react-qr-code";
import { ConnectButton } from "../../components/ConnectButton";
import { TwoSeventyRingWithBg } from "react-svg-spinners";

// Simple Input Component matching project style (light theme)
const SimpleInput = ({ value, onChange, placeholder, className = "" }: { value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) => (
  <div className={`w-full flex text-sm items-center rounded-md bg-white border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent ${className}`}>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent focus:outline-none rounded-md"
      placeholder={placeholder}
    />
  </div>
);

const AVAILABLE_FIELDS = [
  { id: "name", label: "Name (First & Last)", fields: ["firstname", "lastname"] },
  { id: "nationality", label: "Nationality", fields: ["nationality"] },
  { id: "issuing_country", label: "Issuing Country", fields: ["issuing_country"] },
  { id: "gender", label: "Gender", fields: ["gender"] },
  { id: "birth_date", label: "Birth Date", fields: ["birth_date"] },
  { id: "expiration_date", label: "Expiry Date", fields: ["expiration_date"] },
];

export default function VerificationPage() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [proof, setProof] = useState<any>(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [queryUrl, setQueryUrl] = useState("");
  // Hardcoded dummy address for Powers registry
  const [registryAddress, setRegistryAddress] = useState("0x1234567890123456789012345678901234567890");
  
  const zkPassportRef = useRef<ZKPassport | null>(null);

  useEffect(() => {
    if (!zkPassportRef.current) {
      zkPassportRef.current = new ZKPassport();
    }
  }, []);

  useEffect(() => {
    // Reset proof and query URL when selected fields change
    setProof(null);
    setQueryUrl("");
  }, [selectedFields]);

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const generateProof = async () => {
    if (!zkPassportRef.current) return;
    
    setIsGeneratingProof(true);
    setQueryUrl("");
    setProof(null);
    
    try {
      const queryBuilder = await zkPassportRef.current.request({
        name: "Powers Protocol",
        logo: "https://powers.7cedars.xyz/logo1_notext.png",
        purpose: "Verify identity for governance participation",
        scope: "powers",
        devMode: true, // Assuming dev mode based on example
      });

      // Dynamically add disclosure requirements
      let builder: any = queryBuilder;
      
      // Always disclose document_type for contract verification
      builder = builder.disclose("document_type");

      selectedFields.forEach(fieldId => {
          const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
          if (field) {
              field.fields.forEach(fieldName => {
                  builder = builder.disclose(fieldName);
              });
          }
      });
      
      const {
        url,
        onRequestReceived,
        onGeneratingProof,
        onProofGenerated,
        onResult,
        onError,
      } = builder.done();

      setQueryUrl(url);

      onRequestReceived(() => {
        console.log("QR code scanned");
      });

      onGeneratingProof(() => {
        console.log("Generating proof");
      });

      let generatedProof: ProofResult | null = null;

      onProofGenerated((result: ProofResult) => {
        console.log("Proof result", result);
        generatedProof = result;
        setProof(result);
        setIsGeneratingProof(false);
      });
      
      onResult(async ({ result, uniqueIdentifier, verified, queryResultErrors }: any) => {
          console.log("Result of the query", result);
          if (generatedProof && verified) {
              const isIDCard = result.document_type?.disclose?.result !== "passport";
              verifyOnChain(generatedProof, isIDCard);
          }
      });

      onError((error: unknown) => {
        console.error("Error", error);
        alert("Proof generation failed. See console for details.");
        setIsGeneratingProof(false);
      });

    } catch (err) {
      console.error("Proof generation failed:", err);
      alert("Proof generation failed. See console for details.");
      setIsGeneratingProof(false);
    }
  };

  const verifyOnChain = (proofResult: ProofResult, isIDCard: boolean) => {
    if (!registryAddress || !zkPassportRef.current) return;

    try {
        const params = zkPassportRef.current.getSolidityVerifierParameters({
          proof: proofResult,
          scope: "powers",
          devMode: true,
        });
        
        writeContract({
          address: registryAddress as `0x${string}`,
          abi: ZKPassportPowersRegistry.abi,
          functionName: "register", // Updated to match contract function name if it was register, checking... ABI has register or verifyAndRegister?
          args: [params, isIDCard],
        });
    } catch (error) {
        console.error("Error preparing verification:", error);
        alert("Error preparing verification parameters.");
    }
  };

  return (
    <section className="min-h-screen flex flex-col justify-start items-center px-4 snap-start snap-always bg-gradient-to-b from-slate-100 to-slate-50 sm:pt-16 pt-4 pb-20">
      <div className="w-full flex flex-col gap-8 justify-start items-center max-w-4xl">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-600">ZKPassport Verification</h1>
          <p className="text-xl text-slate-500 max-w-2xl">
            Prove your identity privacy-preservingly using ZKPassport to participate in governance.
          </p>
        </div>

        {/* Main Content Card */}
        <div className="w-full bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
          
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">Identity Verification</h2>
            <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                <span className="text-sm text-slate-600">{isConnected ? 'Wallet Connected' : 'Wallet Not Connected'}</span>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-8">
            
            {!isConnected ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 bg-slate-100 rounded-full">
                   <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                   </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-700">Connect Wallet Required</h3>
                <p className="text-slate-500 max-w-sm">Please connect your wallet to start the verification process.</p>
                <div className="pt-2">
                  <ConnectButton />
                </div>
              </div>
            ) : (
              <>
                {/* Step 1: Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">1</div>
                    <h3 className="text-lg font-medium text-slate-800">Select Data to Disclose</h3>
                  </div>
                  
                  <div className="ml-11 space-y-4">
                    <p className="text-slate-600 text-sm">
                        Select the information you want to verify and disclose on-chain. The zero-knowledge proof ensures only this data is revealed.
                    </p>
                    
                    <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Registry Address</label>
                        <SimpleInput 
                            value={registryAddress} 
                            onChange={setRegistryAddress} 
                            placeholder="0x..." 
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {AVAILABLE_FIELDS.map((field) => (
                          <label key={field.id} className="flex items-center space-x-3 p-3 bg-white border border-slate-200 rounded cursor-pointer hover:border-indigo-300 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedFields.includes(field.id)}
                              onChange={() => handleFieldToggle(field.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-slate-700">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Proof Generation */}
                <div className="space-y-4 border-t border-slate-100 pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">2</div>
                    <h3 className="text-lg font-medium text-slate-800">Generate Proof</h3>
                  </div>
                  
                  <div className="ml-11 space-y-4">
                    <p className="text-slate-600 text-sm">
                      Scan the QR code with your ZKPassport mobile app to generate the proof.
                    </p>
                    
                    <div className="w-full sm:w-fit">
                        <Button 
                            onClick={generateProof} 
                            statusButton={isGeneratingProof ? "pending" : selectedFields.length === 0 ? "disabled" : "idle"}
                        >
                        {isGeneratingProof ? "Generating..." : "Generate ZK Proof"}
                        </Button>
                    </div>
                    
                    {queryUrl && !proof && (
                        <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-lg shadow-sm max-w-sm mx-auto">
                            <QRCode value={queryUrl} size={200} />
                            <p className="mt-4 text-slate-600 text-sm text-center font-medium">Scan with ZKPassport App</p>
                        </div>
                    )}

                    {proof && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-md flex items-center">
                            <CheckCircleIcon className="w-6 h-6 text-green-600 mr-3 flex-shrink-0" />
                            <span className="text-green-800 font-medium">Proof Generated Successfully</span>
                        </div>
                    )}
                  </div>
                </div>

                {/* Step 3: Submission Status */}
                {(isPending || isConfirming || hash || isConfirmed || writeError) && (
                  <div className="space-y-4 border-t border-slate-100 pt-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">3</div>
                      <h3 className="text-lg font-medium text-slate-800">Registry Submission</h3>
                    </div>
                    
                    <div className="ml-11 space-y-3">
                      {isPending && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md flex items-center">
                              <TwoSeventyRingWithBg className="w-5 h-5 text-blue-600 mr-3 animate-spin" />
                              <span className="text-blue-800">Please confirm the transaction in your wallet...</span>
                          </div>
                      )}

                      {isConfirming && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md flex items-center">
                              <TwoSeventyRingWithBg className="w-5 h-5 text-blue-600 mr-3 animate-spin" />
                              <span className="text-blue-800">Verifying transaction on-chain...</span>
                          </div>
                      )}
                      
                      {hash && (
                          <div className="text-sm">
                              <a 
                                  href={`https://etherscan.io/tx/${hash}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center"
                              >
                                  View Transaction on Etherscan
                                  <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                              </a>
                          </div>
                      )}
                      
                      {isConfirmed && (
                          <div className="p-4 bg-green-50 border border-green-200 rounded-md flex items-center">
                              <CheckCircleIcon className="w-6 h-6 text-green-600 mr-3 flex-shrink-0" />
                              <div>
                                <p className="text-green-800 font-medium">Verified & Registered!</p>
                                <p className="text-green-700 text-sm mt-1">Your identity has been successfully verified on-chain.</p>
                              </div>
                          </div>
                      )}
                      
                      {writeError && (
                          <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
                              <XCircleIcon className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-red-800 font-medium">Transaction Failed</p>
                                <p className="text-red-700 text-sm mt-1">{writeError.message}</p>
                              </div>
                          </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="text-center max-w-2xl">
           <p className="text-sm text-slate-400">
             This verification process uses zero-knowledge proofs to ensure your personal data remains private. 
             Only the specific attributes you choose to disclose are verified on-chain.
           </p>
        </div>
      </div>
      
      {/* Global loading overlay if needed, though we handle loading states inline now */}
      {/* {isConfirming && <LoadingBox />} */}
    </section>
  );
}
