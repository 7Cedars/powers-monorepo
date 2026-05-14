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
PRIMARY_LAYER="${1:-$PRIMARY_LAYER}"
NONCE="${2:-$NONCE}"
IDEAS_NAMES="${3:-$IDEAS_NAMES}"
PRIVATE_KEYS="${4:-$PRIVATE_KEYS}"
EXTRA_ARGS="${@:5}" # Any additional arguments like --broadcast, --private-key, etc.

if [ -z "$PRIMARY_LAYER" ] || [ -z "$NONCE" ] || [ -z "$IDEAS_NAMES" ] || [ -z "$PRIVATE_KEYS" ]; then
    echo "Error: Missing required arguments."
    echo "Usage: $0 <PRIMARY_LAYER_ADDRESS> <NONCE> <IDEAS_NAMES_ARRAY> <PRIVATE_KEYS_ARRAY> [EXTRA_ARGS...]"
    echo "Example: $0 0x123... 0 \"[1, 2]\" \"[3, 4]\" --broadcast"
    echo "Note: Arguments can also be provided via .env file variables (PRIMARY_LAYER, NONCE, IDEAS_NAMES, PRIVATE_KEYS)."
    exit 1
fi

# 6 minutes in seconds
INTERVAL=360 

countdown() {
    local secs=$1
    while [ $secs -gt 0 ]; do
        printf "\rWaiting: %02d:%02d before next step..." $((secs/60)) $((secs%60))
        sleep 1
        secs=$((secs - 1))
    done
    printf "\rWaiting: 00:00 before next step...\n"
}

echo "=========================================================="
echo "Starting Timed Ideas Layer Deployment Process"
echo "Primary Layer: $PRIMARY_LAYER"
echo "Nonce: $NONCE"
echo "Ideas Names: $IDEAS_NAMES"
echo "Interval: 6 minutes ($INTERVAL seconds) between steps"
echo "=========================================================="
echo ""

echo "[1/4] Executing runSetupMandate on Primary Layer..."
forge script governance/actions/Initialise.s.sol:Initialise \
    --sig "runSetupMandate(address,uint256)" \
    "$PRIMARY_LAYER" "$NONCE" \
    $EXTRA_ARGS
echo "runSetupMandate completed successfully."

echo ""
countdown $INTERVAL
echo ""

echo "[2/4] Executing deployIdeasLayer1..."
forge script governance/actions/Initialise.s.sol:Initialise \
    --sig "deployIdeasLayer1(address,uint256,string[],uint256[])" \
    "$PRIMARY_LAYER" "$NONCE" "$IDEAS_NAMES" "$PRIVATE_KEYS" \
    $EXTRA_ARGS
echo "deployIdeasLayer1 completed successfully."

echo ""
countdown $INTERVAL
echo ""

echo "[3/4] Executing deployIdeasLayer2..."
forge script governance/actions/Initialise.s.sol:Initialise \
    --sig "deployIdeasLayer2(address,uint256,string[],uint256[])" \
    "$PRIMARY_LAYER" "$NONCE" "$IDEAS_NAMES" "$PRIVATE_KEYS" \
    $EXTRA_ARGS
echo "deployIdeasLayer2 completed successfully."

echo ""
countdown $INTERVAL
echo ""

echo "[4/4] Executing deployIdeasLayer3..."
forge script governance/actions/Initialise.s.sol:Initialise \
    --sig "deployIdeasLayer3(address,string[],uint256)" \
    "$PRIMARY_LAYER" "$IDEAS_NAMES" "$NONCE" \
    $EXTRA_ARGS
echo "deployIdeasLayer3 completed successfully."

echo ""
echo "=========================================================="
echo "Ideas Layer Deployment Process Complete!"
echo "=========================================================="