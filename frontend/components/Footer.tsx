"use client";

import { HeartIcon } from '@heroicons/react/24/outline';
import Image from 'next/image'
import { DiscordIcon, TelegramIcon, GithubIcon } from '@/components/MetadataLinks';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Footer() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <section id="page-footer" className="w-full bg-background border-t border-border py-8 font-mono">
      <div className="max-w-4xl mx-auto px-4 flex flex-col gap-8 items-center text-center">

        {/* Brand */}
        <div className="flex flex-col gap-3 items-center">
          <Image src='/logo1_notext.png' width={64} height={64} alt="Powers Protocol" />
          <div className="text-sm text-foreground flex items-center gap-1">
            <span>Made with</span>
            <HeartIcon className="w-3 h-3 text-red-600" />
            <span>by Publius Projects</span>
          </div>
          <div className="flex gap-3">
            <a href="https://discordapp.com/users/1006928106487021638" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <DiscordIcon className="w-4 h-4" />
            </a>
            <a href="https://t.me/thd83" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <TelegramIcon className="w-4 h-4" />
            </a>
            <a href="https://github.com/7Cedars" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <GithubIcon className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Inline label strips */}
        <div className="border-t border-border pt-6 flex flex-col gap-2 items-center">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-xs font-bold text-foreground mr-2">dApp</span>
            <a href="/" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Home</a>
            <span className="text-xs text-muted-foreground">·</span>
            <a href="/forum" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Forum</a>
            <span className="text-xs text-muted-foreground">·</span>
            <a href="/overview" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Overview</a>
            <span className="text-xs text-muted-foreground">·</span>
            <a
              href="/#deploy" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                if (pathname === '/') {
                  document.getElementById('deploy')?.scrollIntoView({ behavior: 'smooth' });
                  window.history.pushState(null, '', '/#deploy');
                } else {
                  router.push('/#deploy');
                }
              }}
            >
              Deploy
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-xs font-bold text-foreground mr-2">Protocol</span>
            <a href="https://powers-docs.vercel.app/for-developers/litepaper" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Litepaper</a>
            <span className="text-xs text-muted-foreground">·</span>
            <a href="https://powers-docs.vercel.app/welcome" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Docs</a>
            <span className="text-xs text-muted-foreground">·</span>
            <a href="https://github.com/7Cedars/powers/tree/main/solidity" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Github</a>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="border-t border-border pt-6 flex justify-center">
          <ThemeToggle />
        </div>

      </div>
    </section>

  )
}
