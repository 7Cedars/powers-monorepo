#!/bin/bash

# Navigate to the Foundry project root (contracts directory)
# This allows the script to be run from anywhere and correctly use forge
cd "$(dirname "$0")/../.."

# Exit on error
set -e

# Load .env variables if .env file exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Arguments or environment variables
IDEAS_LAYER="${1:-$IDEAS_LAYER}"
PRIMARY_LAYER="${2:-$PRIMARY_LAYER}"
NONCE="${3:-$NONCE}"
PRIVATE_KEYS="${4:-$PRIVATE_KEYS}"
EXTRA_ARGS="${@:5}" # Any additional arguments like --broadcast, --private-key, etc.

if [ -z "$IDEAS_LAYER" ] || [ -z "$PRIMARY_LAYER" ] || [ -z "$NONCE" ] || [ -z "$PRIVATE_KEYS" ]; then
    echo "Error: Missing required arguments."
    echo "Usage: $0 <IDEAS_LAYER_ADDRESS> <PRIMARY_LAYER_ADDRESS> <NONCE> <PRIVATE_KEYS_ARRAY> [EXTRA_ARGS...]"
    echo "Example: $0 0x456... 0x123... 0 \"[1, 2]\" --broadcast"
    echo "Note: Arguments can also be provided via .env file variables (IDEAS_LAYER, PRIMARY_LAYER, NONCE, PRIVATE_KEYS)."
    exit 1
fi

# 6 minutes in seconds
INTERVAL=360 

echo "=========================================================="
echo "Starting Timed Convergence Layer Deployment Process"
echo "Ideas Layer: $IDEAS_LAYER"
echo "Primary Layer: $PRIMARY_LAYER"
echo "Nonce: $NONCE"
echo "Interval: 6 minutes ($INTERVAL seconds) between steps"
echo "=========================================================="
echo ""

echo "[1/2] Executing deployConvergenceLayer1..."
forge script governance/actions/Initialise.s.sol:Initialise \
    --sig "deployConvergenceLayer1(address,address,uint256,uint256[])" \
    "$IDEAS_LAYER" "$PRIMARY_LAYER" "$NONCE" "$PRIVATE_KEYS" \
    $EXTRA_ARGS
echo "deployConvergenceLayer1 completed successfully."

echo ""
echo "Waiting for 6 minutes ($INTERVAL seconds) before executing the next step..."
sleep $INTERVAL
echo ""

echo "[2/2] Executing deployConvergenceLayer2..."
forge script governance/actions/Initialise.s.sol:Initialise \
    --sig "deployConvergenceLayer2(address,address,uint256)" \
    "$IDEAS_LAYER" "$PRIMARY_LAYER" "$NONCE" \
    $EXTRA_ARGS
echo "deployConvergenceLayer2 completed successfully."

echo ""
echo "=========================================================="
echo "Convergence Layer Deployment Process Complete!"
echo "=========================================================="
