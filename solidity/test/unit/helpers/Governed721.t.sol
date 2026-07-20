// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test } from "forge-std/Test.sol";
import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { Governed721, IGoverned721 } from "@src/addons/helpers/Governed721.sol";

/// @notice Unit tests for Governed721
/// @dev The test contract is the owner of g721, so all onlyOwner calls are made directly.
///      collectPayment is FAILING because it calls IPowers(owner()).request() — the owner
///      is the test contract, not a Powers instance — so it always reverts.
contract Governed721Test is TestSetupHelpers {
    Governed721 public g721;

    uint256 constant TOKEN_ID_1 = 1;
    uint256 constant TOKEN_ID_2 = 2;
    string constant TOKEN_URI = "ipfs://QmTest";

    function setUp() public override {
        super.setUp();
        // Deployer (test contract) becomes owner — required for onlyOwner calls
        g721 = new Governed721();
    }

    // ─── BASIC BEHAVIOUR ───

    /// @notice Constructor sets the ERC721 name and symbol
    function testConstructorSetsNameAndSymbol() public view {
        assertEq(g721.name(), "Governed721");
        assertEq(g721.symbol(), "G721");
    }

    /// @notice Deployer is set as owner
    function testConstructorOwnerIsDeployer() public view {
        assertEq(g721.owner(), address(this));
    }

    /// @notice mint succeeds with valid parameters and assigns the artist
    function testMintSucceeds() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);
        assertEq(g721.ownerOf(TOKEN_ID_1), alice);
        assertEq(g721.getArtist(TOKEN_ID_1), bob);
        assertEq(g721.tokenURI(TOKEN_ID_1), TOKEN_URI);
    }

    /// @notice setPaymentId stores the mandateId
    function testSetPaymentIdStoresMandateId() public {
        g721.setPaymentId(7);
        assertEq(g721.paymentMandateId(), 7);
    }

    /// @notice setSplit stores the percentage for a given role
    function testSetSplitStoresPercentage() public {
        g721.setSplit(IGoverned721.Role.Artist, 10);
        assertEq(g721.getSplit(IGoverned721.Role.Artist), 10);
    }

    /// @notice getSplit for OldOwner returns DENOMINATOR minus total split payment
    function testGetSplitOldOwnerReturnsDenominatorMinusTotal() public {
        // No splits set — OldOwner should receive the full 100
        assertEq(g721.getSplit(IGoverned721.Role.OldOwner), g721.DENOMINATOR());
    }

    /// @notice getSplit for OldOwner decreases as other splits are added
    function testGetSplitOldOwnerDecreasesWithOtherSplits() public {
        g721.setSplit(IGoverned721.Role.Artist, 15);
        g721.setSplit(IGoverned721.Role.Intermediary, 5);
        // OldOwner = 100 - 15 - 5 = 80
        assertEq(g721.getSplit(IGoverned721.Role.OldOwner), 80);
    }

    /// @notice setWhitelist marks a token address as whitelisted
    function testSetWhitelistMarksTokenWhitelisted() public {
        address mockToken = address(0x1234);
        g721.setWhitelist(mockToken, true);
        assertTrue(g721.isWhitelisted(mockToken));
    }

    /// @notice setWhitelist can remove a whitelisted token
    function testSetWhitelistRemovesToken() public {
        address mockToken = address(0x1234);
        g721.setWhitelist(mockToken, true);
        g721.setWhitelist(mockToken, false);
        assertFalse(g721.isWhitelisted(mockToken));
    }

    /// @notice setBlacklist marks an account as blacklisted
    function testSetBlacklistMarksAccountBlacklisted() public {
        g721.setBlacklist(alice, true);
        assertTrue(g721.isBlacklisted(alice));
    }

    /// @notice setBlacklist can remove a blacklisted account
    function testSetBlacklistRemovesAccount() public {
        g721.setBlacklist(alice, true);
        g721.setBlacklist(alice, false);
        assertFalse(g721.isBlacklisted(alice));
    }

    /// @notice burn destroys the token
    function testBurnDestroysToken() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);
        g721.burn(TOKEN_ID_1);
        vm.expectRevert();
        g721.ownerOf(TOKEN_ID_1);
    }

    // ─── TRANSFER BEHAVIOUR ───

    /// @notice safeTransferFrom with empty data transfers the token and logs the transfer
    function testSafeTransferFromNoPaymentData() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);

        // Transfer alice -> charlotte with no payment data
        vm.prank(alice);
        g721.safeTransferFrom(alice, charlotte, TOKEN_ID_1, "");

        assertEq(g721.ownerOf(TOKEN_ID_1), charlotte);
    }

    /// @notice safeTransferFrom stores transfer data retrievable via getTransferData
    function testSafeTransferFromStoresTransferData() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);

        vm.prank(alice);
        g721.safeTransferFrom(alice, charlotte, TOKEN_ID_1, "");

        // Compute the transferId that the contract would have used
        uint256 expectedTransferId =
            uint256(keccak256(abi.encode(alice, charlotte, TOKEN_ID_1, address(0), uint256(0), block.number)));

        IGoverned721.TransferData memory td = g721.getTransferData(expectedTransferId);
        assertEq(td.oldOwner, alice);
        assertEq(td.newOwner, charlotte);
        assertEq(td.tokenId, TOKEN_ID_1);
    }

    /// @notice safeTransferFrom reverts when the old owner is blacklisted
    function testSafeTransferFromRevertsBlacklistedOldOwner() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);
        g721.setBlacklist(alice, true);

        vm.prank(alice);
        vm.expectRevert("Blacklisted account involved in transfer");
        g721.safeTransferFrom(alice, charlotte, TOKEN_ID_1, "");
    }

    /// @notice safeTransferFrom reverts when the new owner is blacklisted
    function testSafeTransferFromRevertsBlacklistedNewOwner() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);
        g721.setBlacklist(charlotte, true);

        vm.prank(alice);
        vm.expectRevert("Blacklisted account involved in transfer");
        g721.safeTransferFrom(alice, charlotte, TOKEN_ID_1, "");
    }

    /// @notice safeTransferFromWithETH transfers token and sends ETH to owner
    function testSafeTransferFromWithETHSucceeds() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);

        uint256 ownerBalanceBefore = address(this).balance;

        // alice sends 1 ETH, quantity = 0.5 ETH; excess 0.5 ETH is refunded to alice
        vm.prank(alice);
        g721.safeTransferFromWithETH{ value: 1 ether }(alice, charlotte, TOKEN_ID_1, 0.5 ether, 1);

        assertEq(g721.ownerOf(TOKEN_ID_1), charlotte);
        // Test contract (owner) received 0.5 ETH
        assertEq(address(this).balance, ownerBalanceBefore + 0.5 ether);
    }

    /// @notice safeTransferFromWithETH reverts when insufficient ETH is sent
    function testSafeTransferFromWithETHRevertsInsufficientETH() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);

        vm.prank(alice);
        vm.expectRevert("Insufficient ETH sent");
        g721.safeTransferFromWithETH{ value: 0.1 ether }(alice, charlotte, TOKEN_ID_1, 0.5 ether, 1);
    }

    /// @notice safeTransferFromWithETH reverts when a blacklisted account is involved
    function testSafeTransferFromWithETHRevertsBlacklisted() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);
        g721.setBlacklist(charlotte, true);

        vm.prank(alice);
        vm.expectRevert("Blacklisted account involved in transfer");
        g721.safeTransferFromWithETH{ value: 1 ether }(alice, charlotte, TOKEN_ID_1, 0.5 ether, 1);
    }

    // ─── EDGE CASES ───

    /// @notice mint reverts when tokenId is 0
    function testMintRevertsZeroTokenId() public {
        vm.expectRevert("Token ID cannot be 0");
        g721.mint(alice, 0, bob, TOKEN_URI);
    }

    /// @notice mint reverts when artist is the zero address
    function testMintRevertsZeroArtist() public {
        vm.expectRevert("Artist address cannot be 0");
        g721.mint(alice, TOKEN_ID_1, address(0), TOKEN_URI);
    }

    /// @notice mint reverts when tokenURI is empty
    function testMintRevertsEmptyTokenURI() public {
        vm.expectRevert("Token URI cannot be empty");
        g721.mint(alice, TOKEN_ID_1, bob, "");
    }

    /// @notice mint reverts when tokenId already exists
    function testMintRevertsTokenAlreadyExists() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);
        vm.expectRevert("Token ID already exists");
        g721.mint(charlotte, TOKEN_ID_1, david, TOKEN_URI);
    }

    /// @notice setSplit reverts when total would reach 100%
    function testSetSplitRevertsWhenTotalReaches100() public {
        g721.setSplit(IGoverned721.Role.Artist, 50);
        g721.setSplit(IGoverned721.Role.Intermediary, 49);
        // Next setSplit would push total to 100, which is not allowed
        vm.expectRevert("Total split payment cannot be 100% or more");
        g721.setSplit(IGoverned721.Role.NewOwner, 1);
    }

    // ─── ACCESS CONTROL ───

    /// @notice setPaymentId reverts when called by a non-owner
    function testSetPaymentIdRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        g721.setPaymentId(5);
    }

    /// @notice setSplit reverts when called by a non-owner
    function testSetSplitRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        g721.setSplit(IGoverned721.Role.Artist, 10);
    }

    /// @notice setWhitelist reverts when called by a non-owner
    function testSetWhitelistRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        g721.setWhitelist(address(0x1234), true);
    }

    /// @notice setBlacklist reverts when called by a non-owner
    function testSetBlacklistRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        g721.setBlacklist(bob, true);
    }

    /// @notice burn reverts when called by a non-owner
    function testBurnRevertsNonOwner() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);
        vm.prank(alice);
        vm.expectRevert();
        g721.burn(TOKEN_ID_1);
    }

    // ─── FAILING TESTS ───

    // FAILING: collectPayment calls IPowers(owner()).request() but the owner is the test
    // contract (address(this)), not a Powers instance. The call will revert because the
    // test contract has no request() function.
    // Fix: deploy g721 with a real Powers instance as owner, which requires constituting
    // that DAO with a paymentMandateId pointing to a valid mandate.
    function testCollectPaymentRevertsOwnerIsNotPowers() public {
        g721.mint(alice, TOKEN_ID_1, bob, TOKEN_URI);
        g721.setPaymentId(1);

        // collectPayment → IPowers(owner()).request(...) — owner is the test contract,
        // not a Powers instance, so this will revert.
        vm.expectRevert();
        g721.collectPayment(IGoverned721.Role.Artist, alice, charlotte, TOKEN_ID_1, "");
    }

    // Allow the test contract to receive ETH (needed for safeTransferFromWithETH tests)
    receive() external payable { }
}
