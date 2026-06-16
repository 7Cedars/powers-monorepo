-include ../../../.env
-include .env.local

SCRIPT = governance/claude/project-orange/Deploy.s.sol:Deploy
TEST   = ProjectOrange_test

# Wallet — set DEPLOYER_ACCOUNT and DEPLOYER_ADDRESS in .env.local
# (copy .env.example to .env.local and follow the instructions inside)

ANVIL_DEPLOY_ARGS       := --rpc-url http://localhost:8545 \
                            --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
                            --broadcast --ffi -vv

SEPOLIA_DEPLOY_ARGS     := --rpc-url $(SEPOLIA_RPC_URL) \
                            --account $(DEPLOYER_ACCOUNT) --sender $(DEPLOYER_ADDRESS) \
                            --broadcast -vv

ARB_SEPOLIA_DEPLOY_ARGS := --rpc-url $(ARB_SEPOLIA_RPC_URL) \
                            --account $(DEPLOYER_ACCOUNT) --sender $(DEPLOYER_ADDRESS) \
                            --broadcast --etherscan-api-key $(ETHERSCAN_API_KEY) \
                            --verifier etherscan --chain 421614 --verify --ffi -vv

OPT_SEPOLIA_DEPLOY_ARGS := --rpc-url $(OPT_SEPOLIA_RPC_URL) \
                            --account $(DEPLOYER_ACCOUNT) --sender $(DEPLOYER_ADDRESS) \
                            --broadcast --etherscan-api-key $(ETHERSCAN_API_KEY) \
                            --chain 11155420 --ffi -vv

.PHONY: help deploy-anvil deploy-sepolia deploy-arb-sepolia deploy-opt-sepolia test setup-wallet check-wallet

help:
	@echo "Available targets:"
	@echo "  deploy-anvil        Deploy to local Anvil (no wallet setup needed)"
	@echo "  deploy-sepolia      Deploy to Ethereum Sepolia"
	@echo "  deploy-arb-sepolia  Deploy to Arbitrum Sepolia"
	@echo "  deploy-opt-sepolia  Deploy to Optimism Sepolia"
	@echo "  test                Run tests (no fork required)"
	@echo "  setup-wallet        Print wallet setup instructions"
	@echo "  check-wallet        Verify wallet variables are configured"

deploy-anvil:
	cd ../../.. && forge script $(SCRIPT) $(ANVIL_DEPLOY_ARGS)

deploy-sepolia: check-wallet
	cd ../../.. && forge script $(SCRIPT) $(SEPOLIA_DEPLOY_ARGS)

deploy-arb-sepolia: check-wallet
	cd ../../.. && forge script $(SCRIPT) $(ARB_SEPOLIA_DEPLOY_ARGS)

deploy-opt-sepolia: check-wallet
	cd ../../.. && forge script $(SCRIPT) $(OPT_SEPOLIA_DEPLOY_ARGS)

test:
	cd ../../.. && FOUNDRY_TEST=governance/claude/project-orange forge test --match-contract $(TEST) -vvv

setup-wallet:
	@echo ""
	@echo "=== Wallet setup for live network deployments ==="
	@echo ""
	@echo "1. Create an encrypted keystore (you will be prompted for a password):"
	@echo "      cast wallet import my-wallet --interactive"
	@echo ""
	@echo "2. Add the following to .env.local:"
	@echo "      DEPLOYER_ACCOUNT=my-wallet"
	@echo "      DEPLOYER_ADDRESS=0xYourAddress"
	@echo ""
	@echo "3. The deployer wallet must hold at least 0.05 ETH plus gas at deploy time."
	@echo ""

check-wallet:
	@if [ -z "$(DEPLOYER_ACCOUNT)" ] || [ -z "$(DEPLOYER_ADDRESS)" ]; then \
		echo ""; \
		echo "ERROR: DEPLOYER_ACCOUNT and DEPLOYER_ADDRESS must be set in .env.local"; \
		echo "Run 'make setup-wallet' for instructions."; \
		echo ""; \
		exit 1; \
	fi
