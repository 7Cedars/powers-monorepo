"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, useConnection } from "wagmi";
import { ZKPassport, ProofResult } from "@zkpassport/sdk";
import { parseEther, keccak256, toHex, encodeAbiParameters, parseAbiParameters, encodeFunctionData } from "viem";
import { Button } from "../../components/Button";
import { LoadingBox } from "../../components/LoadingBox";
import { getInitialisedAddress } from "../../organisations/helpers";
import { CheckCircleIcon, XCircleIcon, ExclamationCircleIcon, QrCodeIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import ZKPassportPowersRegistry from "../../context/builds/ZKPassport_PowersRegistry.json";
import QRCode from "react-qr-code";
import { ConnectButton } from "../../components/ConnectButton";
import { TwoSeventyRingWithBg } from "react-svg-spinners";
import build from "next/dist/build";

// Simple Input Component matching project style (light theme)
const SimpleInput = ({ value, onChange, placeholder, className = "" }: { value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) => (
  <div className={`w-full flex text-sm items-center  bg-white border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent ${className}`}>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent focus:outline-none "
      placeholder={placeholder}
    />
  </div>
);

const AVAILABLE_FIELDS = [
  { id: "name", label: "Name (First & Last)", fields: ["firstname", "lastname"] },
  { id: "nationality", label: "Nationality", fields: ["nationality"] },
  { id: "issuing_country", label: "Issuing Country", fields: ["issuing_country"] },
  { id: "gender", label: "Gender", fields: ["gender"] },
  { id: "birthdate", label: "Birth Date", fields: ["birthdate"] },
  // { id: "expiration_date", label: "Expiry Date", fields: ["expiration_date"] },
  { id: "facematch", label: "FaceMatch", fields: [] },
];

export default function VerificationPage() {
  const { address, isConnected } = useConnection();
  const chainId = useChainId();
  const switchChain = useSwitchChain();
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const targetChainId = 11155111; // Sepolia

  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [proof, setProof] = useState<any>(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [isRequestReceived, setIsRequestReceived] = useState(false);
  const [queryUrl, setQueryUrl] = useState("");
  const [deployedMandates, setDeployedMandates] = useState<Record<string, `0x${string}`>>({});
  
  const zkPassportRef = useRef<ZKPassport | null>(null);

  useEffect(() => {
    const fetchPowered = async () => {
      try {
        const response = await fetch(`/powered/${chainId}.json`);
        if (!response.ok) {
            console.warn(`Failed to fetch powered data for chain ${chainId}`);
            return;
        }
        const data = await response.json();
        setDeployedMandates(data.mandates || {});
      } catch (error) {
        console.error('Error loading powered data:', error);
      }
    };
    
    if (chainId) {
        fetchPowered();
    }
  }, [chainId]);

  useEffect(() => {
    if (!zkPassportRef.current) {
      zkPassportRef.current = new ZKPassport("https://powers-git-develop-7cedars-projects.vercel.app/verification");
    }
  }, []);

  useEffect(() => {
    // Reset proof and query URL when selected fields change
    setProof(null);
    setQueryUrl("");
    setIsGeneratingProof(false);
    setIsRequestReceived(false);
  }, [selectedFields]);

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const generateProof = async () => {
    if (!zkPassportRef.current) return;
    
    // setIsGeneratingProof(true); // Don't set this here, wait for callback
    setQueryUrl("");
    setProof(null);
    setIsRequestReceived(false);
    
    try {
      const queryBuilder = await zkPassportRef.current.request({
        name: "Powers Protocol",
        logo: "https://powers.7cedars.xyz/logo1_notext.png",
        purpose: "Verify identity for governance participation",
        scope: "powers",
        mode: "compressed-evm",
        devMode: true, // Assuming dev mode based on example
      });

      // Dynamically add disclosure requirements
      let builder: any = queryBuilder;
      
      // Always disclose document_type for contract verification
      // builder = builder.disclose("document_type");

      selectedFields.forEach(fieldId => {
          const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
          if (field) {
              if (field.id === "facematch") {
                  builder = builder.facematch();
              } else {
                  field.fields.forEach(fieldName => {
                      builder = builder.disclose(fieldName);
                  });
              }
          }
      });
      // builder.disclose("facematch"); // Always request facematch for enhanced verification 
      builder.disclose("document_type"); // Always disclose document type for on-chain verification logic
      builder.bind("user_address", address);
      builder.bind("chain", "ethereum_sepolia");
      builder.bind("custom_data", "");
      
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
        setIsRequestReceived(true);
      });

      onGeneratingProof(() => {
        console.log("Generating proof");
        setIsGeneratingProof(true);
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
    if (!zkPassportRef.current) return;

    let registryAddress: `0x${string}`;
    try {
      registryAddress = getInitialisedAddress("ZKPassport_PowersRegistry", deployedMandates);
    } catch (e) {
      console.error("Registry address not found:", e);
      alert("ZKPassport Registry contract not found for this network. Please switch to a supported network.");
      return;
    }

    try {
        const params = zkPassportRef.current.getSolidityVerifierParameters({
          proof: proofResult,
          scope: "powers",
          devMode: true,
        });

        console.log({verificationParams: params});
        
        writeContract({
          address: registryAddress,
          abi: ZKPassportPowersRegistry.abi,
          functionName: "registerProof", 
          args: [params, isIDCard],
        });
    } catch (error) {
        console.error("Error preparing verification:", error);
        alert("Error preparing verification parameters.");
    }
  };

  return (
    <section className="min-h-screen w-full flex flex-col justify-start items-center px-4 bg-gradient-to-b from-indigo-600 to-slate-50 sm:pt-16 pt-4 pb-20 overflow-y-auto">
      <div className="w-full flex flex-col gap-12 justify-start items-center max-w-4xl">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-50">ZKPassport Verification</h1>
          <p className="text-xl text-slate-100 max-w-2xl">
            Prove your identity privacy-preservingly using ZKPassport.
          </p>
        </div>

        {/* Main Content Card */}
        <div className="w-full bg-white border border-slate-200  shadow-sm overflow-hidden max-w-6xl">
          
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">Identity Verification</h2>
            <div className="flex items-center gap-2">
                {isConnected && address && (
                    <span className="text-sm text-slate-600">
                        {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                )}
                <span className={`h-2.5 w-2.5  ${isConnected ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                <span className="text-sm text-slate-600 hidden sm:inline">
                    {isConnected ? 'Wallet Connected' : 'Wallet Not Connected'}
                </span>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-8">
            
            {!isConnected ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 bg-slate-100 ">
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
            ) : chainId !== targetChainId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 bg-yellow-50 ">
                   <ExclamationCircleIcon className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-700">Wrong Network</h3>
                <p className="text-slate-500 max-w-sm">Please switch to Sepolia testnet to continue.</p>
                <div className="pt-2">
                  <Button onClick={() => switchChain.mutate({ chainId: targetChainId })}>
                    Switch to Sepolia
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col lg:flex-row gap-8 pb-4">
                  {/* Step 1: Configuration */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center  bg-indigo-100 text-indigo-600 font-bold text-sm">1</div>
                      <h3 className="text-lg font-medium text-slate-800">Select Data to Disclose</h3>
                    </div>
                    
                    <div className="ml-11 space-y-4">
                      <p className="text-slate-600 text-sm">
                          Select the information you want to verify and disclose on-chain. The zero-knowledge proof ensures only this data is revealed.
                      </p>
                      
                      <div className="bg-slate-50 p-4  border border-slate-200 space-y-4 h-full">
                        <div className="grid gap-3 grid-cols-1 h-full content-start">
                          {/* Always selected Proof of Uniqueness button */}
                          <button 
                            className="p-3  border text-sm font-medium transition-colors text-left flex items-center justify-between bg-indigo-600 text-white border-indigo-600 shadow-sm cursor-default"
                            title="This field is required for verification"
                          >
                            Proof of Uniqueness
                            <CheckCircleIcon className="w-5 h-5 text-white ml-2" />
                          </button>

                          {AVAILABLE_FIELDS.map((field) => (
                            <button 
                              key={field.id}
                              onClick={() => handleFieldToggle(field.id)}
                              className={`p-3  border text-sm font-medium transition-colors text-left flex items-center justify-between group ${
                                selectedFields.includes(field.id) 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                              }`}
                            >
                              {field.label}
                              {selectedFields.includes(field.id) && (
                                <CheckCircleIcon className="w-5 h-5 text-white ml-2" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divider for mobile / Spacer for desktop */}
                  <div className="block lg:hidden h-px bg-slate-100 w-full my-4"></div>

                  {/* Step 2: Proof Generation */}
                  <div className="flex-1 flex flex-col space-y-4">
                    <div className="flex items-center gap-3 mb-2 shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center  bg-indigo-100 text-indigo-600 font-bold text-sm">2</div>
                      <h3 className="text-lg font-medium text-slate-800">Generate Proof</h3>
                    </div>
                    
                    <div className="ml-11 flex flex-col flex-grow space-y-4">
                    <p className="text-slate-600 text-sm shrink-0">
                      Scan the QR code with your ZKPassport mobile app to generate the proof.
                    </p>
                    
                    {/* Integrated QR Code / Button Area */}
                    <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px] flex-grow">
                        {!queryUrl && !isGeneratingProof && !proof && !isRequestReceived && (
                           <button 
                             onClick={generateProof}
                             className="group relative flex flex-col items-center justify-center w-full h-full min-h-[300px] border-2 border-dashed  transition-all duration-200 border-indigo-300 bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-400 cursor-pointer"
                           >
                              <div className="p-4 bg-white  shadow-sm mb-3 group-hover:scale-105 transition-transform duration-200">
                                <QrCodeIcon className="w-8 h-8 text-indigo-600" />
                              </div>
                              <span className="text-sm font-semibold text-indigo-600">
                                Create QR Code
                              </span>
                              <span className="text-xs text-slate-400 mt-1 max-w-[160px] text-center">
                                Click to generate a unique QR code
                              </span>
                           </button>
                        )}

                        {queryUrl && !proof && !isRequestReceived && !isGeneratingProof && (
                            <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px] p-6 bg-white ">
                                <QRCode value={queryUrl} size={300} />
                                <div className="mt-4 flex items-center gap-2">
                                  <p className="text-slate-600 text-sm font-medium">Scan with ZKPassport App</p>
                                </div>
                            </div>
                        )}

                        {isRequestReceived && !isGeneratingProof && !proof && (
                            <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px] bg-yellow-50 border border-yellow-200  shadow-sm text-center p-6 animate-in fade-in zoom-in duration-300">
                                <div className="p-4 bg-white  shadow-sm mb-4">
                                   <TwoSeventyRingWithBg className="w-8 h-8 text-yellow-600 animate-spin" />
                                </div>
                                <h4 className="text-lg font-semibold text-yellow-900 mb-1">Request Received</h4>
                                <p className="text-sm text-yellow-700">Please follow instructions on your device...</p>
                            </div>
                        )}

                        {isGeneratingProof && !proof && (
                            <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px] bg-yellow-50 border border-yellow-200  shadow-sm text-center p-6 animate-in fade-in zoom-in duration-300">
                                <div className="p-4 bg-white  shadow-sm mb-4">
                                   <TwoSeventyRingWithBg className="w-8 h-8 text-yellow-600 animate-spin" />
                                </div>
                                <h4 className="text-lg font-semibold text-yellow-900 mb-1">Generating Proof</h4>
                                <p className="text-sm text-yellow-700">This may take a few moments...</p>
                            </div>
                        )}

                        {proof && (
                            <div className="w-full h-full min-h-[300px] p-6 bg-green-50 border border-green-200  flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="p-3 bg-white  shadow-sm mb-3">
                                  <CheckCircleIcon className="w-8 h-8 text-green-500" />
                                </div>
                                <h4 className="text-lg font-semibold text-green-900 mb-1">Proof Generated!</h4>
                                <p className="text-sm text-green-700">Your zero-knowledge proof can now be submitted.</p>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
                </div>

                {/* Step 3: Submission Status */}
                <div className="space-y-4 pt-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center  bg-indigo-100 text-indigo-600 font-bold text-sm">3</div>
                    <h3 className="text-lg font-medium text-slate-800">Registry Submission</h3>
                  </div>
                  
                  <div className="ml-11 space-y-3">
                    {!isPending && !isConfirming && !hash && !isConfirmed && !writeError && (
                       <div className="p-4 bg-slate-50 border border-slate-200  flex items-center">
                           <div className="w-5 h-5 mr-3 flex-shrink-0  border-2 border-slate-300"></div>
                           <span className="text-slate-500 text-sm">Waiting for proof generation...</span>
                       </div>
                    )}

                    {isPending && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200  flex items-center gap-2">
                            <TwoSeventyRingWithBg className="w-5 h-5 text-yellow-600 mr-3 animate-spin" />
                            <span className="text-yellow-800">Please confirm the transaction in your wallet...</span>
                        </div>
                    )}

                    {isConfirming && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200  flex items-center gap-2">
                            <TwoSeventyRingWithBg className="w-5 h-5 text-yellow-600 mr-3 animate-spin" />
                            <span className="text-yellow-800">Your zero-knowledge proof is being submitted...</span>
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
                        <div className="p-4 bg-green-50 border border-green-200  flex items-center">
                            <CheckCircleIcon className="w-6 h-6 text-green-600 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-green-800 font-medium">Verified & Registered!</p>
                              <p className="text-green-700 text-sm mt-1">Your identity has been successfully verified on-chain.</p>
                            </div>
                        </div>
                    )}
                    
                    {writeError && (
                        <div className="p-4 bg-red-50 border border-red-200  flex items-start overflow-hidden">
                            <XCircleIcon className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-red-800 font-medium">Transaction Failed</p>
                              <p className="text-red-700 text-sm mt-1 break-words whitespace-pre-wrap">{writeError.message}</p>
                            </div>
                        </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-red-50 border-t border-red-100 p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            <div className="flex-shrink-0 bg-red-100 p-2 ">
              <ExclamationCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-red-900">Privacy Warning</h4>
              <p className="text-sm text-red-700">
                Any data you choose to disclose will be publicly available on-chain and linked to your wallet address as long as Ethereum Sepolia remains active. 
                Be selective in what you choose to disclose.
              </p>
            </div>
          </div>

        </div>


      </div>
      
      {/* Global loading overlay if needed, though we handle loading states inline now */}
      {/* {isConfirming && <LoadingBox />} */}
    </section>
  );
}
