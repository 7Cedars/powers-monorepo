// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { TestSetupPowers } from "../TestSetup.t.sol";
import { MandateRegistry } from "@src/core/helpers/MandateRegistry.sol";
import { IMandate } from "@src/interfaces/IMandate.sol";
import { OpenAction } from "@src/core/mandates/executive/OpenAction.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";

/// @notice Unit tests for the paid tier added to MandateRegistry: pricing, credits, per-adoption charging,
/// developer split, withdrawals, and the "registry-down blocks new adoptions only" invariant.
contract MandateRegistryCreditsTest is TestSetupPowers {
    address internal owner_; // registry owner (a Powers org in prod, an EOA in tests)

    function setUp() public override {
        super.setUp();
        owner_ = registry.owner();
        vm.deal(address(this), 100 ether);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    /// @dev Deploys a fresh OpenAction against the shared registry, registers it under `name`, returns it.
    function _deployRegistered(string memory name) internal returns (address mandate) {
        mandate = address(new OpenAction(address(registry)));
        vm.prank(owner_);
        registry.registerMandate(name, mandate, keccak256(abi.encodePacked(name)));
    }

    function _price(address mandate, address[] memory devs, uint256 price) internal {
        vm.prank(owner_);
        registry.setMandatePricing(mandate, devs, price);
    }

    function _twoDevs() internal view returns (address[] memory devs) {
        devs = new address[](2);
        devs[0] = alice;
        devs[1] = bob;
    }

    // ─── pricing config ──────────────────────────────────────────────────────

    function testDefaultFeeBpsIsTenPercent() public view {
        assertEq(registry.feeBps(), 1000);
    }

    function testSetFeeBpsRevertsAboveCap() public {
        vm.prank(owner_);
        vm.expectRevert(abi.encodeWithSelector(MandateRegistry.FeeTooHigh.selector, uint16(3001), uint16(3000)));
        registry.setFeeBps(3001);
    }

    function testSetMandatePricingRevertsForUnregistered() public {
        address unregistered = address(new OpenAction(address(registry)));
        vm.prank(owner_);
        vm.expectRevert(abi.encodeWithSelector(MandateRegistry.NotRegistered.selector, unregistered));
        registry.setMandatePricing(unregistered, _twoDevs(), 1 ether);
    }

    function testSetPricedMandateRequiresDevs() public {
        address mandate = _deployRegistered("NoDevMandate");
        address[] memory noDevs = new address[](0);
        vm.prank(owner_);
        vm.expectRevert(abi.encodeWithSelector(MandateRegistry.NoDevs.selector, mandate));
        registry.setMandatePricing(mandate, noDevs, 1 ether);
    }

    // ─── charging via onAdopt ────────────────────────────────────────────────

    function testFreeMandateDoesNotMoveCredits() public {
        address mandate = _deployRegistered("FreeMandate"); // price 0 by default
        address org = address(daoMock);
        registry.buyCredits{ value: 1 ether }(org);

        uint256 before = registry.credits(org);
        vm.prank(mandate);
        registry.onAdopt(org);

        assertEq(registry.credits(org), before, "free mandate must not charge");
        assertEq(registry.earnings(owner_), 0);
    }

    function testPricedMandateRevertsWithoutCredits() public {
        address mandate = _deployRegistered("PricedNoCredits");
        _price(mandate, _twoDevs(), 1 ether);
        address org = address(daoMock);

        vm.prank(mandate);
        vm.expectRevert(abi.encodeWithSelector(MandateRegistry.InsufficientCredits.selector, org, uint256(1 ether), uint256(0)));
        registry.onAdopt(org);
    }

    function testOnAdoptRevertsForUnregistered() public {
        address unregistered = address(new OpenAction(address(registry)));
        vm.prank(unregistered);
        vm.expectRevert(abi.encodeWithSelector(MandateRegistry.NotRegistered.selector, unregistered));
        registry.onAdopt(address(daoMock));
    }

    function testChargeSplitsFeeAndDevsEvenly() public {
        address mandate = _deployRegistered("PricedEven");
        _price(mandate, _twoDevs(), 0.01 ether);
        address org = address(daoMock);
        registry.buyCredits{ value: 0.05 ether }(org);

        vm.prank(mandate);
        registry.onAdopt(org);

        uint256 price = 0.01 ether;
        uint256 fee = (price * 1000) / 10_000; // 10%
        uint256 share = (price - fee) / 2;

        assertEq(registry.credits(org), 0.05 ether - price, "credits debited by price");
        assertEq(registry.earnings(owner_), fee, "fee to owner");
        assertEq(registry.earnings(alice), share, "dev0 share");
        assertEq(registry.earnings(bob), share, "dev1 share");
        assertEq(fee + share + share, price, "no wei lost (even case)");
    }

    function testChargeRemainderGoesToFirstDev() public {
        // price chosen so the dev portion is odd → 1 wei remainder to devs[0]
        uint256 price = 105; // fee = 105*1000/10000 = 10; devPortion = 95; /2 = 47 rem 1
        address mandate = _deployRegistered("PricedOdd");
        _price(mandate, _twoDevs(), price);
        address org = address(daoMock);
        registry.buyCredits{ value: 1 ether }(org);

        vm.prank(mandate);
        registry.onAdopt(org);

        uint256 fee = (price * 1000) / 10_000; // 10
        uint256 devPortion = price - fee; // 95
        uint256 share = devPortion / 2; // 47
        uint256 remainder = devPortion - (share * 2); // 1

        assertEq(registry.earnings(owner_), fee);
        assertEq(registry.earnings(alice), share + remainder, "first dev gets remainder");
        assertEq(registry.earnings(bob), share);
        assertEq(fee + registry.earnings(alice) + registry.earnings(bob), price, "no wei lost (odd case)");
    }

    // ─── withdrawals ─────────────────────────────────────────────────────────

    function testWithdrawEarningsPaysThenZeroes() public {
        address mandate = _deployRegistered("PricedForWithdraw");
        _price(mandate, _twoDevs(), 0.01 ether);
        address org = address(daoMock);
        registry.buyCredits{ value: 0.05 ether }(org);
        vm.prank(mandate);
        registry.onAdopt(org);

        uint256 aliceOwed = registry.earnings(alice);
        assertGt(aliceOwed, 0);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        registry.withdrawEarnings();

        assertEq(alice.balance, balBefore + aliceOwed, "alice received earnings");
        assertEq(registry.earnings(alice), 0, "earnings zeroed");

        // second withdraw pays nothing
        vm.prank(alice);
        vm.expectRevert(MandateRegistry.NothingToWithdraw.selector);
        registry.withdrawEarnings();
    }

    // ─── deactivation / registry-down invariant ──────────────────────────────

    function testOnAdoptRevertsAfterDeactivation() public {
        address mandate = _deployRegistered("PricedThenDeactivated");
        _price(mandate, _twoDevs(), 0.01 ether);
        registry.buyCredits{ value: 0.05 ether }(address(daoMock));

        (uint16 maj, uint16 min, uint16 pat) = IMandate(mandate).version();
        vm.prank(owner_);
        registry.deactivateMandate(maj, min, pat, "PricedThenDeactivated");

        vm.prank(mandate);
        vm.expectRevert(abi.encodeWithSelector(MandateRegistry.NotRegistered.selector, mandate));
        registry.onAdopt(address(daoMock));
    }

    function testAdoptedMandateStillExecutesAfterRegistryDeactivation() public {
        // Adopt a free registered mandate on daoMock, then deactivate it in the registry, then confirm
        // the already-adopted mandate still executes (execution never touches the registry) but a new
        // adoption of it now reverts.
        address mandate = _deployRegistered("ExecInvariant");

        conditions.allowedRole = ROLE_ONE; // alice holds ROLE_ONE in TestSetupPowers
        uint16 newMandateId;
        vm.prank(address(daoMock));
        newMandateId = daoMock.adoptMandate(
            MandateInitData({
                nameDescription: "Exec invariant mandate",
                targetMandate: mandate,
                config: abi.encode(),
                conditions: conditions
            })
        );

        // deactivate in the registry
        (uint16 maj, uint16 min, uint16 pat) = IMandate(mandate).version();
        vm.prank(owner_);
        registry.deactivateMandate(maj, min, pat, "ExecInvariant");

        // already-adopted mandate still executes: request a no-op action through it
        address[] memory t = new address[](0);
        uint256[] memory v = new uint256[](0);
        bytes[] memory c = new bytes[](0);
        vm.prank(alice);
        daoMock.request(newMandateId, abi.encode(t, v, c), nonce, "still works");

        // but re-adopting the now-deactivated mandate reverts at the mandate-side onAdopt
        vm.prank(address(daoMock));
        vm.expectRevert(abi.encodeWithSelector(MandateRegistry.NotRegistered.selector, mandate));
        daoMock.adoptMandate(
            MandateInitData({
                nameDescription: "re-adopt attempt",
                targetMandate: mandate,
                config: abi.encode(),
                conditions: conditions
            })
        );
    }

    // ─── credits are per-org and fundable by anyone ──────────────────────────

    function testBuyCreditsCreditsNamedOrgNotPayer() public {
        address org = address(daoMock);
        registry.buyCredits{ value: 2 ether }(org);
        assertEq(registry.credits(org), 2 ether);
        assertEq(registry.credits(address(this)), 0);
    }
}
