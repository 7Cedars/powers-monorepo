'use client'

import React, { useState, useEffect } from "react";
import { useParams, usePathname, useRouter } from 'next/navigation';
import { setAction, setStatus, setError, useActionStore, usePowersStore, useUIStateStore } from "@/context/store";
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { AllFlows } from './AllFlows'; 
import { usePowers } from "@/hooks/usePowers";
import { parseChainId } from "@/utils/parsers"; 

interface OverviewLayoutProps {
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
    { label: 'Actions', path: `/overview/${chainId}/${powers}/actions` },
    { label: 'Mandates', path: `/overview/${chainId}/${powers}/mandates` },
    { label: 'Flows', path: `/overview/${chainId}/${powers}/flows` },
    { label: 'Roles', path: `/overview/${chainId}/${powers}/roles` },
    { label: 'Treasury', path: `/overview/${chainId}/${powers}/treasury` },
    { label: 'Organisation', path: `/overview/${chainId}/${powers}/organisation` },
  ]
  
  // Check if current page matches nav item
  const isActive = (path: string) => {
    if (!isCollapsed) {
      return pathname.includes(path)
    }
    return false
  }
  
  // Handle navigation button click — always navigate to the overview page for that tab
  const handleNavClick = (path: string) => {
    if (isCollapsed) setIsCollapsed(false)
    router.push(path)
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
        className="h-full flex-shrink-0 bg-background border-border flex flex-col items-center justify-start pt-18 relative"
        style={{
          width: '36px',
          minWidth: '36px',
        }}
      >
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
          className="relative transition-colors font-mono text-[10px] text-center uppercase tracking-wider border border-border bg-muted/50 text-muted-foreground hover:bg-foreground/20 flex items-center justify-center z-30"
          style={{
            width: '36px',
            height: '36px',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <ChevronDownIcon className={`w-3 h-3 transition-transform ${isCollapsed ? 'rotate-180' : 'rotate-0'}`} />
        </button>
        <div className="flex flex-col items-center flex-1 overflow-y-auto" style={{ gap: '88px', paddingTop: '46px', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
        {
        navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`
                relative shrink-0 transition-colors font-mono text-[10px] uppercase tracking-wider border border-border
                ${active
                  ? 'text-background bg-foreground border-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-foreground/20'
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

export default function OverviewLayout({ children }: OverviewLayoutProps) {
  const pathname = usePathname();
  const { fetchPowers } = usePowers();
  const action = useActionStore();
  const powers = usePowersStore();
  const { powers: powersAddress, chainId } = useParams<{ chainId: string, powers: string }>();
  const { clearHighlightMode } = useUIStateStore();

    // Load powers instance if not loaded yet
  useEffect(() => {
    if (powersAddress && chainId) {
      if (powers.contractAddress == undefined || powers.contractAddress == `0x0` || powers.contractAddress != powersAddress) {
        fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId));
      }
    }
  }, [powersAddress, chainId, fetchPowers])

  // reset status, error; clear highlight and action when navigating to a tab overview (not a detail page)
  useEffect(() => {
    setError({error: null})
    setStatus({status: "idle"})
    const isDetailPage = /\/(mandates|actions|roles|flows)\/[^/]+/.test(pathname)
    if (!isDetailPage) {
      clearHighlightMode()
      setAction({ actionId: "0" })
    }
  }, [pathname])

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