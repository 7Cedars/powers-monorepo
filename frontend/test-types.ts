import { wagmiConfig } from './context/wagmiConfig'
import { getPublicClient } from 'wagmi/actions'
import { powersAbi } from './context/abi'

async function test() {
  const client = getPublicClient(wagmiConfig, { chainId: 1 })
  if (!client) return

  const logs = await client.getContractEvents({
    address: '0x123',
    abi: powersAbi,
    fromBlock: 0n,
    toBlock: 1n
  })

  for (const log of logs) {
    console.log(log.eventName, log.args)
  }
}
