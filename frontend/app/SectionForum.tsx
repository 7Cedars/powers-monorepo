"use client";

export function SectionForum() {
  return (
    <section id="forum" className="w-full flex flex-col items-center px-4 bg-background border-t border-border py-16">
      <div className="w-full max-w-3xl flex flex-col gap-6 items-center text-center">

        <div className="font-mono font-bold text-foreground md:text-4xl text-2xl uppercase tracking-wider">
          How does the forum work?
        </div>

        <div className="font-mono text-muted-foreground text-sm leading-relaxed">
          The forum is your organisation's governance workspace. Connect your wallet to see the mandates your role gives you access to. From there, you can propose new actions, vote on active proposals, and execute decisions that have passed their required checks — all without leaving the page.
        </div>

        <div className="font-mono text-muted-foreground text-sm leading-relaxed">
          Every action in the forum follows the same lifecycle: it is proposed, deliberated on, and only executable once all preconditions defined by the mandate are met. This might mean a voting period has closed, a veto window has passed, or a prior action in the flow has been fulfilled.
        </div>

        <div className="font-mono text-muted-foreground text-sm leading-relaxed">
          The forum also includes an embedded XMTP chat layer, so members can discuss proposals in context — directly alongside the governance action it relates to.
        </div>

        <div className="font-mono text-muted-foreground text-sm leading-relaxed">
          No admin keys. No off-chain handshakes. Every decision is on-chain and auditable from the moment it is proposed.
        </div>

        {/* Video placeholder */}
        <div className="w-full aspect-video bg-muted/30 border border-border flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full border border-muted-foreground/40 flex items-center justify-center">
            <div className="w-0 h-0 ml-1" style={{ borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '14px solid hsl(var(--muted-foreground))' }} />
          </div>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Video coming soon</span>
        </div>

      </div>
    </section>
  );
}