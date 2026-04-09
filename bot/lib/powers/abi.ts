import { Abi } from "viem"

import powers from "./Powers.json" 

export const powersAbi: Abi = JSON.parse(JSON.stringify(powers.abi)) 