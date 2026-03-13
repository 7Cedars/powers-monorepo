'use client'
 
import { useState } from 'react'; 
import { ChatBubbleLeftIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { usePowersStore } from '@/context/store';

const MANDATE_DATA = {
  id: 1,
  role: 3,
  lastActive: 42
};

export default function MandatePage() {
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [params, setParams] = useState(['', '', '']);
  const [anchorHashes, setAnchorHashes] = useState(['']);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const powers = usePowersStore();

  const mandate = MANDATE_DATA;

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines font-mono">
      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
            <div>
              <p className="text-muted-foreground text-sm">Mandate #{mandate.id}</p>
              <h3 className="text-foreground text-base">[MANDATE NAME]</h3>
            </div>
            <span className="text-xs text-muted-foreground">Role {mandate.role}</span>
          </div>

          {/* More Details + Start Action Row */}
          <div className="border-b border-border flex flex-col sm:flex-row">
            {/* More Details - Left */}
            <div className="flex-1 p-4 overflow-y-auto sm:border-r border-b sm:border-b-0 border-border" style={{ maxHeight: '180px' }}>
              {/* <div className="flex items-center gap-2 mb-3"> */}
                {/* <FileText className="h-3 w-3 text-muted-foreground" /> */}
                {/* <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4> */}
              {/* </div> */}
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
              </p>
              
            </div>
            {/* Start a New Action - Right */}
            <div className="p-4 flex items-center justify-center sm:w-80 shrink-0">
              {
              <button
                onClick={() => {setParams(['', '', '']);setAnchorHashes(['']);setActionDialogOpen(true);}}
                className="flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground px-6 py-3 rounded hover:opacity-80 transition-opacity">
                
                  <PlusIcon className="h-4 w-4" />
                  <h4 className="text-sm uppercase tracking-wider">Start a New Action</h4>
                </button>
              }
            </div>
          </div>

          {/* Mandate Chatroom */}
          {/* Here need to add chat room */}
        
      {/* Start a New Action Dialog */}
      {actionDialogOpen &&
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setActionDialogOpen(false)}>
          <div className="bg-background border border-border rounded-lg w-full max-w-md mx-4 p-6 font-mono relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setActionDialogOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <XMarkIcon className="h-4 w-4" />
            </button>

            <h3 className="text-sm text-foreground mb-2">Start a New Action</h3>
            <p className="text-xs text-muted-foreground mb-5">Please input the params and if needed, paste the relevant anchor hashes</p>

            <div className="space-y-3 mb-5">
              {params.map((val, i) =>
            <div key={i}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Param {i + 1}</label>
                  <input
                type="text"
                value={val}
                onChange={(e) => {const next = [...params];next[i] = e.target.value;setParams(next);}}
                className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
                placeholder={`Enter param ${i + 1}...`} />
              
                </div>
            )}
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Anchor Hashes</label>
                <button onClick={() => setAnchorHashes([...anchorHashes, ''])} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <PlusIcon className="h-3 w-3" />
                </button>
              </div>
              {anchorHashes.map((val, i) =>
            <input
              key={i}
              type="text"
              value={val}
              onChange={(e) => {const next = [...anchorHashes];next[i] = e.target.value;setAnchorHashes(next);}}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
              placeholder={`Anchor hash ${i + 1}...`} />

            )}
            </div>

            <button onClick={() => setSubmitConfirmOpen(true)} className="terminal-btn-sm w-full">
              Submit
            </button>
          </div>
        </div>
      }
      </div>
      </main>
      </div>
  )


      {/* Submit Confirmation Dialog
      {submitConfirmOpen &&
      <div className="fixed inset-0 z-[250] bg-black/80" />
      }
      <AlertDialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>    
        <AlertDialogContent className="font-mono bg-background border-border z-[300]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirm Submission</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will submit a new action. This is a <span className="font-bold text-foreground">blockchain transaction</span> and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {setSubmitConfirmOpen(false);setActionDialogOpen(false);}} className="text-xs">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>); */}

}