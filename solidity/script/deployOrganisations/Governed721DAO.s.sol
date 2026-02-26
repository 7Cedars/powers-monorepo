// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26; 

// scripts
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol";
import { InitialisePowers } from "@script/InitialisePowers.s.sol";
import { DeploySetup } from "./DeploySetup.s.sol";

// external protocols
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { SafeProxyFactory } from "lib/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import { Safe } from "lib/safe-smart-account/contracts/Safe.sol";
import { ModuleManager } from "lib/safe-smart-account/contracts/base/ModuleManager.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// powers contracts
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

// helpers 
import { ElectionList } from "@src/helpers/ElectionList.sol";
import { Governed721, IGoverned721 } from "@src/helpers/Governed721.sol";

/// @title Governed721DAO Deployment Script
contract Governed721DAO is DeploySetup {
    Configurations helperConfig;
    PowersTypes.MandateInitData[] constitution;
    InitialisePowers initialisePowers;
    PowersTypes.Conditions conditions;
    Powers powers;
    Governed721 governed721;

    address treasury;
    uint16 mintMandateId; 
    uint16 paymentMandateId;
    uint16 transferMandateId;
    uint16 proposeSplitId;
    uint16 vetoMinterId;
    uint16 vetoOwnerId;
    uint16 vetoIntermediaryId;
    uint16 splitCheckpoint1;
    uint16 splitCheckpoint2;
    uint16 splitCheckpoint3;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string[] inputParams;
    string[] dynamicParams;

    function run() external {
        // step 0, setup.
        initialisePowers = new InitialisePowers();
        initialisePowers.run();
        helperConfig = new Configurations();

        // step 1: deploy Governed721 Powers
        vm.startBroadcast();
        powers = new Powers(
            "Governed721", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreidlcgxe2mnwghrk4o5xenybljieurrxhtio6gq5fq5u6lxduyyl6e", // uri
            helperConfig.getMaxCallDataLength(block.chainid), // max call data length
            helperConfig.getMaxReturnDataLength(block.chainid), // max return data length
            helperConfig.getMaxExecutionsLength(block.chainid) // max executions length
        );
        governed721 = new Governed721(); 
        vm.stopBroadcast();  
        console2.log("Powers deployed at:", address(powers));
        console2.log("Governed721 deployed at:", address(governed721));

        // step 2: create constitution
        uint256 constitutionLength = createConstitution();
        console2.log("Constitution created with length:");
        console2.logUint(constitutionLength);

        // step 3: run constitute.
        // vm.startBroadcast();
        vm.startBroadcast();
        powers.constitute(constitution);
        powers.closeConstitute();
        
        // Transfer ownership of Governed721 to Powers (important for minting/updating)
        governed721.setPaymentId(paymentMandateId);
        governed721.transferOwnership(address(powers));
        vm.stopBroadcast();

        console2.log("Powers successfully constituted.");
    }

    function createConstitution() internal returns (uint256 constitutionLength) {
        uint16 mandateCount = 0;

        //////////////////////////////////////////////////////////////////////
        //                              SETUP                               //
        //////////////////////////////////////////////////////////////////////
        // NB! £todo ROLE DESIGNATIONS HAVE CHANGED 2 <-> 3

        calldatas = new bytes[](11);
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Artist", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Intermediary", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreih7dlv7qlbei3tbxazdkx4bzbjf2mpf656tr5v5uhmy5k4vtdcnqm"); 
        calldatas[4] = abi.encodeWithSelector(IPowers.labelRole.selector, 3, "Owner", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigtyqevb7k36goevp6qzc6we4svp2lgrat766yuek4c4uqwkkbzj4"); 
        calldatas[5] = abi.encodeWithSelector(IPowers.labelRole.selector, 4, "Voter", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigwx7isovolegdy3m74bsyaziwitbm3ooo7y5dghatq5ek64r3qsq"); 
        calldatas[6] = abi.encodeWithSelector(IPowers.labelRole.selector, 5, "Executive", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreifke7bfkxxs45unssm6hdr6s6464yrkwds3nw3jkn74cblf5oziea");
        // Assign roles to msg.sender for initial setup (will be revoked later or kept for testing)
        calldatas[7] = abi.encodeWithSelector(IPowers.assignRole.selector, 1, msg.sender);
        calldatas[8] = abi.encodeWithSelector(IPowers.assignRole.selector, 5, msg.sender);
        calldatas[9] = abi.encodeWithSelector(IPowers.setTreasury.selector, address(powers));
        calldatas[10] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1); // revoke mandate 1 after use.

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels, setup treasury and revokes itself after execution",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_OnOwnPowers"),
                config: abi.encode(calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                      EXECUTIVE MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        // COLLECT PAYMENT 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Any one can call, but logic enforces caller matches role
        // conditions.needFulfilled = transferMandateId; // No longer linked to transfer mandate directly
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Collect Split Payment: Role holders can collect their split of payment.",
                targetMandate: initialisePowers.getInitialisedAddress("GovernedToken_CollectSplitPayment"),
                config: abi.encode(
                    address(governed721) // Governed721 Address
                ),
                conditions: conditions
            })
        );
        delete conditions;
        paymentMandateId = mandateCount;
 
        // SET SPLIT PAYMENT
        // single executive: propose new split and vote. Input should be the new split between minter, intermediary and owner.
        inputParams = new string[](2);
        inputParams[1] = "uint8 Role"; // 1 = Artist, 2 = Intermediary. The Old Owner gets the remainder after Artist and Intermediary split, so we only need to input the splits for Artist and Intermediary.
        inputParams[0] = "uint8 Percentage";

        mandateCount++;
        conditions.allowedRole = 5; // Executive
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Propose Split Payment: Executive proposes new split. Role 1 = Artist, Role 2 = Intermediary. The old owner gets the remainder after Artist and Intermediary split.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        proposeSplitId = mandateCount;

        // minter, owners and intermediaries have veto (see Cultural Stewards DAO on how to do this) 
        // Minter Veto
        mandateCount++;
        conditions.allowedRole = 1; // Minter
        conditions.needFulfilled = proposeSplitId;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Split (Minter): Minter can veto split change.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        vetoMinterId = mandateCount;

        // Owner Veto
        mandateCount++;
        conditions.allowedRole = 2; // Owner
        conditions.needFulfilled = proposeSplitId;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Split (Owner): Owner can veto split change.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        vetoOwnerId = mandateCount;

        // Intermediary Veto
        mandateCount++;
        conditions.allowedRole = 3; // Intermediary
        conditions.needFulfilled = proposeSplitId;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Split (Intermediary): Intermediary can veto split change.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        vetoIntermediaryId = mandateCount;

        // executives: vote + time lock. Execute & implement new split.        
        // Checkpoint 1: Check Minter Veto
        mandateCount++;
        conditions.allowedRole = 5;
        conditions.needFulfilled = proposeSplitId;
        conditions.needNotFulfilled = vetoMinterId;
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // Wait for vetos
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Split Checkpoint 1: Confirm no Minter veto.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(new string[](0)),
                conditions: conditions
            })
        );
        delete conditions;
        splitCheckpoint1 = mandateCount;

        // Checkpoint 2: Check Owner Veto
        mandateCount++;
        conditions.allowedRole = 5;
        conditions.needFulfilled = splitCheckpoint1;
        conditions.needNotFulfilled = vetoOwnerId;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Split Checkpoint 2: Confirm no Owner veto.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(new string[](0)),
                conditions: conditions
            })
        );
        delete conditions;
        splitCheckpoint2 = mandateCount;

        // Checkpoint 3: Check Intermediary Veto
        mandateCount++;
        conditions.allowedRole = 5;
        conditions.needFulfilled = splitCheckpoint2;
        conditions.needNotFulfilled = vetoIntermediaryId;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Split Checkpoint 3: Confirm no Intermediary veto.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(new string[](0)),
                conditions: conditions
            })
        );
        delete conditions;
        splitCheckpoint3 = mandateCount;

        // Execute Split
        mandateCount++;
        conditions.allowedRole = 5;
        conditions.needFulfilled = splitCheckpoint3;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Execute Split Payment: Set new split payment.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(governed721),
                    Governed721.setSplit.selector,
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;
 
        // ADD / REMOVE ALLOWED TOKENS MANDATE 
        // executives: add allowed tokens. Vote. Execute. 
        inputParams = new string[](2);
        inputParams[0] = "address Token";

        mandateCount++;
        conditions.allowedRole = 5; // Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 50;
        conditions.succeedAt = 51;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Add Allowed Token: Whitelist a token.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Advanced"),
                config: abi.encode(
                    address(governed721),
                    Governed721.setWhitelist.selector,
                    abi.encode(), 
                    inputParams,
                    abi.encode(true) // true to whitelist, false to remove from whitelist
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // executives: revoke allowed tokens. Vote. Execute. Previous mandate should have executed.  
        mandateCount++;
        conditions.needFulfilled = mandateCount - 1; // Need the previous "Add Allowed Token" mandate to have executed to ensure the token is currently allowed before we can remove it.
        conditions.allowedRole = 5; // Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 50;
        conditions.succeedAt = 51;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Remove Allowed Token: De-whitelist a token.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Advanced"),
                config: abi.encode(
                    address(governed721),
                    Governed721.setWhitelist.selector,
                    abi.encode(), 
                    inputParams,
                    abi.encode(false) // true to whitelist, false to remove from whitelist
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // SET BLACKLIST
        // £todo - update 
        // executives: add addresses to blacklist. Vote. Execute.
        inputParams = new string[](2);
        inputParams[0] = "address Account";

        mandateCount++;
        conditions.allowedRole = 5; // Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 50;
        conditions.succeedAt = 51;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Add account to blacklist: Blacklist an account. They will not be able to transfer or mint NFTs.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_Advanced"),
                config: abi.encode(
                    IPowers.blacklistAddress.selector,
                    abi.encode(), 
                    inputParams,
                    abi.encode(true) // true to whitelist, false to remove from whitelist
                ),
                conditions: conditions
            })
        );
        delete conditions;

        mandateCount++;
        conditions.allowedRole = 5; // Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 50;
        conditions.succeedAt = 51;
        conditions.needFulfilled = mandateCount - 1; // Need the previous "Add to Blacklist" mandate to have executed to ensure the account is currently blacklisted before we can remove it.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Remove account from blacklist: Remove an account from the blacklist. They will be able to transfer or mint NFTs again.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_Advanced"),
                config: abi.encode(
                    IPowers.blacklistAddress.selector,
                    abi.encode(), 
                    inputParams,
                    abi.encode(false) // true to whitelist, false to remove from whitelist
                ),
                conditions: conditions
            })
        );
        delete conditions; 
 
        //////////////////////////////////////////////////////////////////////
        //                        ELECTORAL MANDATES                        // 
        //////////////////////////////////////////////////////////////////////

        // ASSIGNING OWNER ROLE
        inputParams = new string[](1);
        inputParams[0] = "uint256 TokenId";
        // First calls the ERC721 contract to check owner of NFT. 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public function 
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Check ownership Token: This check is needed to assign the owner role to the NFT owner in the next mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(governed721),
                    IERC721.ownerOf.selector,
                    inputParams
                    ),
                conditions: conditions
            })
        );
        delete conditions;

        // second call uses the return value to assign the role. 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public function 
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assign Owner Role: Assigns Owner role to the owner of the NFT.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_OnReturnValue"),
                config: abi.encode(
                    IPowers.assignRole.selector,
                    abi.encode(2), // Owner role
                    inputParams,
                    mandateCount - 1, // the mandate from which the return data will be fetched (the ownership check mandate)
                    abi.encode()
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // third call (executives) uses the same return value + previous law must be fulfilled to revoke the role. 
        mandateCount++;
        conditions.allowedRole = 5; // Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        conditions.quorum = 10;
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Owner Role: Revokes Owner role. In case of inactivity or lapsed ownership. Executives can revoke the owner role based on the same ownership check if needed.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_OnReturnValue"),
                config: abi.encode(
                    IPowers.revokeRole.selector,
                    abi.encode(2), // Owner role
                    inputParams,
                    mandateCount - 2, // the mandate from which the return data will be fetched (the ownership check mandate)
                    abi.encode()
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // ASSIGNING ARTIST ROLE:
        // follows the same logic as owner role assignment, but reads the artist from the governed721 contract instead of the owner. 
        inputParams = new string[](1);
        inputParams[0] = "uint256 TokenId";
        // First calls the ERC721 contract to check artist of NFT. 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public function 
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Check artist Token: This check is needed to assign the artist role to the NFT artist in the next mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(governed721),
                    IGoverned721.getArtist.selector,
                    inputParams
                    ),
                conditions: conditions
            })
        );
        delete conditions;

        // second call uses the return value to assign the role. 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public function 
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assign Artist Role: Assigns Artist role to the artist of the NFT.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_OnReturnValue"),
                config: abi.encode(
                    IPowers.assignRole.selector,
                    abi.encode(1), // Artist role
                    inputParams,
                    mandateCount - 1, // the mandate from which the return data will be fetched (the artist check mandate)
                    abi.encode()
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // third call (executives) uses the same return value + previous law must be fulfilled to revoke the role. 
        mandateCount++;
        conditions.allowedRole = 5; // Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        conditions.quorum = 10;
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Artist Role: Revokes Artist role. In case of inactivity or lapsed ownership. Executives can revoke the artist role based on the same artist check if needed.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_OnReturnValue"),
                config: abi.encode(
                    IPowers.revokeRole.selector,
                    abi.encode(1), // Artist role
                    inputParams,
                    mandateCount - 2, // the mandate from which the return data will be fetched (the artist check mandate)
                    abi.encode()
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // ASSIGNING INTERMEDIARY ROLE:
        // Note follows the same logic as owner role assignments, but now checks if / who has been assigned as 'approved' at a token. 
        inputParams = new string[](1);
        inputParams[0] = "uint256 TokenId";
        // First calls the ERC721 contract to check approved address for NFT. 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public function 
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Check approved address Token: This check is needed to assign the intermediary role to the approved address of the NFT in the next mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(governed721),
                    IERC721.getApproved.selector,
                    inputParams
                    ),
                conditions: conditions
            })
        );
        delete conditions;

        // second call uses the return value to assign the role. 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public function 
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assign Intermediary Role: Assigns Intermediary role to the approved address of the NFT.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_OnReturnValue"),
                config: abi.encode(
                    IPowers.assignRole.selector,
                    abi.encode(3), // Intermediary role
                    inputParams,
                    mandateCount - 1, // the mandate from which the return data will be fetched (the ownership check mandate)
                    abi.encode()
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // third call (executives) uses the same return value + previous law must be fulfilled to revoke the role. 
        mandateCount++;
        conditions.allowedRole = 5; // Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        conditions.quorum = 10;
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Intermediary Role: Revokes Intermediary role. In case of inactivity or lapsed ownership. Executives can revoke the intermediary role based on the same ownership check if needed.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_OnReturnValue"),
                config: abi.encode(
                    IPowers.revokeRole.selector,
                    abi.encode(3), // Intermediary role
                    inputParams,
                    mandateCount - 2, // the mandate from which the return data will be fetched (the ownership check mandate)
                    abi.encode()
                ),
                conditions: conditions
            })
        );
        delete conditions;
 
        // ASSIGNING VOTER ROLE: 
        uint256[] memory voterRoleCriteria = new uint256[](3);
        voterRoleCriteria[0] = 1; // Minter role ID
        voterRoleCriteria[1] = 2; // Owner role ID
        voterRoleCriteria[2] = 3; // Intermediary role ID
        // if account has minter, owner or intermediary role, they can claim a voter role. 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // public  
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Claim Voter Role: Minters, Owners, and Intermediaries can claim voter role.",
                targetMandate: initialisePowers.getInitialisedAddress("RoleByRoles"),
                config: abi.encode(
                    4, // Voter role ID
                    voterRoleCriteria
                    ),
                conditions: conditions
            })
        );
        delete conditions; 

        // ELECTION EXECUTIVES 
        // standard election flow. See cultural stewards DAO for example. WHO ARE THE VOTERS AND CANDIDATES? 
        // Voters = Role 4 (Voter)
        // Candidates = Role 4? (Assume Voters can be Executives)
        
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Create Election
        mandateCount++;
        conditions.allowedRole = 4; // Voters
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create Executive Election: Voters can create election.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    ElectionList.createElection.selector,
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Open Vote
        mandateCount++;
        conditions.allowedRole = 4; // Voters
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open Executive Vote: Open voting.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"),
                    1, // votes per voter
                    4 // allowed role to vote (Voter)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Tally
        mandateCount++;
        conditions.allowedRole = 4;
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Executive Election: Tally votes.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    5, // RoleId for Executives
                    5 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Cleanup
        mandateCount++;
        conditions.allowedRole = 4;
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Cleanup Election: Cleanup mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(powers), // target contract (this DAO)
                    IPowers.revokeMandate.selector,
                    abi.encode(),
                    inputParams,
                    mandateCount - 2, // Open Vote mandate
                    abi.encode()
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Nominate
        mandateCount++;
        conditions.allowedRole = 4; // Voters
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Nominate for Executive: Voters can nominate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    true
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Revoke Nomination
        mandateCount++;
        conditions.allowedRole = 4;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Nomination: Revoke self nomination.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    false
                ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                        REFORM MANDATES                           //
        //////////////////////////////////////////////////////////////////////
        // none. Immutable for now. 

        return constitution.length;
    }
}
