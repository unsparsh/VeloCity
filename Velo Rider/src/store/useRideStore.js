import { create } from 'zustand'

const useRideStore = create((set) => ({
  pickup: null,
  destination: null,
  estimate: null,

  setPickup: (pickup) => set({ pickup }),
  setDestination: (destination) => set({ destination }),
  setEstimate: (estimate) => set({ estimate }),
  clearRide: () => set({ pickup: null, destination: null, estimate: null }),
}))

export default useRideStore
