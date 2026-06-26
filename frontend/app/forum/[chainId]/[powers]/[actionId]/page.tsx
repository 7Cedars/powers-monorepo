'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePowersStore, useStatusStore } from '@/context/store'
import { Action, Mandate } from '@/context/types'
import { Chatroom } from './Chatroom'
import { Vote } from './Vote'
import { ActionOverview } from './ActionOverview'
import { PastVotes } from './PastVotes'
import { setAction, useActionStore } from '@/context/store'
import { Timeline } from './Timeline'
import { TimelockExecute } from './TimelockExecute'
import { SingleFlow } from '@/components/SingleFlow'
import { DependenciesTab } from './DependenciesTab'
import { ConditionsTab } from './ConditionsTab'
import { DocumentTextIcon, ClipboardDocumentListIcon, ClockIcon, HandRaisedIcon, LockClosedIcon, PlayIcon, ArrowsRightLeftIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'

const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

type Tab = 'action' | 'timeline' | 'conditions' | 'votes' | 'timelock' | 'dependencies' | 'flow' | 'chat'
type ChatroomMode = 'mandate' | 'flow'

export default function ActionPage() {
  const router = useRouter()
  const { chainId, powers: powersAddress, actionId } = useParams<{ chainId: string; powers: string; actionId: string }>()
  const powers = usePowersStore()
  const action = useActionStore()
  const status = useStatusStore()

  const [activeTab, setActiveTab] = useState<Tab>('action')
  const [chatroomMode, setChatroomMode] = useState<ChatroomMode>('mandate')
  const [isLoading, setIsLoading] = useState(true)

  // Powers is fetched by the layout, not this page - on a direct/refreshed
  // navigation the store is still empty on first render. Only treat it as
  // "failed to load" once the layout's fetch has actually settled, mirroring
  // app/forum/[chainId]/[powers]/new/page.tsx's isLoadingPowers guard.
  const isLoadingPowers =
    status.status === 'pending' ||
    (status.status === 'idle' && powers.contractAddress !== powersAddress)

  // Redirect to overview page if powers data failed to load
  useEffect(() => {
    if (isLoadingPowers) return
    if (!powers?.name || powers.contractAddress === '0x0' || powers.contractAddress === undefined) {
      router.push(`/forum/${chainId}/${powersAddress}`)
    }
  }, [isLoadingPowers, powers, router, chainId, powersAddress])

  // Fall back to "not found" after 15s if action never arrives via websocket
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 15000)
    return () => clearTimeout(timer)
  }, [])

  const [mandate, setMandate] = useState<Mandate | undefined>()

  useEffect(() => {
    if (powers.mandates && actionId) {
      for (const m of powers.mandates) {
        if (m.actions) {
          const foundAction = m.actions.find(a => a.actionId === actionId)
          if (foundAction) {
            setAction(foundAction)
            setMandate(m)
            setIsLoading(false)
            break
          }
        }
      }
    }
  }, [powers.mandates, actionId])

  const hasVoting = (mandate?.conditions?.quorum ? BigInt(mandate.conditions.quorum) : 0n) > 0n
  const hasTimelockOnly =
    !hasVoting && (mandate?.conditions?.timelock ? BigInt(mandate.conditions.timelock) : 0n) > 0n

  const allowedRole = mandate?.conditions?.allowedRole !== undefined
    ? BigInt(mandate.conditions.allowedRole) : 0n
  const isPublicRole = allowedRole === PUBLIC_ROLE

  // Is this mandate part of a flow?
  const mandateFlow = useMemo(() => {
    if (!mandate || !powers.flows) return undefined
    return powers.flows.find(flow =>
      flow.mandateIds.some(id => id.toString() === mandate.index.toString())
    )
  }, [mandate, powers.flows])

  // Context ID for the flow chatroom — first mandate ID in the flow
  const flowContextId = useMemo(() => {
    if (!mandateFlow) return undefined
    return mandateFlow.mandateIds[0]?.toString()
  }, [mandateFlow])

  const buildTabs = (): { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] => {
    const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
      { id: 'action',     label: 'Action',     icon: DocumentTextIcon },
      { id: 'conditions', label: 'Conditions', icon: ClipboardDocumentListIcon },
      { id: 'timeline',   label: 'Timeline',   icon: ClockIcon },
    ]
    if (hasVoting)       tabs.push({ id: 'votes',     label: 'Votes',     icon: HandRaisedIcon })
    if (hasTimelockOnly) tabs.push({ id: 'timelock',  label: 'Timelock',  icon: LockClosedIcon })
    tabs.push({ id: 'dependencies', label: 'Dependencies', icon: PlayIcon })
    tabs.push({ id: 'flow',      label: 'Flow',      icon: ArrowsRightLeftIcon })
    tabs.push({ id: 'chat',      label: 'Chat',      icon: ChatBubbleLeftRightIcon })
    return tabs
  }

  const tabs = buildTabs()

  if (!action?.actionId || !mandate) {
    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col bg-background scanlines font-mono">
          <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 sm:px-4 py-4 gap-4">
            <div className="flex-1 flex flex-col border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
                <h3 className="text-foreground uppercase tracking-wider text-base">Loading Action...</h3>
              </div>
              <div className="p-6 flex flex-col items-center justify-center min-h-[300px] gap-4">
                <p className="text-muted-foreground text-xs animate-pulse">Waiting for transaction to be indexed...</p>
              </div>
            </div>
          </main>
        </div>
      )
    }
    return (
      <div className="flex-1 flex flex-col bg-background scanlines font-mono">
        <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 sm:px-4 py-4 gap-4">
          <div className="flex-1 flex flex-col border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
              <h3 className="text-foreground uppercase tracking-wider text-base">Action Not Found</h3>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[300px] gap-4">
              <p className="text-muted-foreground">The requested action could not be found.</p>
              <p className="text-muted-foreground text-xs text-center max-w-sm">
                If the action removed the mandate it belonged to, it will no longer appear here — the action succeeded, but the mandate (and its history) is gone.
              </p>
              <button
                onClick={() => router.push(`/forum/${chainId}/${powersAddress}`)}
                className="px-4 py-2 bg-primary text-primary-foreground hover:opacity-80 transition-opacity"
              >
                Return to Forum
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-background scanlines font-mono">
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 sm:px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Banner */}
          <div
            className="aspect-[2/1] flex-shrink-0"
            style={{
              backgroundImage: powers?.metadatas?.banner ? `url(${powers.metadatas.banner})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Description */}
          <div className="px-6 py-3 bg-muted/50">
            <h3 className="font-mono text-foreground text-sm truncate">
              #{mandate?.index?.toString()} {mandate?.nameDescription ? mandate.nameDescription.split(':')[0] : ''}
            </h3>
            <p className="font-mono text-muted-foreground text-xs line-clamp-5">
              {mandate?.nameDescription ? mandate.nameDescription.split(':')[1]?.trim() || '' : ''}
            </p>
          </div>

          {/* Tab nav */}
          <div className="flex bg-muted/50 border-b border-border overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-1 py-4 min-h-0">
            <div className="sm:hidden flex items-center pb-4 border-b border-border mb-4">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {tabs.find(t => t.id === activeTab)?.label}
              </span>
            </div>
            {activeTab === 'action' && (
              <ActionOverview
                action={action}
                mandate={mandate}
                showOutput={false}
                description={action.description}
              />
            )}

            {activeTab === 'timeline' && (
              <div className="max-w-lg">
                <Timeline action={action} mandate={mandate} chainId={chainId} />
              </div>
            )}

            {activeTab === 'conditions' && (
              <ConditionsTab mandate={mandate} allowedRole={allowedRole} powers={powers} chainId={chainId} />
            )}

            {activeTab === 'votes' && hasVoting && (
              <div className="flex flex-col lg:flex-row lg:items-start gap-8">
                <div className="lg:w-80 flex-shrink-0">
                  <Vote action={action} mandate={mandate} />
                </div>
                <div className="flex-1 min-w-0">
                  <PastVotes action={action} mandate={mandate} powers={powers} />
                </div>
              </div>
            )}

            {activeTab === 'timelock' && hasTimelockOnly && (
              <div className="max-w-lg">
                <TimelockExecute action={action} mandate={mandate} />
              </div>
            )}

            {activeTab === 'dependencies' && (
              <DependenciesTab currentAction={action} currentMandate={mandate} />
            )}

            {activeTab === 'flow' && (
              <div className="h-[320px]">
                <SingleFlow mandateId={mandate.index} actionId={BigInt(action.actionId)} />
              </div>
            )}

            {activeTab === 'chat' && (
              <>
                {chatroomMode === 'mandate' || !mandateFlow ? (
                  <Chatroom
                    key={`mandate-${mandate.index}`}
                    chatroomType="Mandate"
                    isPublicRole={isPublicRole}
                    chainId={chainId}
                    powersAddress={powersAddress}
                    contextId={mandate.index.toString()}
                    xmtpAgentAddress={powers.metadatas?.xmtpAgentAddress}
                    tabs={mandateFlow ? [
                      { label: 'Mandate', active: true,  onClick: () => setChatroomMode('mandate') },
                      { label: 'Flow',    active: false, onClick: () => setChatroomMode('flow') },
                    ] : undefined}
                  />
                ) : (
                  <Chatroom
                    key={`flow-${flowContextId}`}
                    chatroomType="Flow"
                    isPublicRole={isPublicRole}
                    chainId={chainId}
                    powersAddress={powersAddress}
                    contextId={flowContextId}
                    xmtpAgentAddress={powers.metadatas?.xmtpAgentAddress}
                    tabs={[
                      { label: 'Mandate', active: false, onClick: () => setChatroomMode('mandate') },
                      { label: 'Flow',    active: true,  onClick: () => setChatroomMode('flow') },
                    ]}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
