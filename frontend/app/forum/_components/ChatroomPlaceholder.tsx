import { Lock } from 'lucide-react';

export function ChatroomPlaceholder() {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
      <Lock className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
      <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
        These chatrooms are based on the XMTP Web3 Messaging Protocol. They are encrypted and only viewable once a wallet connection is established.
      </p>
    </div>
  );
}
