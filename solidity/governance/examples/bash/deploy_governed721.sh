#!/bin/bash

# Navigate to the Foundry project root (contracts directory)
# This allows the script to be run from anywhere and correctly use forge
cd "$(dirname "$0")/.."

# Exit on error
set -e

# Load .env variables if .env file exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Arguments or environment variables
# GOVERNED721_ORG is optional: if not set, a new organisation will be deployed.
GOVERNED721_ORG="${1:-$GOVERNED721_ORG}"
NONCE="${2:-$NONCE}"
PRIVATE_KEYS="${3:-$PRIVATE_KEYS}"
EXTRA_ARGS="${@:4}" # Any additional arguments like --broadcast, --private-key, etc.

if [ -z "$NONCE" ] || [ -z "$PRIVATE_KEYS" ]; then
    echo "Error: Missing required arguments."
    echo "Usage: $0 [GOVERNED721_ORG] <NONCE> <PRIVATE_KEYS_ARRAY> [EXTRA_ARGS...]"
    echo "  GOVERNED721_ORG: Optional. If not provided, a new organisation is deployed."
    echo "Example: $0 \"\" $(date +%s) \"[1, 2, 3]\" --broadcast"
    echo "Note: Arguments can also be provided via .env file variables (GOVERNED721_ORG, NONCE, PRIVATE_KEYS)."
    exit 1
fi

# 11 minutes in seconds (clears the 10-minute split payment timelock)
INTERVAL=660

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
echo "Starting Governed721 Deployment Process"
if [ -n "$GOVERNED721_ORG" ]; then
    echo "Organisation (Powers): $GOVERNED721_ORG"
else
    echo "Organisation: will be deployed in step 1"
fi
echo "Nonce: $NONCE"
echo "Interval: 11 minutes ($INTERVAL seconds) after split initiation"
echo "=========================================================="
echo ""

# ──────────────────────────────────────────────────────────────
# Step 1: Deploy (skipped if GOVERNED721_ORG already provided)
# ──────────────────────────────────────────────────────────────
if [ -z "$GOVERNED721_ORG" ]; then
    echo "[1/4] Deploying new Governed721 organisation..."
    forge script governance/examples/Governed721.s.sol:Deploy \
        --sig "run()" \
        $EXTRA_ARGS
    echo "Deployment complete."
    echo ""

    # Attempt to read the deployed Powers address from the latest broadcast file
    BROADCAST_FILE=$(find broadcast/Governed721.s.sol -name "run-latest.json" 2>/dev/null | head -1)
    if [ -n "$BROADCAST_FILE" ] && command -v jq &>/dev/null; then
        GOVERNED721_ORG=$(jq -r '[.transactions[] | select(.transactionType == "CREATE" and .contractName == "Powers")] | last | .contractAddress' "$BROADCAST_FILE")
        echo "Detected deployed Powers (Governed721Org) address: $GOVERNED721_ORG"
    fi

    if [ -z "$GOVERNED721_ORG" ]; then
        echo "Could not detect deployed address automatically."
        echo "Please enter the deployed Powers contract address:"
        read -r GOVERNED721_ORG
    fi
else
    echo "[1/4] Skipping deployment — using provided organisation: $GOVERNED721_ORG"
fi
echo ""

# ──────────────────────────────────────────────────────────────
# Step 2: Run initial setup mandate (assigns role labels, etc.)
# ──────────────────────────────────────────────────────────────
echo "[2/4] Running initial setup mandate..."
forge script governance/examples/actions/Initialise.s.sol:Initialise \
    --sig "runSetupMandate(address,uint256)" \
    "$GOVERNED721_ORG" "$NONCE" \
    $EXTRA_ARGS
echo "Initial setup mandate completed."
echo ""

# ──────────────────────────────────────────────────────────────
# Step 3: Initiate split payments (propose + start timelock)
# ──────────────────────────────────────────────────────────────
echo "[3/4] Initiating split payments..."

forge script governance/examples/actions/Governed721_Management.s.sol:Governed721_Management \
    --sig "initiateSplitPayment(address,uint8,uint8,uint256[],uint256)" \
    "$GOVERNED721_ORG" 1 15 "$PRIVATE_KEYS" "$NONCE" \
    $EXTRA_ARGS
echo "  - Artist (role 1): 15% split initiated."

forge script governance/examples/actions/Governed721_Management.s.sol:Governed721_Management \
    --sig "initiateSplitPayment(address,uint8,uint8,uint256[],uint256)" \
    "$GOVERNED721_ORG" 3 10 "$PRIVATE_KEYS" "$NONCE" \
    $EXTRA_ARGS
echo "  - Intermediary (role 3): 10% split initiated."

echo ""
echo "Waiting 11 minutes ($INTERVAL seconds) for the 10-minute timelock to expire..."
countdown $INTERVAL
echo ""

# ──────────────────────────────────────────────────────────────
# Step 4: Execute split payments (after timelock)
# ──────────────────────────────────────────────────────────────
echo "[4/4] Executing split payments..."

forge script governance/examples/actions/Governed721_Management.s.sol:Governed721_Management \
    --sig "executeSplitPayment(address,uint8,uint8,uint256[],uint256)" \
    "$GOVERNED721_ORG" 1 15 "$PRIVATE_KEYS" "$NONCE" \
    $EXTRA_ARGS
echo "  - Artist (role 1): 15% split executed."

forge script governance/examples/actions/Governed721_Management.s.sol:Governed721_Management \
    --sig "executeSplitPayment(address,uint8,uint8,uint256[],uint256)" \
    "$GOVERNED721_ORG" 3 10 "$PRIVATE_KEYS" "$NONCE" \
    $EXTRA_ARGS
echo "  - Intermediary (role 3): 10% split executed."

echo ""
echo "=========================================================="
echo "Governed721 Deployment Process Complete!"
echo "  Organisation (Powers): $GOVERNED721_ORG"
echo "  Artist (role 1) split: 15%"
echo "  Intermediary (role 3) split: 10%"
echo "=========================================================="
