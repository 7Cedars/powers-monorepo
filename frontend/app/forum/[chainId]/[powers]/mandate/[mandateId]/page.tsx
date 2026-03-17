'use client'
 
import { useState } from 'react'; 
import { PlusIcon } from "@heroicons/react/24/outline";
import { usePowersStore } from '@/context/store';
import { useParams } from 'next/dist/client/components/navigation';
import { Mandate } from '@/context/types';
import { bigintToRole } from '@/utils/bigintTo';
import { NewActionDialog } from './NewActionDialog';
import { Chatroom } from '@/app/forum/_components/Chatroom';

export default function MandatePage() {
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const powers = usePowersStore();
  const { chainId, powers: powersAddress, mandateId } = useParams<{ chainId: string; powers: string; mandateId: string }>();
  const mandate: Mandate | undefined =  powers?.mandates?.find(m => m.index.toString() === mandateId);
  const numberOfRoleMembers = mandate?.conditions?.allowedRole ? powers?.roles?.find(r => r.roleId.toString() === mandate?.conditions?.allowedRole.toString())?.amountHolders : 0;
   

  return (
    <div className="flex-1 flex flex-col bg-background scanlines font-mono">
      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
            <div>
              <h3 className="text-foreground text-base"> {mandate?.nameDescription ? mandate.nameDescription.split(':')[0] || '' : ''}</h3>
              <p className="text-muted-foreground text-sm">Mandate #{mandate?.index}</p>
            </div>
            <span className="text-xs text-right text-muted-foreground"> 
              <p> {bigintToRole(BigInt(mandate?.conditions?.allowedRole?.toString() || '0'), powers)} </p>
            </span>
          </div>

          {/* More Details + Start Action Row */}
          <div className="border-b border-border flex flex-col sm:flex-row">
            {/* More Details - Left */}
            <div className="flex-1 p-4 overflow-y-auto sm:border-r border-b sm:border-b-0 border-border" style={{ maxHeight: '180px' }}>
              {/* <div className="flex items-center gap-2 mb-3"> */}
                {/* <FileText className="h-3 w-3 text-muted-foreground" /> */}
                {/* <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4> */}
              {/* </div> */}
              <p className="px-2 text-sm text-muted-foreground leading-relaxed">
                {mandate?.nameDescription ? mandate.nameDescription.split(':')[1] || '' : ''}
              </p>
              
            </div>
            {/* Start a New Action - Right */}
            <div className="p-4 flex items-center justify-center sm:w-80 shrink-0">
              <button
                onClick={() => setActionDialogOpen(true)}
                className="flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground px-6 py-3 rounded hover:opacity-80 transition-opacity"
              >
                <PlusIcon className="h-4 w-4" />
                <h4 className="text-sm uppercase tracking-wider">Start a New Action</h4>
              </button>
            </div>
          </div>

          <Chatroom chatroomType="Mandate" />
        </div>
      </main>

      {/* New Action Dialog */}
      {mandate && (
        <NewActionDialog
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          mandate={mandate}
        />
      )}
    </div>
  );

}