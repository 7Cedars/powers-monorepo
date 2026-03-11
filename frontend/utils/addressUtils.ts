export const truncateAddress = (address: string | undefined): string => {
  if (!address) return 'Unknown'
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}


// implement here an ENS resolver? 

