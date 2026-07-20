'use client'

import { useRouter } from 'next/navigation'
import { usePowersStore } from '@/context/store'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

interface OrgBannerProps {
  title: string
  subtitle: string
  backButton?: { label: string; href: string }
}

export function OrgBanner({ title, subtitle, backButton }: OrgBannerProps) {
  const powers = usePowersStore()
  const router = useRouter()

  return (
    <div className="flex flex-col pt-16">
      <div
        className="h-64 relative overflow-hidden flex-shrink-0"
        style={{
          backgroundImage: powers?.metadatas?.banner ? `url(${powers.metadatas.banner})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: powers?.metadatas?.banner ? undefined : 'hsl(var(--muted))',
        }}
      >
      </div>

      <div className="px-4 py-2 border-b border-border bg-muted/50">
        <p className="font-mono text-base uppercase tracking-wider text-foreground truncate">{title}</p>
        <p className="font-mono text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>

      {backButton && (
        <div className="px-4 py-2 border-b border-border">
          <button
            onClick={() => router.push(backButton.href)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            <span>{backButton.label}</span>
          </button>
        </div>
      )}
    </div>
  )
}
