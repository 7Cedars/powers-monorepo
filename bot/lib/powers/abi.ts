import { Abi } from "viem"

import powers from "../../../frontend/context/builds/Powers.json" 

export const powersAbi: Abi = JSON.parse(JSON.stringify(powers.abi)) 