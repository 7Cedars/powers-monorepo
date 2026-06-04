'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePowersStore } from '@/context/store'
import { Action, Mandate } from '@/context/types'
import { Chatroom } from '@/components/Chatroom'
import { Vote } from './Vote'
import { ActionOverview } from './ActionOverview'
import { PastVotes } from './PastVotes'
import { setAction, useActionStore } from '@/context/store'
import { Timeline } from './Timeline'
import { TimelockExecute } from './TimelockExecute'
import { SingleFlow } from '@/components/SingleFlow'
import { ExecutionTab } from '@/components/forum/ExecutionTab'
import { bigintToRole } from '@/utils/bigintTo'

const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

type Tab = 'action' | 'timeline' | 'conditions' | 'votes' | 'timelock' | 'execution' | 'flow'
type ChatroomMode = 'mandate' | 'flow'

export default function ActionPage() {
  const router = useRouter()
  const { chainId, powers: powersAddress, actionId } = useParams<{ chainId: string; powers: string; actionId: string }>()
  const powers = usePowersStore()
  const action = useActionStore()

  const [activeTab, setActiveTab] = useState<Tab>('action')
  const [chatroomMode, setChatroomMode] = useState<ChatroomMode>('mandate')
  const [isLoading, setIsLoading] = useState(true)
  const [hoverReady, setHoverReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHoverReady(true), 2000)
    return () => clearTimeout(t)
  }, [])

  // Redirect to overview page if powers data is not loaded yet
  useEffect(() => {
    if (!powers?.name || powers.contractAddress === '0x0' || powers.contractAddress === undefined) {
      router.push(`/forum/${chainId}/${powersAddress}`)
    }
  }, [powers, router, chainId, powersAddress])

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

  const buildTabs = (): { id: Tab; label: string }[] => {
    const tabs: { id: Tab; label: string }[] = [
      { id: 'action',   label: 'Action' },
      { id: 'conditions', label: 'Conditions' },
      { id: 'timeline',  label: 'Timeline' },
    ]
    if (hasVoting)      tabs.push({ id: 'votes',     label: 'Votes' })
    if (hasTimelockOnly) tabs.push({ id: 'timelock', label: 'Timelock' })
    tabs.push({ id: 'execution', label: 'Execution' })
    tabs.push({ id: 'flow',      label: 'Flow' })
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
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Banner with overlay */}
          <div
            className={`aspect-[2/1] relative overflow-hidden flex-shrink-0 cursor-default${hoverReady ? ' group' : ''}`}
            style={{
              backgroundImage: powers?.metadatas?.banner ? `url(${powers.metadatas.banner})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-background/80 group-hover:bg-background/15 transition-all duration-500" />
            <div className="absolute bottom-0 left-0 right-0 px-6 py-4 group-hover:opacity-0 transition-opacity duration-500">
              <h3 className="text-foreground text-sm truncate">
                #{mandate?.index?.toString()} {mandate?.nameDescription ? mandate.nameDescription.split(':')[0] : ''}
              </h3>
              <p className="text-muted-foreground text-xs truncate">
                {mandate?.nameDescription ? mandate.nameDescription.split(':')[1]?.trim() || '' : ''}
              </p>
            </div>
          </div>

          {/* Tab nav — underline style, matching forum main page */}
          <div className="flex bg-muted/50 border-b border-border overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
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
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-foreground">{bigintToRole(allowedRole, powers)}</span>
                </div>
                {mandate.conditions?.quorum != null && BigInt(mandate.conditions.quorum) !== 0n && (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Quorum</span>
                      <span className="text-foreground">{mandate.conditions.quorum.toString()}%</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Succeed At</span>
                      <span className="text-foreground">{mandate.conditions?.succeedAt?.toString() ?? '0'}%</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Voting Period</span>
                      <span className="text-foreground">{mandate.conditions?.votingPeriod?.toString() ?? '0'} blocks</span>
                    </div>
                  </>
                )}
                {mandate.conditions?.timelock != null && BigInt(mandate.conditions.timelock) !== 0n && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Timelock</span>
                    <span className="text-foreground">{mandate.conditions.timelock.toString()} blocks</span>
                  </div>
                )}
                {mandate.conditions?.throttleExecution != null && BigInt(mandate.conditions.throttleExecution) !== 0n && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Throttle</span>
                    <span className="text-foreground">{mandate.conditions.throttleExecution.toString()} blocks</span>
                  </div>
                )}
                {mandate.conditions?.needFulfilled != null && BigInt(mandate.conditions.needFulfilled) !== 0n && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Need Fulfilled</span>
                    <span className="text-foreground">#{mandate.conditions.needFulfilled.toString()}</span>
                  </div>
                )}
                {mandate.conditions?.needNotFulfilled != null && BigInt(mandate.conditions.needNotFulfilled) !== 0n && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Need Not Fulfilled</span>
                    <span className="text-foreground">#{mandate.conditions.needNotFulfilled.toString()}</span>
                  </div>
                )}
              </div>
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

            {activeTab === 'execution' && (
              <ExecutionTab currentAction={action} currentMandate={mandate} />
            )}

            {activeTab === 'flow' && (
              <div className="-mx-6 -my-6">
                <div className="h-[320px]">
                  <SingleFlow mandateId={mandate.index} actionId={BigInt(action.actionId)} />
                </div>
              </div>
            )}
          </div>

          {/* Chatroom */}
          <div className="mt-6 border-t border-border">
            {chatroomMode === 'mandate' || !mandateFlow ? (
              <Chatroom
                chatroomType="Mandate"
                isPublicRole={isPublicRole}
                chainId={chainId}
                powersAddress={powersAddress}
                contextId={mandate.index.toString()}
                xmtpAgentAddress={powers.metadatas?.xmtpAgentAddress}
                tabs={mandateFlow ? [
                  { label: 'Mandate', active: true,  onClick: () => setChatroomMode('mandate') },
                  { label: 'Flow',     active: false, onClick: () => setChatroomMode('flow') },
                ] : undefined}
              />
            ) : (
              <Chatroom
                chatroomType="Flow"
                isPublicRole={isPublicRole}
                chainId={chainId}
                powersAddress={powersAddress}
                contextId={flowContextId}
                xmtpAgentAddress={powers.metadatas?.xmtpAgentAddress}
                tabs={[
                  { label: 'Mandate', active: false, onClick: () => setChatroomMode('mandate') },
                  { label: 'Flow',     active: true,  onClick: () => setChatroomMode('flow') },
                ]}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
