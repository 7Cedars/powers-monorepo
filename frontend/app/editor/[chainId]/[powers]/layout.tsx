'use client'

import React, { useState, useEffect } from "react";
import { useParams, usePathname, useRouter } from 'next/navigation';
import { setStatus, setError, setAction, useActionStore, usePowersStore, useSavedProtocolsStore } from "@/context/store";
import { ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import { AllFlows } from './AllFlows'; 
import { useConnection, usePublicClient, useSwitchChain } from "wagmi";
import { usePowers } from "@/hooks/usePowers";
import { parseChainId } from "@/utils/parsers"; 

interface EditorLayoutProps {
  children: React.ReactNode;
}

const SidePanel = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState(670)
  const [isResizing, setIsResizing] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { chainId, powers } = useParams<{ chainId: string, powers: string }>()

  // Load saved panel width from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidePanelWidth')
    if (savedWidth) {
      const width = parseInt(savedWidth, 10)
      if (width >= 300 && width <= 1200) {
        setPanelWidth(width)
      }
    }
  }, [])

  // Handle resize mouse events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      // Calculate new width based on distance from right edge
      const newWidth = window.innerWidth - e.clientX
      
      // Clamp between min (300px) and max (1200px or 90vw)
      const maxWidth = Math.min(1200, window.innerWidth * 0.9)
      const clampedWidth = Math.max(300, Math.min(newWidth, maxWidth))
      
      setPanelWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false)
        // Save to localStorage when resize completes
        localStorage.setItem('sidePanelWidth', panelWidth.toString())
      }
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      // Prevent text selection during resize
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    } else {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing, panelWidth])
  
  // Navigation items
  const navItems = [
    { label: 'Home', path: `/editor/${chainId}/${powers}/home` },
    { label: 'Actions', path: `/editor/${chainId}/${powers}/actions` },
    { label: 'Mandates', path: `/editor/${chainId}/${powers}/mandates` },
    { label: 'Roles', path: `/editor/${chainId}/${powers}/roles` },
    { label: 'Treasury', path: `/editor/${chainId}/${powers}/treasury` },
  ]
  
  // Check if current page matches nav item
  const isActive = (path: string) => {
    if (!isCollapsed) {
      return pathname.includes(path)
    }
    return false
  }
  
  // Handle navigation button click
  const handleNavClick = (path: string) => {
    if (isActive(path)) {
      // If clicking the active button, collapse the panel
      setIsCollapsed(true)
    } else {
      // Navigate to the page and expand if collapsed
      if (isCollapsed) {
        setIsCollapsed(false)
      }
      router.push(path)
    }
  }
 
  return (
    <div 
      className={`fixed top-0 right-0 h-screen flex flex-row z-5 ${
        isResizing ? '' : 'transition-all duration-300 ease-in-out'
      }`}
      style={{
        width: isCollapsed ? '36px' : `${panelWidth}px`,
      }}
      help-nav-item="right-panel"
    >
      {/* Vertical Navigation Buttons - always visible on the left edge of the panel */}
      <div 
        className="h-full flex-shrink-0 bg-background border-border flex flex-col items-center justify-start py-6 relative"
        style={{
          width: '36px',
          minWidth: '36px',
          gap: '88px'
        }}
      >
        {/* Collapse/Expand Button */}

        {/* Resize Handle - positioned on the right edge of navigation bar */}
        {!isCollapsed && (
          <div
            className="absolute right-0 top-0 h-full w-[2px] cursor-col-resize hover:bg-foreground bg-muted transition-colors z-20"
            onMouseDown={(e) => {
              e.preventDefault()
              setIsResizing(true)
            }}
            title="Drag to resize panel"
          >
            {/* Extended hit area for easier grabbing */}
            <div className="absolute inset-y-0 -left-1 -right-1 w-3" />
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="relative transition-all bg-foreground/10 text-foreground hover:bg-foreground hover:text-background border border-foreground/30 hover:border-foreground flex items-center justify-center z-30"
          style={{
            width: '36px',
            height: '36px',
            flexShrink: 0,
          }}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <ChevronDoubleRightIcon 
            className="w-5 h-5 transition-colors font-mono text-[10px] uppercase tracking-wider border border-border transition-transform duration-300"
            style={{
              transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          />
        </button>
        {
        navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`
                relative transition-colors font-mono text-[10px] uppercase tracking-wider border border-border
                ${active 
                  ? 'text-background bg-foreground border-foreground' 
                  : 'bg-muted/30 text-muted-foreground hover:bg-foreground/20'
                }
              `}
              style={{
                width: '120px',
                height: '36px',
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Panel Content */}
      <div 
        className={`flex flex-col transition-opacity duration-200 bg-background overflow-hidden ${
          isCollapsed 
            ? 'opacity-0 delay-0' 
            : 'opacity-100 delay-200'
        }`}
        style={{
          width: isCollapsed ? '0px' : `${panelWidth - 36}px`,
          height: '100vh'
        }}  
      >
        <div className="w-full h-full overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function EditorLayout({ children }: EditorLayoutProps) {
  const pathname = usePathname(); 
  const { fetchPowers } = usePowers(); 
  const action = useActionStore();
  const powers = usePowersStore(); 
  const { powers: powersAddress, chainId } = useParams<{ chainId: string, powers: string }>(); 

    // Load powers instance if not loaded yet
  useEffect(() => {
    if (powersAddress && chainId) {
      if (powers.contractAddress == undefined || powers.contractAddress == `0x0` || powers.contractAddress != powersAddress) {
        fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId));
      }
    }
  }, [powersAddress, chainId, fetchPowers])

  console.log('@EditorLayout rendered:', {powersAddress, chainId, action, powers})

  // reset status, error, and action when pathname changes
  useEffect(() => {
    setError({error: null})
    setStatus({status: "idle"})
  }, [pathname, action])

  return (  
    <div className="min-h-full bg-background relative z-0">
      {/* Background PowersFlow - fills entire screen as ground layer */}
      <div 
        className="fixed top-0 left-0 w-full h-full bg-background z-0" 
        style={{ boxShadow: 'inset 8px 0 16px -8px rgba(0, 0, 0, 0.1)' }}
      >
        { chainId && powersAddress &&
          <AllFlows 
          key={`powers-flow`} 
        />
        }
      </div>
      
      {/* Side Panel - positioned on the left */}
      <SidePanel>
        {children}
      </SidePanel>
    </div>
  )
}