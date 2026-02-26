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

// powers contracts
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

// helpers
import { SimpleErc20Votes } from "@mocks/SimpleErc20Votes.sol";
import { Governed1155 } from "@src/helpers/Governed1155.sol";
import { PowersFactory } from "@src/helpers/PowersFactory.sol";
import { ElectionList } from "@src/helpers/ElectionList.sol";
import { RwaMock, ComplianceRegistryMock } from "@mocks/RwaMock.sol";

/// @title Cultural Stewards DAO - Deployment Script
/// Note: all days are turned into minutes for testing purposes. These should be changed before production deployment: ctrl-f minutesToBlocks -> daysToBlocks.
contract CulturalStewardsDAO is DeploySetup {
    InitialisePowers initialisePowers;
    Configurations helperConfig;
    PowersTypes.Conditions conditions;

    PowersTypes.MandateInitData[] primaryConstitution;
    PowersTypes.MandateInitData[] digitalConstitution;
    PowersTypes.MandateInitData[] ideasConstitution;
    PowersTypes.MandateInitData[] physicalConstitution;

    Powers primaryDAO;
    Powers digitalSubDAO;
    Powers ideasSubDAO;
    Powers physicalSubDAO;

    PowersFactory ideasDaoFactory;
    PowersFactory physicalDaoFactory;
    Governed1155 governed1155;
    ElectionList electionList;

    // NB: FOR TESTING PURPOSES ONLY: REMOVE BEFORE ACTUAL DEPLOYMENT!
    address cedars = 0x328735d26e5Ada93610F0006c32abE2278c46211;
    address testAccount1 = 0xEA223f81D7E74321370a77f1e44067bE8738B627;
    address testAccount2 = 0x1bFdB91B283d7Ec24012d7ff5A5B29005140D09a;
    address testAccount3 = 0x49fCf1DD685F6b5F88d9b0a972Dbf80Ee8846234;
    // NB: FOR TESTING PURPOSES ONLY: REMOVE BEFORE ACTUAL DEPLOYMENT!

    uint256 constitutionLength;
    address[] targets;
    uint256[] values;
    bytes4[] functionSelectors;
    bytes[] calldatas;
    string[] inputParams;
    string[] dynamicParams;
    uint16 mandateCount;
    address treasury;
    uint256 constant PACKAGE_SIZE = 15; // number of mandates per packaged mandate.
    uint16 requestAllowanceDigitalDAOId; // mandate id for request allowance on digital subDAO.
    uint16 requestAllowancePhysicalDAOId; // mandate id for request allowance on ideas subDAO.
    uint16 requestMembershipPrimaryDaoId; // mandate id for requesting membership in the primary DAO (i.e. getting the Members role).
    uint16 mintPoapTokenId; // mandate id for minting POAP tokens on governed1155.
    uint16 mintActivityTokenId; 
    uint16 requestNewPhysicalDaoId; 

    // DEPLOY SEQUENCE FOR L2s FOR CULTURAL STEWARDS DAO
    function run() external { 
        // step 0, setup.
        initialisePowers = new InitialisePowers();
        initialisePowers.run();
        helperConfig = new Configurations(); 

        // Deploy vanilla DAOs (parent and digital) and DAO factories (for ideas and physical).
        vm.startBroadcast();
        console2.log("Deploying Vanilla Powers contracts...");
        primaryDAO = new Powers(
            "Primary DAO", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreiho3ac3huvnqauz67takzcb5m65emr3vsvtxba7rme7mf6fqocm2i", // uri
            helperConfig.getMaxCallDataLength(block.chainid), // max call data length
            helperConfig.getMaxReturnDataLength(block.chainid), // max return data length
            helperConfig.getMaxExecutionsLength(block.chainid) // max executions length
        );

        digitalSubDAO = new Powers(
            "Digital sub-DAO", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreies7pigq5iwkd627uk6n5l34o3vyzavdcsdar2srd2brdrfbnkahm", // uri
            helperConfig.getMaxCallDataLength(block.chainid), // max call data length
            helperConfig.getMaxReturnDataLength(block.chainid), // max return data length
            helperConfig.getMaxExecutionsLength(block.chainid) // max executions length
        );

        console2.log("Deploying Organisation's Helper contracts...");
        governed1155 = new Governed1155(
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreighx6axdemwbjara3xhhfn5yaiktidgljykzx3vsrqtymicxxtgvi"
        );
        vm.stopBroadcast();
        console2.log("Primary DAO deployed at:", address(primaryDAO));
        console2.log("Digital sub-DAO deployed at:", address(digitalSubDAO));
        console2.log("Governed1155 deployed at:", address(governed1155));

        // setup Safe treasury.
        address[] memory owners = new address[](1);
        owners[0] = address(primaryDAO);

        vm.startBroadcast();
        console2.log("Setting up Safe treasury for Primary DAO...");
        treasury = address(
            SafeProxyFactory(helperConfig.getSafeProxyFactory(block.chainid))
                .createProxyWithNonce(
                    helperConfig.getSafeL2Canonical(block.chainid),
                    abi.encodeWithSelector(
                        Safe.setup.selector,
                        owners,
                        1, // threshold
                        address(0), // to
                        "", // data
                        address(0), // fallbackHandler
                        address(0), // paymentToken
                        0, // payment
                        address(0) // paymentReceiver
                    ),
                    1 // = nonce
                )
        );
        vm.stopBroadcast();
        console2.log("Safe treasury deployed at:", treasury);

        // Deploy factories first (empty) so their addresses are available
        console2.log("Deploying Physical sub-DAO factory (contract only)...");
        vm.startBroadcast();
        physicalDaoFactory = new PowersFactory(
            "Physical sub-DAO", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreid5embkqobey2pv5bf4zzz3zjs2fgeivkd6kfp7244sbd4yp2ky2u", // uri 
            helperConfig.getMaxCallDataLength(block.chainid), // max call data length
            helperConfig.getMaxReturnDataLength(block.chainid), // max return data length
            helperConfig.getMaxExecutionsLength(block.chainid) // max executions length
        );
        vm.stopBroadcast();
        console2.log("Physical sub-DAO factory deployed at:", address(physicalDaoFactory));

        console2.log("Deploying Ideas Sub-DAO factory (contract only)...");
        vm.startBroadcast();
        ideasDaoFactory = new PowersFactory(
            "Ideas sub-DAO", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreiaoqlyll5yjvlkcfblegcdf4j4szqjfabf7qaybkmnrufgdsq5t4a", // uri
            helperConfig.getMaxCallDataLength(block.chainid), // max call data length
            helperConfig.getMaxReturnDataLength(block.chainid), // max return data length
            helperConfig.getMaxExecutionsLength(block.chainid) // max executions length
        );
        vm.stopBroadcast();
        console2.log("Ideas sub-DAO factory deployed at:", address(ideasDaoFactory));
 
        // Create primary constitution first to set mandate IDs
        console2.log("Creating Primary constitution...");
        createPrimaryConstitution();
        console2.log("Primary Constitution, length:", primaryConstitution.length);

        console2.log("Creating Physical constitution...");
        createPhysicalConstitution();
        console2.log("Physical Constitution, length:", physicalConstitution.length); 

        console2.log("Creating Digital constitution...");
        createDigitalConstitution();
        console2.log("Digital Constitution, length:", digitalConstitution.length);

        // Deploying Ideas and Physical sub-DAO factories (after primary constitution to reference mandate IDs)
        console2.log("Creating Ideas constitution...");
        createIdeasConstitution();
        console2.log("Ideas Constitution, length:", ideasConstitution.length);

        // Populate factories with mandates
        console2.log("Adding mandates to Physical sub-DAO factory...");
        for (uint256 i = 0; i < physicalConstitution.length; i += PACKAGE_SIZE) {
            uint256 size = PACKAGE_SIZE;
            if (i + size > physicalConstitution.length) {
                size = physicalConstitution.length - i;
            }
            PowersTypes.MandateInitData[] memory batch = new PowersTypes.MandateInitData[](size);
            for (uint256 j = 0; j < size; j++) {
                batch[j] = physicalConstitution[i + j];
            }
            vm.startBroadcast();
            physicalDaoFactory.addMandates(batch); // set msg.sender as admin
            vm.stopBroadcast();
        } 

        console2.log("Adding mandates to Ideas sub-DAO factory...");
        for (uint256 i = 0; i < ideasConstitution.length; i += PACKAGE_SIZE) {
            uint256 size = PACKAGE_SIZE;
            if (i + size > ideasConstitution.length) {
                size = ideasConstitution.length - i;
            }
            PowersTypes.MandateInitData[] memory batch = new PowersTypes.MandateInitData[](size);
            for (uint256 j = 0; j < size; j++) {
                batch[j] = ideasConstitution[i + j];
            }
            vm.startBroadcast();
            ideasDaoFactory.addMandates(batch); // set msg.sender as admin
            vm.stopBroadcast();
        } 

        // Step 4: run constitute on vanilla DAOs.  
        console2.log("Constituting Primary DAO...");
        // due to the size of these DAOs, we add them in batches.
        for (uint256 i = 0; i < primaryConstitution.length; i += PACKAGE_SIZE) {
            uint256 size = PACKAGE_SIZE;
            if (i + size > primaryConstitution.length) {
                size = primaryConstitution.length - i;
            }
            PowersTypes.MandateInitData[] memory batch = new PowersTypes.MandateInitData[](size);
            for (uint256 j = 0; j < size; j++) {
                batch[j] = primaryConstitution[i + j];
            }
            vm.startBroadcast();
            primaryDAO.constitute(batch); // set msg.sender as admin
            vm.stopBroadcast();
        } 
        vm.startBroadcast();
        primaryDAO.closeConstitute();
        vm.stopBroadcast();

        console2.log("Constituting Digital sub-DAO...");
        for (uint256 i = 0; i < digitalConstitution.length; i += PACKAGE_SIZE) {
            uint256 size = PACKAGE_SIZE;
            if (i + size > digitalConstitution.length) {
                size = digitalConstitution.length - i;
            }
            PowersTypes.MandateInitData[] memory batch = new PowersTypes.MandateInitData[](size);
            for (uint256 j = 0; j < size; j++) {
                batch[j] = digitalConstitution[i + j];
            }
            vm.startBroadcast();
            digitalSubDAO.constitute(batch); // set msg.sender as admin
            vm.stopBroadcast();
        } 
        vm.startBroadcast();
        digitalSubDAO.closeConstitute(address(primaryDAO)); // set primary DAO as admin
        vm.stopBroadcast();

        // step 5: transfer ownership of factories to primary DAO.
        vm.startBroadcast();
        console2.log("Transferring ownership of DAO factories to Primary DAO...");
        governed1155.transferOwnership(address(primaryDAO));
        ideasDaoFactory.transferOwnership(address(primaryDAO));
        physicalDaoFactory.transferOwnership(address(primaryDAO));
        vm.stopBroadcast();

        console2.log("Success! All contracts successfully deployed, unpacked and configured.");
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    //                       PRIMARY DAO CONSTITUTION                         //
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    function createPrimaryConstitution() internal {
        mandateCount = 0; // resetting mandate count at 4, because there will be 4 packagedMandate Laws.
        //////////////////////////////////////////////////////////////////////
        //                              SETUP                               //
        //////////////////////////////////////////////////////////////////////
        // setup calls //
        // signature for Safe module enabling call
        bytes memory signature = abi.encodePacked(
            uint256(uint160(address(primaryDAO))), // r = address of the signer (powers contract)
            uint256(0), // s = 0
            uint8(1) // v = 1 This is a type 1 call. See Safe.sol for details.
        );

        targets = new address[](16);
        values = new uint256[](16);
        calldatas = new bytes[](16);

        for (uint256 i = 0; i < 16; i++) {
            targets[i] = address(primaryDAO); // all calls have value 0 in this mandate. To transfer Eth, use a different mandate.
        }
        targets[13] = treasury; // override target for treasury setup call.
        targets[14] = treasury; // override target for allowance module setup call.

        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Members", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Executives", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreifke7bfkxxs45unssm6hdr6s6464yrkwds3nw3jkn74cblf5oziea");
        calldatas[4] = abi.encodeWithSelector(IPowers.labelRole.selector, 3, "Physical sub-DAOs", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigwx7isovolegdy3m74bsyaziwitbm3ooo7y5dghatq5ek64r3qsq");
        calldatas[5] = abi.encodeWithSelector(IPowers.labelRole.selector, 4, "Ideas sub-DAOs", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreih52wl5ahxjpabk7bz7wltkxynispszxjyqonwkwsv3rggbkrzjxy");
        calldatas[6] = abi.encodeWithSelector(IPowers.labelRole.selector, 5, "Digital sub-DAOs", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreifo54ut4s5lm43ngb5b6icgvlwggdovj2i72o7z5fottcsxo737cq");
        calldatas[7] = abi.encodeWithSelector(IPowers.assignRole.selector, 1, cedars);
        calldatas[8] = abi.encodeWithSelector(IPowers.assignRole.selector, 1, testAccount1);
        calldatas[9] = abi.encodeWithSelector(IPowers.assignRole.selector, 1, testAccount2);
        // calldatas[8] = abi.encodeWithSelector(IPowers.assignRole.selector, 1, testAccount3);
        calldatas[10] = abi.encodeWithSelector(IPowers.assignRole.selector, 2, cedars);
        calldatas[11] = abi.encodeWithSelector(IPowers.assignRole.selector, 5, address(digitalSubDAO));
        calldatas[12] = abi.encodeWithSelector(IPowers.setTreasury.selector, treasury);
        calldatas[13] = abi.encodeWithSelector( // cal to set allowance module to the Safe treasury.
            Safe.execTransaction.selector,
            treasury, // The internal transaction's destination
            0, // The internal transaction's value in this mandate is always 0. To transfer Eth use a different mandate.
            abi.encodeWithSelector( // the call to be executed by the Safe: enabling the module.
                ModuleManager.enableModule.selector,
                helperConfig.getSafeAllowanceModule(block.chainid)
            ),
            0, // operation = Call
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            address(0), // gasToken
            address(0), // refundReceiver
            signature // the signature constructed above
        );
        calldatas[14] = abi.encodeWithSelector( // call to set Digital sub-DAO as delegate to the Safe treasury.
            Safe.execTransaction.selector,
            helperConfig.getSafeAllowanceModule(block.chainid), // The internal transaction's destination: the Allowance Module.
            0, // The internal transaction's value in this mandate is always 0. To transfer Eth use a different mandate.
            abi.encodeWithSignature(
                "addDelegate(address)", // == AllowanceModule.addDelegate.selector,  (because the contracts are compiled with different solidity versions we cannot reference the contract directly here)
                address(digitalSubDAO)
            ),
            0, // operation = Call
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            address(0), // gasToken
            address(0), // refundReceiver
            signature // the signature constructed above
        );
        calldatas[15] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1); // revoke mandate after use.

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assigns role labels, sets up the allowance module, the treasury and revokes itself after execution",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_Single"),
                config: abi.encode(
                    targets,
                    values,
                    calldatas
                    ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                      EXECUTIVE MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        // CREATE IDEAS DAO //   
        // Members: Initiate Ideas sub-DAO creation
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 5; // = 5% quorum. Note: very low quorum to encourage experimentation.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initiate Ideas sub-DAO: Initiate creation of Ideas sub-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Execute Ideas sub-DAO creation
        mandateCount++;
        conditions.allowedRole = 2; // = Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 66; // = 2/3 majority
        conditions.quorum = 66; // = 66% quorum
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create Ideas sub-DAO: Execute Ideas sub-DAO creation",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(ideasDaoFactory), // calling the ideas factory
                    bytes4(keccak256("createPowers()")),
                    abi.encode()  
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Assign role Id to Ideas sub-DAO //
        mandateCount++;
        conditions.allowedRole = 2; // = Any executive
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assign role Id to DAO: Assign role id 4 (Ideas sub-DAO) to the new DAO",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.assignRole.selector, // function selector to call
                    abi.encode(4), // params before (role id 4 = Ideas sub-DAOs)
                    abi.encode(), // dynamic params (the input params of the parent mandate)
                    mandateCount - 1, // parent mandate id (the create Ideas sub-DAO mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // REVOKE IDEAS DAO //
        inputParams = new string[](1);
        inputParams[0] = "address IdeasSubDAO";

        // Members: Veto Revoke Ideas sub-DAO creation mandate //
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto revoke Ideas sub-DAO: Veto the revoking of an Ideas sub-DAO from Cultural Stewards",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(
                    inputParams
                    ),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Revoke Ideas sub-DAO (revoke role Id) //
        mandateCount++;
        conditions.allowedRole = 2;
        conditions.quorum = 66;
        conditions.succeedAt = 51;
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.needNotFulfilled = mandateCount - 1; // need the veto to have NOT been fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke role Id: Revoke role id 4 (Ideas sub-DAO) from the DAO",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Advanced"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.revokeRole.selector, // function selector to call
                    abi.encode(4), // params before (role id 4 = Ideas sub-DAOs) // the static params
                    abi.encode(), // the dynamic params (the input params of the parent mandate)
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // CREATE PHYSICAL DAO // 
        // note: an allowance is set when DAO is created.
        inputParams = new string[](1); 
        inputParams[0] = "address Admin"; // the address of the admin of the new DAO

        // Ideas sub-DAOs: Initiate Physical sub-DAO creation. Any Ideas sub-DAO can propose creating a Physical sub-DAO.
        mandateCount++;
        conditions.allowedRole = 4; // = Ideas sub-DAO
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initiate Physical sub-DAO: Initiate creation of Physical sub-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;
        requestNewPhysicalDaoId = mandateCount; 

        // Executives: Execute Physical sub-DAO creation
        mandateCount++;
        conditions.allowedRole = 2; // = Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 66; // = 2/3 majority
        conditions.quorum = 66; // = 66% quorum
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create Physical sub-DAO: Execute Physical sub-DAO creation",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    physicalDaoFactory, // calling the Physical factory 
                    bytes4(keccak256("createPowers(address)")), // function selector for createPowers (because the contracts are compiled with different solidity versions we cannot reference the contract directly here)
                    inputParams // no params 
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Assign role Id to Physical sub-DAO //
        mandateCount++;
        conditions.allowedRole = 2; // = Any executive
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assign role Id: Assign role Id 3 to Physical sub-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.assignRole.selector, // function selector to call
                    abi.encode(uint16(3)), // params before (role id 4 = Ideas sub-DAOs)
                    inputParams, // dynamic params (the input params of the parent mandate)
                    mandateCount - 1, // parent mandate id (the create Ideas sub-DAO mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Assign Delegate status to Physical sub-DAO //
        mandateCount++;
        conditions.allowedRole = 2; // = Any executive
        conditions.needFulfilled = mandateCount - 2; // need the Physical sub-DAO to have been created.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assign Delegate status: Assign delegate status at Safe treasury to the Physical sub-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("Safe_ExecTransaction_OnReturnValue"),
                config: abi.encode(
                    helperConfig.getSafeAllowanceModule(block.chainid), // target contract
                    bytes4(0xe71bdf41), // == AllowanceModule.addDelegate.selector (because the contracts are compiled with different solidity versions we cannot reference the contract directly here)
                    abi.encode(), // params before (role id 4 = Ideas sub-DAOs)
                    inputParams, // dynamic params (the input params of the parent mandate)
                    mandateCount - 2, // parent mandate id (the create Physical sub-DAO mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // REVOKE PHYSICAL DAO //
        inputParams = new string[](2);
        inputParams[0] = "address PhysicalSubDAO";
        inputParams[1] = "bool removeAllowance";

        // members veto revoking physical DAO
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto revoke Physical sub-DAO: Veto the revoking of an Physical sub-DAO from Cultural Stewards",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Revoke Physical sub-DAO (Revoke Role ID) //
        mandateCount++;
        conditions.allowedRole = 2; // = Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 10 minutes timelock before execution.
        conditions.needNotFulfilled = mandateCount - 1; // need the veto to have NOT been fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Role Id: Revoke role Id 3 from Physical sub-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Advanced"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.revokeRole.selector, // function selector to call
                    abi.encode(3), // params before (role id 3 = Physical sub-DAOs) // the static params
                    inputParams, // the dynamic params (the input params of the parent mandate)
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Revoke Physical sub-DAO (Revoke Delegate status DAO) //
        mandateCount++;
        conditions.allowedRole = 2; // = Executives
        conditions.needFulfilled = mandateCount - 1; // need the assign role to have been fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Delegate status: Revoke delegate status Physical sub-DAO at the Safe treasury",
                targetMandate: initialisePowers.getInitialisedAddress("Safe_ExecTransaction"),
                config: abi.encode(
                    inputParams,
                    bytes4(0xdd43a79f), // == AllowanceModule.removeDelegate.selector (because the contracts are compiled with different solidity versions we cannot reference the contract directly
                    helperConfig.getSafeAllowanceModule(block.chainid) // target contract
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // ASSIGN ADDITIONAL ALLOWANCE TO PHYSICAL DAO OR DIGITAL DAO //
        inputParams = new string[](5);
        inputParams[0] = "address Sub-DAO";
        inputParams[1] = "address Token";
        inputParams[2] = "uint96 allowanceAmount";
        inputParams[3] = "uint16 resetTimeMin";
        inputParams[4] = "uint32 resetBaseMin";

        // Physical sub-DAO: Veto additional allowance
        mandateCount++;
        conditions.allowedRole = 3; // = Physical sub-DAOs
        conditions.quorum = 66; // = 66% quorum needed
        conditions.succeedAt = 66; // = 66% majority needed for veto.
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = number of blocks
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto allowance: Veto setting an allowance to either Digital sub-DAO or a Physical sub-DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Physical sub-DAO: Request additional allowance
        mandateCount++;
        conditions.allowedRole = 3; // = Physical sub-DAOs.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request additional allowance: Any Physical sub-DAO can request an allowance from the Safe Treasury.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        requestAllowancePhysicalDAOId = mandateCount; // store the mandate id for Digital sub-DAO allowance veto.

        // Executives: Grant Allowance to Physical sub-DAO
        mandateCount++;
        conditions.allowedRole = 2; // = Executives.
        conditions.quorum = 30; // = 30% quorum needed
        conditions.succeedAt = 51; // = 51% simple majority needed for assigning and revoking members.
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = number of blocks
        conditions.needFulfilled = mandateCount - 1; // = the proposal mandate.
        conditions.needNotFulfilled = mandateCount - 2; // = the veto mandate.
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 10 minutes timelock before execution.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Set Allowance: Execute and set allowance for a Physical sub-DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("SafeAllowance_Action"),
                config: abi.encode(
                    inputParams,
                    bytes4(0xbeaeb388), // == AllowanceModule.setAllowance.selector (because the contracts are compiled with different solidity versions we cannot reference the contract directly here)
                    helperConfig.getSafeAllowanceModule(block.chainid)
                ),
                conditions: conditions // everythign zero == Only admin can call directly
            })
        );
        delete conditions;

        // Digital sub-DAO: Request additional allowance
        mandateCount++;
        conditions.allowedRole = 5; // = Digital sub-DAO.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request additional allowance: The Digital sub-DAO can request an allowance from the Safe Treasury.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        requestAllowanceDigitalDAOId = mandateCount; // store the mandate id for Physical sub-DAO allowance veto.

        // Executives: Grant Allowance to Digital sub-DAO
        mandateCount++;
        conditions.allowedRole = 2; // = Executives.
        conditions.quorum = 30; // = 30% quorum needed
        conditions.succeedAt = 51; // = 51% simple majority needed for assigning and revoking members.
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = number of blocks
        conditions.needFulfilled = mandateCount - 1; // = the proposal mandate.
        conditions.needNotFulfilled = mandateCount - 4; // = the veto mandate.
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 10 minutes timelock before execution.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Set Allowance: Execute and set allowance for the Digital sub-DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("SafeAllowance_Action"),
                config: abi.encode(
                    inputParams,
                    bytes4(0xbeaeb388), // == AllowanceModule.setAllowance.selector (because the contracts are compiled with different solidity versions we cannot reference the contract directly here)
                    helperConfig.getSafeAllowanceModule(block.chainid)
                ),
                conditions: conditions // everythign zero == Only admin can call directly
            })
        );
        delete conditions;

        // EXECUTE VETO ON MANDATE ADOPTION AT OTHER SUB-DAOs //
        inputParams = new string[](2);
        inputParams[0] = "uint16[] MandateId";
        inputParams[1] = "uint256[] roleIds";

        // Executioners: Veto call to Powers instance and mandateIds in other sub-DAOs
        mandateCount++;
        conditions.allowedRole = 2; // = executioners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Call to sub-Dao: Executioners can veto updating the Primary DAO URI",
                targetMandate: initialisePowers.getInitialisedAddress("PowersAction_Flexible"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // UPDATE URI //
        inputParams = new string[](1);
        inputParams[0] = "string newUri";

        // Members: Veto update URI
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto update URI: Members can veto updating the Primary DAO URI",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Update URI
        mandateCount++;
        conditions.allowedRole = 2; // = Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 66; // = 2/3 majority
        conditions.quorum = 66; // = 66% quorum
        conditions.needNotFulfilled = mandateCount - 1; // the previous VETO mandate should not have been fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Update URI: Set allowed token for Cultural Stewards DAOs",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(primaryDAO), // calling the allowed tokens contract
                    IPowers.setUri.selector, // function selector to call
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Physical sub-DAOs: Mint NFTs Physical sub-DAO - ERC 1155 //
        mandateCount++;
        conditions.allowedRole = 3; // = Physical sub-DAOs
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Mint token Physical sub-DAO: Any Physical sub-DAO can mint new NFTs",
                targetMandate: initialisePowers.getInitialisedAddress("GovernedToken_MintEncodedToken"),
                config: abi.encode(address(governed1155)),
                conditions: conditions
            })
        );
        delete conditions;
        mintPoapTokenId = mandateCount; // store the mandate id for minting POAP tokens.

        // TRANSFER TOKENS INTO TREASURY //
        mandateCount++;
        conditions.allowedRole = 2; // = Executives. Any executive can call this mandate.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Transfer tokens to treasury: Any tokens accidently sent to the Primary DAO can be recovered by sending them to the treasury",
                targetMandate: initialisePowers.getInitialisedAddress("Safe_RecoverTokens"),
                config: abi.encode(
                    treasury, // this should be the safe treasury!
                    helperConfig.getSafeAllowanceModule(block.chainid) // allowance module address
                ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                      ELECTORAL MANDATES                          //
        //////////////////////////////////////////////////////////////////////

        // CLAIM MEMBERSHIP PARENT DAO // -- on the basis of request at ideas DAO and POAP ownership.
        // Ideas DAO: request membership - statement of intent.
        inputParams = new string[](1);
        inputParams[0] = "uint256[] TokenIds";

        mandateCount++;
        conditions.allowedRole = 4; // = ideas sub-DAO
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request Membership Step 1: A forwarded quest to become member from an ideas-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode( inputParams ),
                conditions: conditions
            })
        );
        delete conditions;
        requestMembershipPrimaryDaoId = mandateCount;

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request Membership Step 2: 2 POAPS from physical DAO are needed that are not older than 6 months.",
                targetMandate: initialisePowers.getInitialisedAddress("GovernedToken_GatedAccess"),
                config: abi.encode(
                    address(governed1155), // soulbound token contract
                    1, // member role Id
                    5, // checks if token is from address that is an Ideas sub-DAO
                    daysToBlocks(180, helperConfig.getBlocksPerHour(block.chainid)), // look back period in blocks = 30 days.
                    2 // number of tokens required
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // REVOKE MEMBERSHIP //
        inputParams = new string[](1);
        inputParams[0] = "address MemberAddress";

        // Members: veto Revoke Membership
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Revoke Membership: Members can veto revoking membership from other members.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Revoke Membership
        mandateCount++;
        conditions.allowedRole = 2; // = Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 10 minutes timelock before execution.
        conditions.needNotFulfilled = mandateCount - 1; // need the veto to have NOT been fulfilled.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Membership: Executives can revoke membership from members.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Advanced"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.revokeRole.selector, // function selector to call
                    abi.encode(1), // params before (role id 1 = Members) // the static params
                    inputParams, // the dynamic params (the input params of the parent mandate)
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // ELECT EXECUTIVES //
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Members: create election
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Executives according to MD, but code says Members)
        conditions.throttleExecution = minutesToBlocks(7, helperConfig.getBlocksPerHour(block.chainid)); // = once every 7 minutes
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create an Executive election: an election for the executive role can be initiated be any member.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    ElectionList.createElection.selector, // selector
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Open Vote for election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.needFulfilled = mandateCount - 1; // = Create election
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open voting for Executive election: Members can open the vote for an executive election. This will create a dedicated vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"), // the vote mandate address
                    1, // the max number of votes a voter can cast
                    1 // the role Id allowed to vote (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Tally election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Open Vote election
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Executive elections: After an executive election has finished, assign the Executive role to the winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    2, // RoleId for Executives
                    5 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: clean up election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Tally Executive election
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean up Executive election: After an executive election has finished, clean up related mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.revokeMandate.selector, // function selector to call
                    abi.encode(), // params before
                    inputParams, // dynamic params (the input params of the parent mandate)
                    mandateCount - 2, // parent mandate id (the open vote  mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // VOTE OF NO CONFIDENCE // 
        // very similar to elect executives, but no throttle, higher threshold and ALL executives get role revoked the moment the first mandate passes.
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Members: Vote of No Confidence 
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 77; // high majority
        conditions.quorum = 60; // = high quorum 
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Vote of No Confidence: Revoke Executive statuses.",
                targetMandate: initialisePowers.getInitialisedAddress("RevokeAccountsRoleId"),
                config: abi.encode(
                    2, // roleId
                    inputParams // the input params to fill out.
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: create election
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Executives according to MD, but code says Members)
        conditions.needFulfilled = mandateCount - 1; // = previous Vote of No Confidence mandate. Note: NO throttle on this one.
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create an Executive election: an election for the executive role can be initiated be any member.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    ElectionList.createElection.selector, // selector
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Open Vote for election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.needFulfilled = mandateCount - 1; // = Create election
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open voting for Executive election: Members can open the vote for an executive election. This will create a dedicated vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"), // the vote mandate address
                    1, // the max number of votes a voter can cast
                    1 // the role Id allowed to vote (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Tally election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Open Vote election
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Executive elections: After an executive election has finished, assign the Executive role to the winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    2, // RoleId for Executives
                    5 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: clean up election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Tally election
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean up Executive election: After an executive election has finished, clean up related mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.revokeMandate.selector, // function selector to call
                    abi.encode(), // params before
                    inputParams, // dynamic params (the input params of the parent mandate)
                    mandateCount - 2, // parent mandate id (the open vote  mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Nominate for Executive election
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Executives according to MD, but code says Members)
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Nominate for election: any member can nominate for an election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    true // nominate as candidate
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members revoke nomination for Executive election.
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Executives according to MD, but code says Members)
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke nomination for election: any member can revoke their nomination for an election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    false // revoke nomination
                ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                        REFORM MANDATES                           //
        //////////////////////////////////////////////////////////////////////

        // ADOPT MANDATE //
        string[] memory adoptMandatesParams = new string[](2);
        adoptMandatesParams[0] = "address[] mandates";
        adoptMandatesParams[1] = "uint256[] roleIds";

        // executives: Propose Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 2; // Executives
        // Note: voting time is longer than the voting time for the 
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initiate mandate adoption: Any executive can propose adopting new mandates into the organization.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;

        uint16 initiateReformId = mandateCount; // Store the ID of the initiate mandate

        // Members: Veto Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 66;
        conditions.quorum = 77;
        conditions.needFulfilled = initiateReformId;
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Adopting Mandates: Members can veto proposals to adopt new mandates",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 vetoMembersId = mandateCount;

        // Digital sub-DAO: Veto Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 5; // Digital sub-DAO
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        conditions.quorum = 10;
        conditions.needFulfilled = initiateReformId;
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Adopting Mandates: Digital sub-DAO can veto proposals to adopt new mandates",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 vetoDigitalId = mandateCount;

        // Ideas sub-DAOs: Veto Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 4; // Ideas sub-DAO
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        conditions.quorum = 10;
        conditions.needFulfilled = initiateReformId;
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Adopting Mandates: Ideas sub-DAO can veto proposals to adopt new mandates",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 vetoIdeasId = mandateCount;

        // Physical sub-DAOs: Veto Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 3; // Physical sub-DAO
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        conditions.quorum = 10;
        conditions.needFulfilled = initiateReformId;
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Adopting Mandates: Physical sub-DAO can veto proposals to adopt new mandates",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 vetoPhysicalId = mandateCount;

        // Checkpoint 1: Executives confirm Members Veto passed (or timed out without veto)
        string[] memory emptyParams = new string[](0);
        mandateCount++;
        conditions.allowedRole = 2; // Executives
        conditions.needFulfilled = initiateReformId;
        conditions.needNotFulfilled = vetoMembersId;
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // Match voting period
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Reform Checkpoint 1: Executives confirm Members did not veto.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(emptyParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 checkpoint1Id = mandateCount;

        // Checkpoint 2: Executives confirm Digital Veto passed
        mandateCount++;
        conditions.allowedRole = 2; // Executives
        conditions.needFulfilled = checkpoint1Id;
        conditions.needNotFulfilled = vetoDigitalId;
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Reform Checkpoint 2: Executives confirm Digital sub-DAO did not veto.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(emptyParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 checkpoint2Id = mandateCount;

        // Checkpoint 3: Executives confirm Ideas Veto passed
        mandateCount++;
        conditions.allowedRole = 2; // Executives
        conditions.needFulfilled = checkpoint2Id;
        conditions.needNotFulfilled = vetoIdeasId;
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Reform Checkpoint 3: Executives confirm Ideas sub-DAO did not veto.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(emptyParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 checkpoint3Id = mandateCount;

        // Executives: Adopt Mandates (Final Step)
        mandateCount++;
        conditions.allowedRole = 2; // Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); 
        conditions.timelock = minutesToBlocks(10, helperConfig.getBlocksPerHour(block.chainid)); // timelock after voting before execution to give organisations the time to veto.
        conditions.succeedAt = 66;
        conditions.quorum = 80;
        conditions.needFulfilled = checkpoint3Id;
        conditions.needNotFulfilled = vetoPhysicalId;
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Adopt new Mandates: Executives can adopt new mandates into the organization",
                targetMandate: initialisePowers.getInitialisedAddress("Mandates_Adopt"),
                config: abi.encode(),
                conditions: conditions
            })
        );
        delete conditions;
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    //                       DIGITAL DAO CONSTITUTION                         //
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    function createDigitalConstitution() internal {
        mandateCount = 0; // resetting mandate count. // there are 2 initial mandates already in the digital DAO.
        //////////////////////////////////////////////////////////////////////
        //                              SETUP                               //
        //////////////////////////////////////////////////////////////////////
        calldatas = new bytes[](10);
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Members", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Conveners", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigtyqevb7k36goevp6qzc6we4svp2lgrat766yuek4c4uqwkkbzj4"); 
        calldatas[4] = abi.encodeWithSelector(IPowers.labelRole.selector, 6, "Primary DAO", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigyjza3njovqsfaoi2x752igidfieg4yny6thzijbykjvkkzlvkdy"); 
        calldatas[5] = abi.encodeWithSelector(IPowers.assignRole.selector, 1, cedars);
        calldatas[6] = abi.encodeWithSelector(IPowers.assignRole.selector, 2, cedars);
        calldatas[7] = abi.encodeWithSelector(IPowers.assignRole.selector, 3, cedars);
        calldatas[8] = abi.encodeWithSelector(IPowers.assignRole.selector, 6, primaryDAO);
        calldatas[9] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1); // revoke mandate 1 after use.

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels and revokes itself after execution",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_OnOwnPowers"),
                config: abi.encode(calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                      EXECUTIVE MANDATES                          //
        //////////////////////////////////////////////////////////////////////

        // REQUEST ALLOWANCES FROM PRIME DAO //
        inputParams = new string[](5);
        inputParams[0] = "address Sub-DAO";
        inputParams[1] = "address Token";
        inputParams[2] = "uint96 allowanceAmount";
        inputParams[3] = "uint16 resetTimeMin";
        inputParams[4] = "uint32 resetBaseMin";
 
        // Members: Veto request allowance from Primary DAO
        mandateCount++;
        conditions.allowedRole = 1; // Members 
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto request allowance: Members can veto a request for additional allowance", //
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Conveners: Request allowance from Primary DAO
        mandateCount++;
        conditions.allowedRole = 2; // Conveners 
        conditions.needNotFulfilled = mandateCount - 1;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 66;
        conditions.quorum = 80;
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request allowance: Conveners can request an allowance from the Primary DAO Safe Treasury.",
                targetMandate: initialisePowers.getInitialisedAddress("PowersAction_Simple"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    requestAllowanceDigitalDAOId, // parent mandate id (the request allowance at primary DAO mandate)
                    "Requesting allowance from Primary DAO Safe Treasury",
                    inputParams // dynamic params (the input params of the parent mandate)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // PAYMENT OF RECEIPTS //
        inputParams = new string[](3);
        inputParams[0] = "address Token";
        inputParams[1] = "uint256 Amount";
        inputParams[2] = "address PayableTo";

        // Public: Submit a receipt (Payment Reimbursement - After Action)
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // This is a public mandate. Anyone can call it.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Submit a Receipt: Anyone can submit a receipt for payment reimbursement.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Conveners: OK Receipt (Avoid Spam)
        mandateCount++;
        conditions.allowedRole = 2; // Any convener can ok a receipt.
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "OK a receipt: Any convener can ok a receipt for payment reimbursement.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Conveners: Approve Payment of Receipt
        mandateCount++;
        conditions.allowedRole = 2; // Conveners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 67;
        conditions.quorum = 50;
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Approve payment of receipt: Execute a transaction from the Safe Treasury.",
                targetMandate: initialisePowers.getInitialisedAddress("SafeAllowance_Transfer"),
                config: abi.encode(helperConfig.getSafeAllowanceModule(block.chainid), treasury),
                conditions: conditions
            })
        );
        delete conditions;

        // PAYMENT OF PROJECTS //
        inputParams = new string[](3);
        inputParams[0] = "address Token";
        inputParams[1] = "uint256 Amount";
        inputParams[2] = "address PayableTo";

        // Members: Submit a project (Payment Before Action)
        mandateCount++;
        conditions.allowedRole = 1; // Members can propose a project.
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        conditions.quorum = 5; // note the low quorum to encourage proposals.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Submit a project for Funding: Any member can submit a project for funding.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Conveners: Approve Funding of Project
        mandateCount++;
        conditions.allowedRole = 2; // Conveners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 67;
        conditions.quorum = 50;
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Approve funding of project: Execute a transaction from the Safe Treasury.",
                targetMandate: initialisePowers.getInitialisedAddress("SafeAllowance_Transfer"),
                config: abi.encode(helperConfig.getSafeAllowanceModule(block.chainid), treasury),
                conditions: conditions
            })
        );
        delete conditions;

        // UPDATE URI //
        inputParams = new string[](1);
        inputParams[0] = "string newUri";

        // Conveners: Update URI
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 66; // = 2/3 majority
        conditions.quorum = 66; // = 66% quorum
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Update URI: Set allowed token for Physical sub-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers"),
                config: abi.encode(
                    Powers.setUri.selector, // function selector to call
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // TRANSFER TOKENS INTO TREASURY //
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners. Any convener can call this mandate.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Transfer tokens to treasury: Any tokens accidently sent to the DAO can be recovered by sending them to the treasury",
                targetMandate: initialisePowers.getInitialisedAddress("Safe_RecoverTokens"),
                config: abi.encode(
                    treasury, // this should be the safe treasury!
                    helperConfig.getSafeAllowanceModule(block.chainid) // allowance module address
                ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                      ELECTORAL MANDATES                          //
        //////////////////////////////////////////////////////////////////////

        // ASSIGN MEMBERSHIP // -- on the basis of contributions to website
        // TODO: needs to be configured with github repo details etc.
        string[] memory paths = new string[](3);
        paths[0] = "documentation"; // can be anything
        paths[1] = "frontend";
        paths[2] = "solidity";
        uint256[] memory roleIds = new uint256[](3);
        roleIds[0] = 2;
        roleIds[1] = 3;
        roleIds[2] = 4;

        // Public: Apply for member role
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Public
        conditions.throttleExecution = minutesToBlocks(3, helperConfig.getBlocksPerHour(block.chainid)); // to avoid spamming, the law is throttled.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Apply for Member Role: Anyone can claim member roles based on their GitHub contributions to the DAO's repository", // crrently the path is set at cedars/powers
                targetMandate: initialisePowers.getInitialisedAddress("Github_ClaimRoleWithSig"), // TODO: needs to be more configurable
                config: abi.encode(
                    "develop", // branch
                    paths,
                    roleIds,
                    "signed", // signatureString
                    helperConfig.getChainlinkFunctionsSubscriptionId(block.chainid),
                    helperConfig.getChainlinkFunctionsGasLimit(block.chainid),
                    helperConfig.getChainlinkFunctionsDonId(block.chainid)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Public: Claim Member Role
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Public
        conditions.needFulfilled = mandateCount - 1; // must have applied for member role.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Claim Member Role: Following a successful initial claim, members can get member role assigned to their account.",
                targetMandate: initialisePowers.getInitialisedAddress("Github_AssignRoleWithSig"),
                config: abi.encode(), // empty config
                conditions: conditions
            })
        );
        delete conditions;

        // REVOKE MEMBERSHIP //
        inputParams = new string[](1);
        inputParams[0] = "address MemberAddress";

        // Members: veto Revoke Membership
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Revoke Membership: Members can veto revoking membership from other members.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Revoke Membership
        mandateCount++;
        conditions.allowedRole = 2; // = Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 10 minutes timelock before execution.
        conditions.needNotFulfilled = mandateCount - 1; // need the veto to have NOT been fulfilled.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Membership: Executives can revoke membership from members.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_Advanced"),
                config: abi.encode(
                    IPowers.revokeRole.selector, // function selector to call
                    abi.encode(1), // params before (role id 1 = Members) // the static params
                    inputParams, // the dynamic params (the input params of the parent mandate)
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;


        // ELECT CONVENERS //
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Members: create election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.throttleExecution = minutesToBlocks(120, helperConfig.getBlocksPerHour(block.chainid)); // = once every 2 hours
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create a Convener election: an election for the convener role can be initiated be any member.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    ElectionList.createElection.selector, // selector
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Open Vote for election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.needFulfilled = mandateCount - 1; // = Create election
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open voting for Convener election: Members can open the vote for a convener election. This will create a dedicated vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"), // the vote mandate address
                    1, // the max number of votes a voter can cast
                    1 // the role Id allowed to vote (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Tally election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Open Vote election
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Convener elections: After a convener election has finished, assign the Convener role to the winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    2, // RoleId for Conveners
                    3 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: clean up election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Tally election
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean up Convener election: After an election has finished, clean up related mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(digitalSubDAO), // target contract
                    IPowers.revokeMandate.selector, // function selector to call
                    abi.encode(), // params before
                    inputParams, // dynamic params (the input params of the parent mandate)
                    mandateCount - 2, // parent mandate id (the open vote mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // VOTE OF NO CONFIDENCE // 
        // very similar to elect conveners, but no throttle, higher threshold and ALL executives get role revoked the moment the first mandate passes.
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Members: Vote of No Confidence 
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 77; // high majority
        conditions.quorum = 60; // = high quorum 
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Vote of No Confidence: Revoke Convener statuses.",
                targetMandate: initialisePowers.getInitialisedAddress("RevokeAccountsRoleId"),
                config: abi.encode(
                    2, // roleId
                    inputParams // the input params to fill out.
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: create election
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Convener according to MD, but code says Members)
        conditions.needFulfilled = mandateCount - 1; // = previous Vote of No Confidence mandate. Note: NO throttle on this one.
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create a Convener election: an election for the convener role can be initiated be any member.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    ElectionList.createElection.selector, // selector
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Open Vote for election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.needFulfilled = mandateCount - 1; // = Create election
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open voting for Convener election: Members can open the vote for a convener election. This will create a dedicated vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"), // the vote mandate address
                    1, // the max number of votes a voter can cast
                    1 // the role Id allowed to vote (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Tally election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Open Vote election
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Convener elections: After a convener election has finished, assign the Convener role to the winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    2, // RoleId for Conveners
                    5 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: clean up election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Tally Convener election
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean up Convener election: After a convener election has finished, clean up related mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.revokeMandate.selector, // function selector to call
                    abi.encode(), // params before
                    inputParams, // dynamic params (the input params of the parent mandate)
                    mandateCount - 2, // parent mandate id (the open vote  mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Nominate for Executive election
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Conveners according to MD, but code says Members)
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Nominate for election: any member can nominate for an election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    true // nominate as candidate
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members revoke nomination for Executive election.
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Conveners according to MD, but code says Members) 
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke nomination for election: any member can revoke their nomination for an election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    false // revoke nomination
                ),
                conditions: conditions
            })
        );
        delete conditions;


        //////////////////////////////////////////////////////////////////////
        //                        REFORM MANDATES                           //
        //////////////////////////////////////////////////////////////////////

        // ADOPT MANDATES //
        string[] memory adoptMandatesParams = new string[](2);
        adoptMandatesParams[0] = "address[] mandates";
        adoptMandatesParams[1] = "uint256[] roleIds";

        // Members: initiate Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 66;
        conditions.quorum = 77;
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initiate Adopting Mandates: Members can initiate adopting new mandates",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;

        // PrimaryDAO: Veto Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 6; // PrimaryDAO
        conditions.needFulfilled = mandateCount - 1;
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Adopting Mandates: PrimaryDAO can veto proposals to adopt new mandates", // TODO: PrimaryDAO actually does not have a law yet to cast a veto..
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;

        // // Conveners: Adopt Mandates
        mandateCount++;
        conditions.allowedRole = 2; // Conveners
        conditions.needFulfilled = mandateCount - 2;
        conditions.needNotFulfilled = mandateCount - 1;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 66;
        conditions.quorum = 80;
        digitalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Adopt new Mandates: Conveners can adopt new mandates into the organization",
                targetMandate: initialisePowers.getInitialisedAddress("Mandates_Adopt"),
                config: abi.encode(),
                conditions: conditions
            })
        );
        delete conditions;
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    //                        IDEAS DAO CONSTITUTION                          //
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    function createIdeasConstitution() internal {
        mandateCount = 0; // resetting mandate count.
        //////////////////////////////////////////////////////////////////////
        //                              SETUP                               //
        //////////////////////////////////////////////////////////////////////
        // setup role labels // 
        calldatas = new bytes[](11);
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Members", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Conveners", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigtyqevb7k36goevp6qzc6we4svp2lgrat766yuek4c4uqwkkbzj4"); 
        calldatas[4] = abi.encodeWithSelector(IPowers.labelRole.selector, 3, "Moderators", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreih7dlv7qlbei3tbxazdkx4bzbjf2mpf656tr5v5uhmy5k4vtdcnqm"); // For now uses the uri of auditors. 
        calldatas[5] = abi.encodeWithSelector(IPowers.labelRole.selector, 6, "Primary DAO", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigyjza3njovqsfaoi2x752igidfieg4yny6thzijbykjvkkzlvkdy");
        calldatas[6] = abi.encodeWithSelector(IPowers.assignRole.selector, 1, cedars);
        calldatas[7] = abi.encodeWithSelector(IPowers.assignRole.selector, 2, cedars);
        calldatas[8] = abi.encodeWithSelector(IPowers.assignRole.selector, 3, cedars);
        calldatas[9] = abi.encodeWithSelector(IPowers.assignRole.selector, 6, address(primaryDAO)); 
        calldatas[10] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1); // revoke mandate 1 after use.

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels and revokes itself after execution",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_OnOwnPowers"),
                config: abi.encode(calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                      EXECUTIVE MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        // REQUEST CREATION NEW PHYSICAL DAO
        inputParams = new string[](1); // no input params, as all params are set in the config of the mandate.
        inputParams[0] = "address Admin"; // the only input param is the new URI for the physical sub-DAO, which will be used by conveners when requesting the creation of a new physical sub-DAO.

        // Members: Initialise request for new physical sub-DAO.
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // 5 minutes to vote
        conditions.succeedAt = 51; // simple majority
        conditions.quorum = 5; // low quorum. Many members might not be very active.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request new Physical sub-DAO: Members can initiate the request for creating a new Physical sub-DAO under the Primary DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions; 

        // Moderators: Veto request for new physical sub-DAO
        mandateCount++;
        conditions.allowedRole = 3; // = Moderators
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled (Members need to have initiated the request for a new physical sub-DAO).
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto request for new Physical sub-DAO: Moderators can veto the request for creating a new Physical sub-DAO under the Primary DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Conveners: request at Primary DAO the creation of a new physical DAO.
        // Note: this is a statement of intent. Physical DAOs are requested using a working group, after initated here by conveners.
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners
        conditions.quorum = 51; // simple majority
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // 10 minutes to vote
        conditions.succeedAt = 51; // simple majority
        conditions.needFulfilled = mandateCount - 2; // need the Members to have initiated the request for a new physical sub-DAO.
        conditions.needNotFulfilled = mandateCount - 1; // need the Moderators to NOT have vetoed the request for a new physical sub-DAO.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request new Physical sub-DAO: Conveners can create a new Physical sub-DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("PowersAction_Simple"),
                config: abi.encode( 
                    address(primaryDAO),
                    requestNewPhysicalDaoId, // parent mandate id (the create new physical sub-DAO at primary DAO mandate)
                    "Requesting creation of new Physical sub-DAO from Primary DAO", // description
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 requestNewPhysicalDaoWorkingGroupMandateId = mandateCount;

        // UPDATE URI //
        inputParams = new string[](1);
        inputParams[0] = "string newUri";

        // Conveners: Update URI
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 66; // = 2/3 majority
        conditions.quorum = 66; // = 66% quorum
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Update URI: Set allowed token for Physical sub-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers"),
                config: abi.encode(
                    Powers.setUri.selector, // function selector to call
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // TRANSFER TOKENS INTO TREASURY //
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners. Any convener can call this mandate.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Transfer tokens to treasury: Any tokens accidently sent to the DAO can be recovered by sending them to the treasury",
                targetMandate: initialisePowers.getInitialisedAddress("Safe_RecoverTokens"),
                config: abi.encode(
                    treasury, // this should be the safe treasury!
                    helperConfig.getSafeAllowanceModule(block.chainid) // allowance module address
                ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                      ELECTORAL MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        // ASSIGN MEMBERSHIP // moderators assign membership following an application be a public participant. 
        // Assessment is based on forum particpation, and possibly a short interview.

        // public: apply for membership
        inputParams = new string[](2);
        inputParams[0] = "address ApplicantAddress";
        inputParams[1] = "string ApplicationURI";

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = Public
        conditions.throttleExecution = minutesToBlocks(10, helperConfig.getBlocksPerHour(block.chainid)); // to avoid spamming, the law is throttled.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Apply for Membership: Anyone can apply for membership to the DAO by submitting an application.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // moderators: assess and assign membership
        mandateCount++;
        conditions.allowedRole = 3; // = Moderators
        conditions.needFulfilled = mandateCount - 1; // need the application to have been submitted.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assess and Assign Membership: Moderators can assess applications and assign membership to applicants.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_Advanced"),
                config: abi.encode( 
                    IPowers.assignRole.selector, // function selector to call
                    abi.encode(1), // params before (role id 1 = Members) // the static params
                    inputParams, // the dynamic params (the input params of the parent mandate) -- NB: not that any excess data at the END OF CALLDATA is ignored. hence we can add the uri - it will not be taken into consideration. 
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // REVOKE MEMBERSHIP // Moderators can revoke membership following bad behaviour on forum etc.
        // Members: veto Revoke Membership
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        conditions.needFulfilled = mandateCount - 1; // need the revoke membership mandate to have been fulfilled for the veto to be valid.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Revoke Membership: Members can veto revoking membership from other members.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Moderators: Revoke Membership
        // Note: even though the inputParams also have the URI included (which is not needed for revoking membership), we keep the same inputParams for both the assign and revoke mandate, as the excess params will simply be ignored.
        mandateCount++;
        conditions.allowedRole = 3; // = Moderators
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 10 minutes timelock before execution.
        conditions.needNotFulfilled = mandateCount - 1; // need the veto to have NOT been fulfilled.
        conditions.needFulfilled = mandateCount - 2; // need the revoke membership mandate to have been fulfilled.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Membership: Moderators can revoke membership from members.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_Advanced"),
                config: abi.encode( 
                    IPowers.revokeRole.selector, // function selector to call
                    abi.encode(1), // params before (role id 1 = Members) // the static params
                    inputParams, // the dynamic params (the input params of the parent mandate)
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // REQUEST MEMBERSHIP OF PRIMARY DAO //
        inputParams = new string[](1);
        inputParams[0] = "uint256[] TokenIds";

        // Members: apply for membership of primary DAO. 
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Apply for Membership of Primary DAO: Members can apply for membership of the Primary DAO by submitting a request with their POAPs.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // moderators: ok and send request to primary DAO. 
        mandateCount++;
        conditions.allowedRole = 3; // = Moderators
        conditions.needFulfilled = mandateCount - 1; // need the application to have been submitted.
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // 5 minutes to vote
        conditions.succeedAt = 51; // simple majority
        conditions.quorum = 77; // high quorum to ensure only clear applications pass.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request Membership of Primary DAO: Moderators can ok requests for membership of the Primary DAO and send them to the Primary DAO for assessment.",
                targetMandate: initialisePowers.getInitialisedAddress("PowersAction_Simple"),
                config: abi.encode( 
                    address(primaryDAO),
                    requestMembershipPrimaryDaoId, // parent mandate id (the request membership of primary DAO mandate)
                    "Requesting membership of Primary DAO", // description
                    inputParams
                ),
                conditions: conditions
            })
        ); 
        delete conditions;

        // ASSIGN AND REVOKE MODERATORS // 
        inputParams = new string[](1);
        inputParams[0] = "address Account";
        
        // members: veto assigning moderator role.
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 70; // = Note: high threshold.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Assign Moderator Role: Members can veto assigning the Moderator role to an account.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // conveners: assign moderator role.
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = simple majority
        conditions.quorum = 30; // = relatively low threshold.
        conditions.needNotFulfilled = mandateCount - 1; // need the veto to have NOT been fulfilled.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assign Moderator Role: Conveners can assign the Moderator role to an account.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_Advanced"),
                config: abi.encode( 
                    IPowers.assignRole.selector, // function selector to call
                    abi.encode(3), // params before (role id 3 = Moderators) // the static params
                    inputParams, // the dynamic params (the input params of the parent mandate)
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // members: veto revoking moderator role.
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 70; // = Note: high threshold.
        conditions.needFulfilled = mandateCount - 1; // The moderator needs to have been assigned in the first place..
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Revoke Moderator Role: Members can veto revoking the Moderator role from an account.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // conveners: revoke moderator role.
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = simple majority
        conditions.quorum = 30; // = relatively low threshold.
        conditions.needNotFulfilled = mandateCount - 1; // need the veto to have NOT been fulfilled.
        conditions.needFulfilled = mandateCount - 2; // The moderator role needs to have been assigned.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Moderator Role: Conveners can revoke the Moderator role from an account.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_Advanced"),
                config: abi.encode( 
                    IPowers.revokeRole.selector, // function selector to call
                    abi.encode(3), // params before (role id 3 = Moderators) // the static params
                    inputParams, // the dynamic params (the input params of the parent mandate)
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // ELECT CONVENERS //
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Members: create election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.throttleExecution = minutesToBlocks(120, helperConfig.getBlocksPerHour(block.chainid)); // = once every 2 hours
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create a Convener election: an election for the convener role can be initiated be any member.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    ElectionList.createElection.selector, // selector
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Open Vote for Convener election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.needFulfilled = mandateCount - 1; // = Create Convener election
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open voting for Convener election: Members can open the vote for a convener election. This will create a dedicated vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"), // the vote mandate address
                    1, // the max number of votes a voter can cast
                    1 // the role Id allowed to vote (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Tally election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Open Vote election
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Convener elections: After a convener election has finished, assign the Convener role to the winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    2, // RoleId for Conveners
                    3 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: clean up Convener election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Tally Convener election
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean up Convener election: After a convener election has finished, clean up related mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CleanUpVoteMandate"),
                config: abi.encode(mandateCount - 2), // The create vote mandate)
                conditions: conditions
            })
        );
        delete conditions;

        // VOTE OF NO CONFIDENCE // 
        // very similar to elect conveners, but no throttle, higher threshold and ALL executives get role revoked the moment the first mandate passes.
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Members: Vote of No Confidence 
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 77; // high majority
        conditions.quorum = 60; // = high quorum 
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Vote of No Confidence: Revoke Convener statuses.",
                targetMandate: initialisePowers.getInitialisedAddress("RevokeAccountsRoleId"),
                config: abi.encode(
                    2, // roleId
                    inputParams // the input params to fill out.
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: create Convener election
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Convener according to MD, but code says Members)
        conditions.needFulfilled = mandateCount - 1; // = previous Vote of No Confidence mandate. Note: NO throttle on this one.
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create a Convener election: an election for the convener role can be initiated be any member.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    ElectionList.createElection.selector, // selector
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Open Vote for election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.needFulfilled = mandateCount - 1; // = Create election
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open voting for Convener election: Members can open the vote for a convener election. This will create a dedicated vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"), // the vote mandate address
                    1, // the max number of votes a voter can cast
                    1 // the role Id allowed to vote (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Tally election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Open Vote election
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Convener elections: After a convener election has finished, assign the Convener role to the winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    2, // RoleId for Conveners
                    5 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: clean up Convener election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Tally Convener election
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean up Convener election: After a convener election has finished, clean up related mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_OnReturnValue"),
                config: abi.encode( 
                    IPowers.revokeMandate.selector, // function selector to call
                    abi.encode(), // params before
                    inputParams, // dynamic params (the input params of the parent mandate)
                    mandateCount - 2, // parent mandate id (the open vote  mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Nominate for Executive election
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Conveners according to MD, but code says Members)
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Nominate for election: any member can nominate for an election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    true // nominate as candidate
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members revoke nomination for Executive election.
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Conveners according to MD, but code says Members) 
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke nomination for election: any member can revoke their nomination for an election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    false // revoke nomination
                ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                        REFORM MANDATES                           //
        //////////////////////////////////////////////////////////////////////

        // Adopt mandate //
        inputParams = new string[](2);
        inputParams[0] = "address[] mandates";
        inputParams[1] = "uint256[] roleIds";

        // Members: Veto Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 66;
        conditions.quorum = 77;
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Adopting Mandates: Members can veto proposals to adopt new mandates",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Conveners: Adopt Mandates
        mandateCount++;
        conditions.allowedRole = 2; // Conveners
        conditions.needNotFulfilled = mandateCount - 1;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 66;
        conditions.quorum = 80;
        ideasConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Adopt new Mandates: Conveners can adopt new mandates into the organization",
                targetMandate: initialisePowers.getInitialisedAddress("Mandates_Adopt"),
                config: abi.encode(),
                conditions: conditions
            })
        );
        delete conditions;
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    //                       PHYSICAL DAO CONSTITUTION                        //
    //////////////////////////////////////////////////////////////////////////// 
    ////////////////////////////////////////////////////////////////////////////

    function createPhysicalConstitution() internal {
        mandateCount = 0; // resetting mandate count. 
        //////////////////////////////////////////////////////////////////////
        //                              SETUP                               //
        //////////////////////////////////////////////////////////////////////
        // setup role labels // 
        calldatas = new bytes[](9);
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Members", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Conveners", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigtyqevb7k36goevp6qzc6we4svp2lgrat766yuek4c4uqwkkbzj4"); 
        calldatas[4] = abi.encodeWithSelector(IPowers.labelRole.selector, 6, "Primary DAO", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreigyjza3njovqsfaoi2x752igidfieg4yny6thzijbykjvkkzlvkdy");
        calldatas[5] = abi.encodeWithSelector(IPowers.assignRole.selector, 1, cedars);
        calldatas[6] = abi.encodeWithSelector(IPowers.assignRole.selector, 2, cedars);
        calldatas[7] = abi.encodeWithSelector(IPowers.assignRole.selector, 6, address(primaryDAO)); 
        calldatas[8] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1); // revoke mandate 1 after use.

        // NB: The physical sub-DAO does NOT have a safe of its own.  

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public.
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels and revokes itself after execution",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_OnOwnPowers"),
                config: abi.encode(calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        // LEGAL REPS ASSIGN EXECUTIVE MANDATES 
        // £TODO 

        // LEGAL REPS REVOKE EXECUTIVE MANDATES
        // £TODO

        //////////////////////////////////////////////////////////////////////
        //                      EXECUTIVE MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        // £NB: Minting and setting the URI no all managed externally from this DAO. 
        // The artist has to assign the sub-DAO as approved to transfer artworks. 
  
        // £todo 
        // SELL NFT ART WORK + PAYMENT // - link to physical art set in URI. 
        // Public: Buy NFT. Calls the safe transferFrom function in governed721. 
        // Automatically the Artist, owner and intermediary (= Physical sub-DAO) get paid according to splits set in the URI.
        // The physical sub-DAO can forward funds to the Primary-DAOs safe.   
          
        // FORCE NFT SALE // 
        // Convener: Sell NFT. -- payment pulled from buyer, calculates splits and send to 1) physcical Sub-DAO safe, Primary DAO safe and artists wallet. // Local activity token is minted and send to caller. // NFT send to buyer.  
        // £todo: discuss & brainstorm how to implement this.
        // Maybe use a deposit of sorts at Primary-DAO?  

        // PAYMENT OF RECEIPTS //
        inputParams = new string[](3);
        inputParams[0] = "address Token";
        inputParams[1] = "uint256 Amount";
        inputParams[2] = "address PayableTo";

        // Public: Submit a receipt (Payment Reimbursement - After Action)
        mandateCount++;
        conditions.allowedRole = 1; // This is a public mandate. Anyone can call it.
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Submit a Receipt: Members can submit a receipt for payment reimbursement.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Conveners: Approve Payment of Receipt
        mandateCount++;
        conditions.allowedRole = 2; // Conveners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 67;
        conditions.quorum = 50;
        conditions.needFulfilled = mandateCount - 1; // need the previous mandate to be fulfilled.
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Approve payment of receipt: Execute a transaction from the Safe Treasury.",
                targetMandate: initialisePowers.getInitialisedAddress("SafeAllowance_Transfer"),
                config: abi.encode(helperConfig.getSafeAllowanceModule(block.chainid), treasury),
                conditions: conditions
            })
        );
        delete conditions;

        // MINT POAPS FOR ATTENDEES // 
        // £todo: replace this with a mint in a standard ERC-721 contract called "POAP".  
        inputParams = new string[](1);
        inputParams[0] = "address To";

        // Convener: Mint POAP
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Mint POAP: Any Convener can mint a POAP.",
                targetMandate: initialisePowers.getInitialisedAddress("PowersAction_Simple"),
                config: abi.encode(
                    address(primaryDAO),
                    mintPoapTokenId, // parent mandate id (the mint POAP token at primary DAO mandate)
                    "Requesting minting of POAP from Primary DAO",
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // MINT & DISTRIBUTE 'MERIT' NFTS TO ATTENDEES THROUGH VOTING ON CONTRIBUTIONS //
        // £TODO 
        
        // MINT & DISTRIBUTE 'MERIT' NFTS TO ARTIST THROUGH VOTING ON ART WORKS //
        // £TODO 

        // MINT & DISTRIBUTE 'MERIT' NFTS TO CONVENERS //
        // £TODO 

        // REDEEM MERIT NFTS FOR REWARD  //
        // £TODO  

        // UPDATE URI //
        inputParams = new string[](1);
        inputParams[0] = "string newUri"; 

        // Conveners: Update URI
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 66; // = 2/3 majority
        conditions.quorum = 66; // = 66% quorum
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Update URI: Set allowed token for Physical sub-DAO",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers"),
                config: abi.encode(
                    Powers.setUri.selector, // function selector to call
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // TRANSFER TOKENS INTO TREASURY //
        mandateCount++;
        conditions.allowedRole = 2; // = Conveners. Any convener can call this mandate.
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Transfer tokens to treasury: Any tokens accidently sent to the DAO can be recovered by sending them to the treasury",
                targetMandate: initialisePowers.getInitialisedAddress("Safe_RecoverTokens"), // maybe functionality has to change slightly: have token to be transferred as input param. 
                config: abi.encode(
                    treasury, // £todo this should be the safe treasury of the subDAO!! 
                    helperConfig.getSafeAllowanceModule(block.chainid) // allowance module address
                ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                      ELECTORAL MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        // CLAIM ATTENDEE ROLE // 
        // £TODO - REWORK BELOW. 
        // I THINK I CAN USE GATED ACCESS 721. 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request Membership: Anyone can become a member if they have sufficient activity token from the DAO 1 tokens during the last 15 days.",
                targetMandate: initialisePowers.getInitialisedAddress("GovernedToken_GatedAccess"),
                config: abi.encode(
                    address(governed1155), // soulbound token contract
                    1, // member role Id
                    0, // checks if token is from address that holds role Id 0 (meaning the admin, which is the DAO itself).
                    1, // number of tokens required. Only one POAP needed for membership.
                    daysToBlocks(15, helperConfig.getBlocksPerHour(block.chainid)) // look back period in blocks = 15 days.
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // REVOKE MEMBERSHIP // -- DO I NEED THIS? OR WILL JUST END WITH END OF DAO? 
        inputParams = new string[](1);
        inputParams[0] = "address MemberAddress";

        // Members: veto Revoke Membership
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Revoke Membership: Members can veto revoking membership from other members.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Executives: Revoke Membership
        mandateCount++;
        conditions.allowedRole = 2; // = Executives
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 51; // = 51% majority
        conditions.quorum = 77; // = Note: high threshold.
        conditions.timelock = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 10 minutes timelock before execution.
        conditions.needNotFulfilled = mandateCount - 1; // need the veto to have NOT been fulfilled.
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Membership: Executives can revoke membership from members.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers_Advanced"),
                config: abi.encode(
                    IPowers.revokeRole.selector, // function selector to call
                    abi.encode(1), // params before (role id 1 = Members) // the static params
                    inputParams, // the dynamic params (the input params of the parent mandate)
                    abi.encode() // no args after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // ELECT CONVENERS //
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Members: create election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.throttleExecution = minutesToBlocks(120, helperConfig.getBlocksPerHour(block.chainid)); // = once every 2 hours
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create a Convener election: an election for the convener role can be initiated be any member.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    ElectionList.createElection.selector, // selector
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Open Vote for election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.needFulfilled = mandateCount - 1; // = Create election
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open voting for Convener election: Members can open the vote for a convener election. This will create a dedicated vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"), // the vote mandate address
                    1, // the max number of votes a voter can cast
                    1 // the role Id allowed to vote (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Tally election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Open Vote election
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Convener elections: After a convener election has finished, assign the Convener role to the winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    2, // RoleId for Conveners
                    3 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: clean up Convener election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Tally Convener election
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean up Convener election: After a convener election has finished, clean up related mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CleanUpVoteMandate"),
                config: abi.encode(mandateCount - 2), // The create vote mandate)
                conditions: conditions
            })
        );
        delete conditions;

        // VOTE OF NO CONFIDENCE // 
        // very similar to elect conveners, but no throttle, higher threshold and ALL executives get role revoked the moment the first mandate passes.
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        // Members: Vote of No Confidence 
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = 5 minutes / days
        conditions.succeedAt = 77; // high majority
        conditions.quorum = 60; // = high quorum 
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Vote of No Confidence: Revoke Convener statuses.",
                targetMandate: initialisePowers.getInitialisedAddress("RevokeAccountsRoleId"),
                config: abi.encode(
                    2, // roleId
                    inputParams // the input params to fill out.
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: create election
        mandateCount++;
        conditions.allowedRole = 1; // = Members (should be Convener according to MD, but code says Members)
        conditions.needFulfilled = mandateCount - 1; // = previous Vote of No Confidence mandate. Note: NO throttle on this one.
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create a Convener election: an election for the convener role can be initiated be any member.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    ElectionList.createElection.selector, // selector
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Open Vote for election
        mandateCount++;
        conditions.allowedRole = 1; // = Members
        conditions.needFulfilled = mandateCount - 1; // = Create election
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open voting for Convener election: Members can open the vote for a convener election. This will create a dedicated vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"), // the vote mandate address
                    1, // the max number of votes a voter can cast
                    1 // the role Id allowed to vote (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Tally election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Open Vote election
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Convener elections: After a convener election has finished, assign the Convener role to the winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"),
                    2, // RoleId for Conveners
                    5 // Max role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: clean up election
        mandateCount++;
        conditions.allowedRole = 1;
        conditions.needFulfilled = mandateCount - 1; // = Tally election
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean up Convener election: After a convener election has finished, clean up related mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(primaryDAO), // target contract
                    IPowers.revokeMandate.selector, // function selector to call
                    abi.encode(), // params before
                    inputParams, // dynamic params (the input params of the parent mandate)
                    mandateCount - 2, // parent mandate id (the open vote  mandate)
                    abi.encode() // no params after
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members: Nominate for election
        // NB, £TODO SHOULD HAVE ZKP CHECK. NOMINEES SHOULD PROVE THEY ARE RESIDENT IN UK FOR EXAMPLE.
        // HOW DO I MAKE THIS DYNAMIC? 
        mandateCount++;
        conditions.allowedRole = 1; // = Members 
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Nominate for election: any member can nominate for an election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    true // nominate as candidate
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Members revoke nomination for  election.
        mandateCount++;
        conditions.allowedRole = 1; // = Members  
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke nomination for election: any member can revoke their nomination for an election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(
                    initialisePowers.getInitialisedAddress("ElectionList"), // election list contract
                    false // revoke nomination
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // ASSIGN LEGAL REPS 
        // £TODO 
        // SHOULD HAVE ZKP CHECK! 

        //////////////////////////////////////////////////////////////////////
        //                        REFORM MANDATES                           //
        //////////////////////////////////////////////////////////////////////

        // ADOPT MANDATES //
        string[] memory adoptMandatesParams = new string[](2);
        adoptMandatesParams[0] = "address[] mandates";
        adoptMandatesParams[1] = "uint256[] roleIds";

        // Members: initiate Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 66;
        conditions.quorum = 77;
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initiate Adopting Mandates: Members can initiate adopting new mandates",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;

        // PrimaryDAO: Veto Adopting Mandates
        mandateCount++;
        conditions.allowedRole = 6; // PrimaryDAO = role 6. 
        conditions.needFulfilled = mandateCount - 1;
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Adopting Mandates: PrimaryDAO can veto proposals to adopt new mandates", // TODO: PrimaryDAO actually does not have a law yet to cast a veto..
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(adoptMandatesParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Conveners: Adopt Mandates
        mandateCount++;
        conditions.allowedRole = 2; // Conveners
        conditions.needFulfilled = mandateCount - 2;
        conditions.needNotFulfilled = mandateCount - 1;
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 66;
        conditions.quorum = 80;
        physicalConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Adopt new Mandates: Conveners can adopt new mandates into the organization",
                targetMandate: initialisePowers.getInitialisedAddress("Mandates_Adopt"),
                config: abi.encode(),
                conditions: conditions
            })
        );
        delete conditions;
    }

    //////////////////////////////////////////////////////////////
    //                      HELPER FUNCTIONS                    //
    //////////////////////////////////////////////////////////////
    function getPrimaryDAO() public view returns (Powers) {
        return primaryDAO;   
    }

    function getDigitalSubDAO() public view returns (Powers) {
        return digitalSubDAO;   
    }

    function getTreasury() public view returns (address treasuryAddress) {
        return primaryDAO.getTreasury();   
    } 
}

