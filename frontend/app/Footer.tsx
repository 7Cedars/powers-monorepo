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
    <section className="w-full flex flex-col justify-between items-center min-h-fit bg-background snap-end py-6 border-t border-border snap-end">
        
        <div className="max-w-7xl w-full flex md:flex-row flex-col justify-between items-center md:items-start text-foreground text-sm px-4 gap-8 md:gap-16 font-mono">
            <div className="grid md:grid-cols-2 grid-cols-2 gap-8 md:gap-28">
                <div className="flex flex-col gap-3 justify-start items-start">
                    <div className="font-bold uppercase tracking-wider text-xs"> 
                        DApp
                    </div>
                    <a
                        href={`/`} rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                    >
                        Home
                    </a> 
                       <a
                        href={`/forum`} rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                    >
                        Forum
                    </a>  
                       <a
                        href={`/editor`} rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                    >
                        Editor
                    </a>                  
                    
                     <a
                        href={`/#deploy`} rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            if (pathname === '/') {
                                // Already on home page, just scroll
                                const deploySection = document.getElementById('deploy');
                                if (deploySection) {
                                    deploySection.scrollIntoView({ behavior: 'smooth' });
                                }
                                window.history.pushState(null, '', '/#deploy');
                            } else {
                                // Navigate to home page with hash
                                router.push('/#deploy');
                            }
                        }}
                    >
                        Deploy
                    </a> 

                </div>
                <div className="flex flex-col gap-3 justify-start items-start">
                    <div className="font-bold uppercase tracking-wider text-xs"> 
                        Protocol
                    </div>
                    <a
                        href={`https://powers-docs.vercel.app/for-developers/litepaper`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                    >
                        Litepaper
                    </a>
                    <a
                        href={`https://powers-docs.vercel.app/welcome`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                    >
                        Docs
                    </a>
                    <a
                        href={`https://github.com/7Cedars/powers/tree/main/solidity`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                    >
                        Github repo
                    </a>
                </div>
            </div>
                        
        <div className="flex flex-row gap-3 justify-center items-center">
            <div className="flex flex-col gap-3 justify-start items-center">
            <Image 
            src='/logo1_notext.png' 
            width={48}
            height={48}
            alt="Logo Separated Powers"
            >
            </Image>
            <div className="text-sm font-bold flex flex-row gap-1">
                <p>Made with</p> 
                <HeartIcon className="w-4 h-4 text-red-700" />
                <p>by 7Cedars</p>
            </div>
            <div className="flex flex-row gap-2">
                <a
                    href={`https://discordapp.com/users/1006928106487021638`} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <DiscordIcon className="w-5 h-5" /> 
                </a>
                <a
                    href={`https://t.me/thd83`} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <TelegramIcon className="w-5 h-5" />
                </a>
                <a
                    href={`https://github.com/7Cedars`} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <GithubIcon className="w-5 h-5" />
                </a>
            </div>
            </div>
        </div>

        <div className="flex items-center">
            <ThemeToggle />
        </div>
    </div> 
  </section>

  )
}
