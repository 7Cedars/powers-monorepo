// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { Nominees } from "@src/core/helpers/Nominees.sol";
import { Ownable } from "@lib/openzeppelin-contracts/contracts/access/Ownable.sol";

// ─── NOMINEES UNIT TESTS ────────────────────────────────────────────────────
// Target:  src/core/helpers/Nominees.sol
// Gap:     revokeNomination (line 55-56) — never called in existing coverage.
// Owner:   The test contract deploys Nominees directly, so address(this) is owner.
// ─────────────────────────────────────────────────────────────────────────────

contract NomineesTest is TestSetupHelpers {
    // Local contract under test. Named `nominees_` to avoid shadowing the
    // `nominees` field of type Nominees already declared in TestVariables.
    Nominees nominees_;

    // Events copied from the source contract so we can use vm.expectEmit.
    event NominationReceived(address indexed nominee);
    event NominationRevoked(address indexed nominee);

    function setUp() public override {
        super.setUp();
        // The test contract (address(this)) deploys nominees_, so it is owner.
        nominees_ = new Nominees();
    }

    // ─── BASIC BEHAVIOUR ─────────────────────────────────────────────────────

    function testConstructorOwnerIsDeployer() public view {
        assertEq(nominees_.owner(), address(this));
    }

    function testConstructorCountIsZero() public view {
        assertEq(nominees_.nomineesCount(), 0);
    }

    function testNominateStoresNomination() public {
        nominees_.nominate(alice, true);

        assertTrue(nominees_.nominations(alice));
        assertEq(nominees_.nomineesCount(), 1);
    }

    function testNominateEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit NominationReceived(alice);
        nominees_.nominate(alice, true);
    }

    function testNominateIncrementsCount() public {
        nominees_.nominate(alice, true);
        nominees_.nominate(bob, true);

        assertEq(nominees_.nomineesCount(), 2);
    }

    function testNominateDeselectRemovesNomination() public {
        nominees_.nominate(alice, true);
        nominees_.nominate(alice, false);

        assertFalse(nominees_.nominations(alice));
        assertEq(nominees_.nomineesCount(), 0);
    }

    function testNominateDeselectEmitsRevoke() public {
        nominees_.nominate(alice, true);

        vm.expectEmit(true, false, false, false);
        emit NominationRevoked(alice);
        nominees_.nominate(alice, false);
    }

    function testRevokeNominationEquivalentToNominateFalse() public {
        nominees_.nominate(alice, true);
        nominees_.revokeNomination(alice);

        assertFalse(nominees_.nominations(alice));
        assertFalse(nominees_.isNominee(alice));
        assertEq(nominees_.nomineesCount(), 0);
    }

    function testRevokeNominationEmitsRevoke() public {
        nominees_.nominate(alice, true);

        vm.expectEmit(true, false, false, false);
        emit NominationRevoked(alice);
        nominees_.revokeNomination(alice);
    }

    function testGetNomineesReturnsAll() public {
        nominees_.nominate(alice, true);
        nominees_.nominate(bob, true);

        address[] memory list = nominees_.getNominees();
        assertEq(list.length, 2);
        assertEq(list[0], alice);
        assertEq(list[1], bob);
    }

    function testIsNomineeBeforeAndAfterNomination() public {
        assertFalse(nominees_.isNominee(alice));

        nominees_.nominate(alice, true);
        assertTrue(nominees_.isNominee(alice));

        nominees_.nominate(alice, false);
        assertFalse(nominees_.isNominee(alice));
    }

    // ─── EDGE CASES ──────────────────────────────────────────────────────────

    function testRevokeNominationMiddleNomineeSwapAndPop() public {
        // Nominate three; revoke the middle one to exercise the swap-and-pop path.
        nominees_.nominate(alice, true);
        nominees_.nominate(bob, true);
        nominees_.nominate(charlotte, true);

        nominees_.revokeNomination(bob);

        assertEq(nominees_.nomineesCount(), 2);
        assertFalse(nominees_.isNominee(bob));
        assertTrue(nominees_.isNominee(alice));
        assertTrue(nominees_.isNominee(charlotte));

        address[] memory list = nominees_.getNominees();
        assertEq(list.length, 2);
        bool bobFound = false;
        for (uint256 k = 0; k < list.length; k++) {
            if (list[k] == bob) bobFound = true;
        }
        assertFalse(bobFound);
    }

    function testRevokeNominationFirstNominee() public {
        nominees_.nominate(alice, true);
        nominees_.nominate(bob, true);
        nominees_.nominate(charlotte, true);

        nominees_.revokeNomination(alice);

        assertEq(nominees_.nomineesCount(), 2);
        assertFalse(nominees_.isNominee(alice));
        assertTrue(nominees_.isNominee(bob));
        assertTrue(nominees_.isNominee(charlotte));
    }

    function testRevokeNominationLastNominee() public {
        nominees_.nominate(alice, true);
        nominees_.nominate(bob, true);

        nominees_.revokeNomination(bob);

        assertEq(nominees_.nomineesCount(), 1);
        assertFalse(nominees_.isNominee(bob));
        assertTrue(nominees_.isNominee(alice));
        address[] memory list = nominees_.getNominees();
        assertEq(list[0], alice);
    }

    function testNominateAndRevokeRepeated() public {
        nominees_.nominate(alice, true);
        assertEq(nominees_.nomineesCount(), 1);

        nominees_.revokeNomination(alice);
        assertEq(nominees_.nomineesCount(), 0);

        nominees_.nominate(alice, true);
        assertEq(nominees_.nomineesCount(), 1);

        nominees_.revokeNomination(alice);
        assertEq(nominees_.nomineesCount(), 0);
    }

    function testGetNomineesCountAfterRevokeMiddle() public {
        nominees_.nominate(alice, true);
        nominees_.nominate(bob, true);
        nominees_.nominate(charlotte, true);

        nominees_.revokeNomination(bob);

        address[] memory list = nominees_.getNominees();
        assertEq(list.length, 2);
    }

    // ─── ACCESS CONTROL ──────────────────────────────────────────────────────

    function testNominateRevertsWhenNotOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        nominees_.nominate(alice, true);
    }

    function testRevokeNominationRevertsWhenNotOwner() public {
        nominees_.nominate(alice, true);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        vm.prank(bob);
        nominees_.revokeNomination(alice);
    }

    function testNominateAlreadyNominatedReverts() public {
        nominees_.nominate(alice, true);

        vm.expectRevert("already nominated");
        nominees_.nominate(alice, true);
    }

    function testNominateDeselectNotNominatedReverts() public {
        vm.expectRevert("not nominated");
        nominees_.nominate(alice, false);
    }

    function testRevokeNominationNotNominatedReverts() public {
        vm.expectRevert("not nominated");
        nominees_.revokeNomination(alice);
    }
}
