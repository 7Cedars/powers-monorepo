import { create } from 'zustand';
import { Action, CommunicationChannels, Powers, Status } from '../context/types'
import { Governed721DAO, CulturalStewardsDAO, defaultPowers101 } from './defaultProtocols';

// Action Store
type PowersStore = Powers;
const initialStatePowers: PowersStore = {
  contractAddress: `0x0`,
  chainId: 0n,
  name: "",
  uri: "",
  metadatas: {
    icon: "",
    banner: "",
    description: "",
    website: "",
    codeOfConduct: "",
    disputeResolution: "",
    communicationChannels: {} as CommunicationChannels,
    attributes: []
  },
  mandateCount: 0n,
  mandates: [],
  roles: [],
  layout: {}
}

export const usePowersStore = create<PowersStore>()(() => initialStatePowers);

export const setPowers: typeof usePowersStore.setState = (powers) => {
  usePowersStore.setState(powers)
}
export const deletePowers: typeof usePowersStore.setState = () => {
      usePowersStore.setState(initialStatePowers)
}

// Action Store
type ActionStore = Action;
const initialStateAction: ActionStore = {
  actionId: "0",
  mandateId: 0n,
  caller: `0x0`,
  description: "",
  dataTypes: [],
  paramValues: [],
  nonce: "0",
  callData: `0x0`, 
  upToDate: false
}

export const useActionStore = create<ActionStore>()(() => initialStateAction);

export const setAction: typeof useActionStore.setState = (action) => {
  useActionStore.setState(action)
}
export const deleteAction: typeof useActionStore.setState = () => {
      useActionStore.setState(initialStateAction)
}

// Error Store
type ErrorStore = {
  error: Error | string | null
}

const initialStateError: ErrorStore = {
  error: null
}

export const useErrorStore = create<ErrorStore>()(() => initialStateError);

export const setError: typeof useErrorStore.setState = (error) => {
  useErrorStore.setState(error)
}
export const deleteError: typeof useErrorStore.setState = () => {
  useErrorStore.setState(initialStateError)
}


// Status Store
type StatusStore = {
  status: Status
}

const initialStateStatus: StatusStore = {
  status: "idle"
}

export const useStatusStore = create<StatusStore>()(() => initialStateStatus);

export const setStatus: typeof useStatusStore.setState = (status) => {
  useStatusStore.setState(status)
}
export const deleteStatus: typeof useStatusStore.setState = () => {
  useStatusStore.setState(initialStateStatus)
}

// Saved Protocols Store
type SavedProtocolsStore = {
  savedProtocols: Powers[]
  loadSavedProtocols: () => void
  addProtocol: (protocol: Powers) => void
  removeProtocol: (contractAddress: `0x${string}`) => void
  updateProtocol: (contractAddress: `0x${string}`, updates: Partial<Powers>) => void
}

export const useSavedProtocolsStore = create<SavedProtocolsStore>((set, get) => ({
  savedProtocols: [],
  
  loadSavedProtocols: () => {
    try {
      const localStore = localStorage.getItem('powersProtocols')
      let protocols: Powers[] = []
      
      if (localStore && localStore !== 'undefined') {
        protocols = JSON.parse(localStore)
      }

      // Check if default protocols already exist by contract address
      const powers101Exists = protocols.some(
        p => p.contractAddress.toLowerCase() === defaultPowers101.contractAddress.toLowerCase()
      )
      const powersGoverned721Exists = protocols.some(
        p => p.contractAddress.toLowerCase() === Governed721DAO.contractAddress.toLowerCase()
      )
      const culturalStewardsDAOExists = protocols.some(
        p => p.contractAddress.toLowerCase() === CulturalStewardsDAO.contractAddress.toLowerCase()
      )

      if (!powersGoverned721Exists) {
        // Add Governed 721 DAO to the list
        protocols.unshift(Governed721DAO)
      }
      if (!culturalStewardsDAOExists) {
        // Add Cultural Stewards DAO to the list
        protocols.unshift(CulturalStewardsDAO)
      }
      if (!powers101Exists) {
        // Add Powers 101 to the list
        protocols.unshift(defaultPowers101)
      }

      set({ savedProtocols: protocols })
    } catch (error) {
      console.error('Error loading saved protocols:', error)
      set({ savedProtocols: [defaultPowers101] })
    }
  },
  
  addProtocol: (protocol: Powers) => {
    const { savedProtocols } = get()
    const exists = savedProtocols.some(
      p => p.contractAddress.toLowerCase() === protocol.contractAddress.toLowerCase()
    )
    
    if (!exists) {
      const updated = [...savedProtocols, protocol]
      localStorage.setItem('powersProtocols', JSON.stringify(updated))
      set({ savedProtocols: updated })
      console.log('Protocol added to localStorage:', protocol.contractAddress)
    }
  },
  
  removeProtocol: (contractAddress: `0x${string}`) => {
    const { savedProtocols } = get()
    const updated = savedProtocols.filter(
      p => p.contractAddress.toLowerCase() !== contractAddress.toLowerCase()
    )
    localStorage.setItem('powersProtocols', JSON.stringify(updated))
    set({ savedProtocols: updated })
    console.log('Protocol removed from localStorage:', contractAddress)
    console.log('Remaining protocols:', updated.length)
  },
  
  updateProtocol: (contractAddress: `0x${string}`, updates: Partial<Powers>) => {
    const { savedProtocols } = get()
    const updated = savedProtocols.map(p => 
      p.contractAddress === contractAddress ? { ...p, ...updates } : p
    )
    localStorage.setItem('powersProtocols', JSON.stringify(updated))
    set({ savedProtocols: updated })
  }
}))
