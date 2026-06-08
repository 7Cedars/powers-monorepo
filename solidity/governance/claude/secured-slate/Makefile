SCRIPT = governance/claude/secured-slate/Deploy.s.sol:Deploy
TEST   = SecuredSlate_test

.PHONY: help deploy-anvil deploy-sepolia deploy-arb-sepolia deploy-opt-sepolia test

help:
	@echo "Available targets:"
	@echo "  deploy-anvil        Deploy to local Anvil"
	@echo "  deploy-sepolia      Deploy to Ethereum Sepolia"
	@echo "  deploy-arb-sepolia  Deploy to Arbitrum Sepolia"
	@echo "  deploy-opt-sepolia  Deploy to Optimism Sepolia"
	@echo "  test                Run fork-based tests (requires SEPOLIA_RPC_URL)"

deploy-anvil:
	cd ../../.. && forge script $(SCRIPT) $(ANVIL_DEPLOY_ARGS)

deploy-sepolia:
	cd ../../.. && forge script $(SCRIPT) $(SEPOLIA_DEPLOY_ARGS)

deploy-arb-sepolia:
	cd ../../.. && forge script $(SCRIPT) $(ARB_SEPOLIA_DEPLOY_ARGS)

deploy-opt-sepolia:
	cd ../../.. && forge script $(SCRIPT) $(OPT_SEPOLIA_DEPLOY_ARGS)

test:
	cd ../../.. && forge test --match-contract $(TEST) -vvv
