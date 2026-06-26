'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { SparklesIcon, ClipboardDocumentListIcon, ArrowsRightLeftIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { SingleFlow } from '@/components/SingleFlow'
import { Chatroom } from '../[actionId]/Chatroom'
import { usePowersStore, useActionStore, useErrorStore, useStatusStore, setAction, setError, setStatus } from '@/context/store'
import { DynamicInput } from './DynamicInput'
import { SimulationBox } from '@/components/SimulationBox'
import { SubmitButton } from './SubmitButton'
import { ForumModal } from '@/components/ForumModal'
import { SelectActionDialog, SelectedActionInfo } from './SelectActionDialog'
import { Action, InputType, Mandate } from '@/context/types'
import { parseMandateError, parseParamValues } from '@/utils/parsers'
import { decodeAbiParameters, encodeAbiParameters, parseAbiParameters } from 'viem'
import { hashAction } from '@/utils/hashAction'
import { useWallets } from '@privy-io/react-auth'
import { useMandate } from '@/hooks/useMandate'
import { useChecks } from '@/hooks/useChecks'
import { useEffectiveAddress } from '@/hooks/useEffectiveAddress'
import { bigintToRole } from '@/utils/bigintTo'
import { cn } from '@/utils/utils'

const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

export default function NewActionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>()
  const mandateIdParam = searchParams.get('mandateId')

  const powers = usePowersStore()
  const action = useActionStore()
  const error = useErrorStore()
  const status = useStatusStore()
  const { wallets, ready } = useWallets()
  const { simulation, simulate, request, propose } = useMandate()
  const { checks, fetchChecks } = useChecks()
  const effectiveAddress = useEffectiveAddress()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSelectInput, setShowSelectInput] = useState(false)
  const [activeInfoTab, setActiveInfoTab] = useState<'conditions' | 'flow' | 'chat'>('conditions')
  const [chatroomMode, setChatroomMode] = useState<'mandate' | 'flow'>('mandate')

  // Powers is fetched by the layout, not this page - on a direct/refreshed
  // navigation the store is still empty on first render, and the layout
  // resets `status` to 'idle' on every pathname change (even once this org
  // is already cached). So "loading" only while genuinely pending, or while
  // 'idle' AND this org's data isn't cached yet - not just because the
  // pathname changed after the data was already loaded.
  const isLoadingPowers =
    status.status === 'pending' ||
    (status.status === 'idle' && powers.contractAddress !== powersAddress)

  // Redirect to org home if powers failed to load
  useEffect(() => {
    if (isLoadingPowers) return
    if (!powers?.name || powers.contractAddress === '0x0' || powers.contractAddress === undefined) {
      router.push(`/forum/${chainId}/${powersAddress}`)
    }
  }, [isLoadingPowers, powers, router, chainId, powersAddress])

  const mandate: Mandate | undefined = useMemo(
    () => powers.mandates?.find(m => m.index.toString() === mandateIdParam),
    [powers.mandates, mandateIdParam]
  )

  // Redirect if mandate not found, once the fetch has settled
  useEffect(() => {
    if (isLoadingPowers) return
    if (powers?.name && mandateIdParam && !mandate) {
      router.push(`/forum/${chainId}/${powersAddress}`)
    }
  }, [isLoadingPowers, powers?.name, mandate, mandateIdParam, router, chainId, powersAddress])

  const params = mandate?.params || []
  const dataTypes = params.map(p => p.dataType)

  const mandateFlow = useMemo(() => {
    if (!mandate || !powers.flows) return undefined
    return powers.flows.find(flow =>
      flow.mandateIds.some(id => id.toString() === mandate.index.toString())
    )
  }, [mandate, powers.flows])

  const flowContextId = useMemo(() => {
    if (!mandateFlow) return undefined
    return mandateFlow.mandateIds[0]?.toString()
  }, [mandateFlow])

  // Flow actions for "Select Input" feature
  const flowActions = useMemo(() => {
    if (!mandate || !powers?.flows || !powers?.mandates) return []
    const targetFlow = powers.flows.find(flow => flow.mandateIds.includes(mandate.index))
    if (!targetFlow) return []
    const flowMandateIds = new Set(targetFlow.mandateIds.filter(id => id !== mandate.index))
    const actions: any[] = []
    powers.mandates.forEach(m => {
      if (flowMandateIds.has(m.index) && m.actions) {
        m.actions.forEach(a => {
          const blockNumbers = [a.proposedAt || 0n, a.requestedAt || 0n, a.fulfilledAt || 0n, a.cancelledAt || 0n].filter(bn => bn > 0n)
          const highestBlockNumber = blockNumbers.length > 0 ? blockNumbers.reduce((max, bn) => bn > max ? bn : max, 0n) : 0n
          if (highestBlockNumber > 0n) actions.push({ ...a, highestBlockNumber })
        })
      }
    })
    actions.sort((a, b) => (a.highestBlockNumber > b.highestBlockNumber ? -1 : 1))
    return actions.slice(0, 25)
  }, [powers, mandate])

  // Initialize form when mandate loads
  useEffect(() => {
    if (!mandate) return
    if (!action.paramValues || action.paramValues.length !== params.length) {
      setAction({
        ...action,
        mandateId: mandate.index,
        dataTypes,
        paramValues: params.map(p => {
          const isArray = p.dataType.indexOf('[]') > -1
          if (p.dataType.indexOf('string') > -1) return isArray ? [''] : ''
          if (p.dataType.indexOf('bool') > -1) return isArray ? [false] : false
          return isArray ? [0] : 0
        }),
        nonce: BigInt(Math.floor(Math.random() * 1000000000000000000000000)).toString(),
        description: '',
        upToDate: false,
      })
    }
  }, [mandate])

  // Decode callData if present
  useEffect(() => {
    if (!action.callData || action.callData === '0x0' || action.upToDate || dataTypes.length === 0) return
    try {
      const values = decodeAbiParameters(parseAbiParameters(dataTypes.toString()), action.callData as `0x${string}`)
      const valuesParsed = parseParamValues(values)
      setAction({ ...action, paramValues: valuesParsed.length === dataTypes.length ? valuesParsed : action.paramValues, upToDate: true })
    } catch {
      setAction({ ...action, upToDate: true })
    }
  }, [mandate?.index, action.callData])

  // Navigate to action page on success
  useEffect(() => {
    if (status.status === 'success' && isSubmitting && action.actionId) {
      const timer = setTimeout(() => {
        router.push(`/forum/${chainId}/${powersAddress}/${action.actionId}`)
        setStatus({ status: 'idle' })
        setError({ error: null })
        setIsSubmitting(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [status.status, isSubmitting, action.actionId, router, chainId, powersAddress])

  const handleChange = useCallback((input: InputType | InputType[], index: number) => {
    const current = action.paramValues ? [...action.paramValues] : []
    current[index] = input
    setAction({ ...action, paramValues: current, upToDate: false })
  }, [action])

  const handleSimulate = useCallback(async () => {
    if (!mandate) return
    setError({ error: null })

    const sanitizedValues = mandate.params?.map((p, i) => {
      const val = action.paramValues?.[i]
      const isArray = p.dataType.indexOf('[]') > -1
      if (val === undefined) {
        if (p.dataType.indexOf('string') > -1) return isArray ? [''] : ''
        if (p.dataType.indexOf('bool') > -1) return isArray ? [false] : false
        return isArray ? [0] : 0
      }
      return val
    }) ?? []

    let callData: `0x${string}` = '0x0'
    if (sanitizedValues.length > 0) {
      try {
        callData = encodeAbiParameters(
          parseAbiParameters(mandate.params?.map(p => p.dataType).toString() || ''),
          sanitizedValues
        )
      } catch (err) {
        setError({ error: err as Error })
        return
      }
    }

    if (ready && wallets && powers?.contractAddress) {
      await fetchChecks(mandate, callData, BigInt(action.nonce as string), wallets, powers)
      const actionId = hashAction(mandate.index, callData, BigInt(action.nonce as string)).toString()
      const newAction: Action = {
        ...action, actionId, state: 0, mandateId: mandate.index,
        caller: effectiveAddress ?? '0x0', dataTypes: mandate.params?.map(p => p.dataType),
        paramValues: sanitizedValues, nonce: action.nonce, description: action.description,
        callData, upToDate: true,
        proposedAt: undefined, requestedAt: undefined, fulfilledAt: undefined, cancelledAt: undefined,
      }
      setAction(newAction)
      try {
        await simulate(effectiveAddress ?? '0x0', newAction.callData as `0x${string}`, BigInt(newAction.nonce as string), mandate)
      } catch (err) {
        setError({ error: err as Error })
      }
    }
  }, [action, mandate, ready, wallets, powers, fetchChecks, simulate, effectiveAddress])

  const handleSubmit = useCallback(async () => {
    if (!action.callData || !powers || !action.nonce || !mandate) return
    setIsSubmitting(true)
    try {
      if (needsVote || needsProposalFirst) {
        await propose(mandate.index, action.callData as `0x${string}`, BigInt(action.nonce), action.description || '', powers)
      } else {
        await request(mandate, action.callData as `0x${string}`, BigInt(action.nonce), action.description || '', powers)
      }
    } catch (err) {
      setError({ error: err as Error })
      setIsSubmitting(false)
    }
  }, [action, mandate, powers, propose, request])

  const handleSelectAction = useCallback((info: SelectedActionInfo) => {
    const selected = flowActions.find(a => a.actionId === info.actionId)
    if (!selected?.callData) return
    try {
      const values = decodeAbiParameters(parseAbiParameters(dataTypes.toString()), selected.callData as `0x${string}`)
      const valuesParsed = parseParamValues(values)
      setAction({ ...action, mandateId: mandate!.index, callData: selected.callData, nonce: selected.nonce, paramValues: valuesParsed, dataTypes, upToDate: false })
      setShowSelectInput(false)
    } catch (err) {
      setError({ error: err as Error })
      setShowSelectInput(false)
    }
  }, [flowActions, dataTypes, mandate, action])

  if (!mandate) {
    if (isLoadingPowers) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground text-sm font-mono">Loading mandate...</p>
        </div>
      )
    }
    return null
  }

  const needsVote = !!(mandate.conditions?.quorum && mandate.conditions.quorum > 0n)
  const needsProposalFirst = !needsVote && !!(mandate.conditions?.timelock && BigInt(mandate.conditions.timelock) > 0n)
  const canSubmit = action.upToDate && checks && (() => {
    if (needsVote || needsProposalFirst) {
      return checks.authorised === true && checks.throttlePassed === true && checks.actionNotFulfilled === true
    }
    return checks.allPassed === true
  })()

  const mandateName = mandate.nameDescription?.split(':')[0] ?? `Mandate #${mandate.index}`
  const mandateDesc = mandate.nameDescription?.split(':').slice(1).join(':').trim()
  const roleName = bigintToRole(mandate.conditions?.allowedRole ?? 0n, powers)
  const allowedRole = mandate.conditions?.allowedRole !== undefined ? BigInt(mandate.conditions.allowedRole) : 0n
  const isPublicRole = allowedRole === PUBLIC_ROLE

  return (
    <div className="flex-1 flex flex-col bg-background scanlines font-mono">
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 sm:px-4 py-4 gap-4 overflow-y-auto">
        <div className="flex-1 flex flex-col">
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
            <h3 className="text-foreground text-sm truncate">New Action — #{mandate.index.toString()} {mandateName}</h3>
            {mandateDesc && <p className="text-muted-foreground text-xs line-clamp-5">{mandateDesc}</p>}
          </div>

          {/* Info tab nav */}
          <div className="flex bg-muted/50 border-b border-border overflow-x-auto">
            {([
              { id: 'conditions', label: 'Conditions', icon: ClipboardDocumentListIcon },
              { id: 'flow',       label: 'Flow',       icon: ArrowsRightLeftIcon },
              { id: 'chat',       label: 'Chat',       icon: ChatBubbleLeftRightIcon },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveInfoTab(tab.id)}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeInfoTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active tab title — small screens only */}
          <div className="sm:hidden flex items-center px-6 py-2 border-b border-border">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {{ conditions: 'Conditions', flow: 'Flow', chat: 'Chat' }[activeInfoTab]}
            </span>
          </div>

          {/* Info tab content */}
          {activeInfoTab === 'conditions' && (
            <div className="px-6 py-4 border-b border-border">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-foreground">{roleName}</span>
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
              </div>
            </div>
          )}

          {activeInfoTab === 'flow' && (
            <div className="h-[280px] border-b border-border">
              <SingleFlow mandateId={mandate.index} />
            </div>
          )}

          {activeInfoTab === 'chat' && (
            <div className="border-b border-border">
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
            </div>
          )}

          {/* Input section header */}
          <div className="flex items-center px-6 py-2 border-b border-border bg-muted/50">
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider">INPUT</h4>
          </div>

          <div className="p-4 px-1 space-y-6">

            {/* Select Input from flow */}
            {flowActions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSelectInput(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-2 text-sm uppercase tracking-wider bg-foreground text-background hover:bg-foreground/80 transition-colors cursor-pointer"
              >
                Select Input from Flow
              </button>
            )}

            {/* Form */}
            <form onSubmit={e => e.preventDefault()} className="space-y-4">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider min-w-24">Description</label>
                <input
                  type="text"
                  value={action.description}
                  className="flex-1 bg-background border border-border px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors font-mono"
                  placeholder="Enter description of action (or uri) here."
                  onChange={e => setAction({ ...action, description: e.target.value, upToDate: false })}
                />
              </div>

              {params.map((param, index) => (
                <DynamicInput
                  key={index}
                  dataType={param.dataType}
                  varName={param.varName}
                  index={index}
                  values={action.paramValues?.[index] !== undefined ? action.paramValues[index] : ''}
                  onChange={input => handleChange(input, index)}
                />
              ))}

              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider min-w-24">Nonce</label>
                <input
                  type="number"
                  value={action.nonce}
                  className="flex-1 bg-background border border-border px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors font-mono"
                  placeholder="Enter random number..."
                  onChange={e => setAction({ ...action, nonce: e.target.value, upToDate: false })}
                />
                <button
                  type="button"
                  className="h-9 w-9 flex items-center justify-center bg-background border border-border hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => setAction({ ...action, nonce: BigInt(Math.floor(Math.random() * 1000000000000000000000000)).toString(), upToDate: false })}
                >
                  <SparklesIcon className="h-4 w-4" />
                </button>
              </div>

              {error.error && (
                <div className="w-full text-xs text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 px-3 py-2">
                  Failed check: {parseMandateError(error)}
                </div>
              )}

              {(!action.upToDate || checks === undefined) && (
                <button
                  type="button"
                  onClick={handleSimulate}
                  className={cn(
                    'w-full border border-border px-1 py-2.5 text-xs text-foreground',
                    'bg-muted/10 hover:bg-muted/50 hover:border-foreground/40 transition-colors cursor-pointer',
                    'uppercase tracking-wider font-mono'
                  )}
                >
                  Run Checks
                </button>
              )}
            </form>

            {simulation && action?.upToDate && (
              <SimulationBox mandate={mandate} simulation={simulation} chainId={Number(chainId)} />
            )}

            <SubmitButton
              canSubmit={canSubmit ?? false}
              onSubmit={handleSubmit}
              status={status.status}
              isSubmitting={isSubmitting}
              needsVote={needsVote || needsProposalFirst}
              showFallback={action.upToDate}
              checks={checks}
            />
          </div>
        </div>
      </main>

      <SelectActionDialog
        open={showSelectInput}
        onOpenChange={setShowSelectInput}
        onSelect={handleSelectAction}
        actions={flowActions}
      />
    </div>
  )
}
