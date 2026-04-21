// SPDX-License-Identifier: MIT
/*
  _____   ____  __          __ ______  _____    _____ 
 |  __ \ / __ \ \ \        / /|  ____||  __ \  / ____|
 | |__) | |  | | \ \  /\  / / | |__   | |__) || (___  
 |  ___/| |  | |  \ \/  \/ /  |  __|  |  _  /  \___ \ 
 | |    | |__| |   \  /\  /   | |____ | | \ \  ____) |
 |_|     \____/     \/  \/    |______||_|  \_\|_____/ 
                                                      
*/
/// @title Powers Protocol v.0.6.1
/// @notice A modular governance protocol enabling institutional design for on-chain organizations through role-based access control and separation of powers.
///
/// @dev Powers is built around three core concepts:
/// @dev 1. **Roles**: Define access identifiers for different participants in the organization.
/// @dev 2. **Mandates**: Modular smart contracts that transform governance proposals into executable actions. Each mandate is role-restricted and can include conditional logic (voting, delays, parent mandates, etc.).
/// @dev 3. **Actions**: The governance lifecycle (propose → vote → execute) that flows through this central Powers contract.
///
/// @dev Key Protocol Features:
/// @dev - Role-Based Governance: All governance actions are restricted by role assignments, enabling fine-grained access control.
/// @dev - Separation of Powers: Different roles can propose, vote on, veto, and execute actions, creating institutional checks and balances.
/// @dev - Modular Architecture: Governance logic lives in external mandate contracts, keeping the core protocol minimal and extensible.
/// @dev - Non-Weighted Voting: The core protocol uses one-account-one-vote. Accounts vote with their roles, not tokens.
/// @dev - On-Chain Data Preference: Maximizes on-chain storage to reduce reliance on indexers and centralized off-chain infrastructure.
///
/// @dev Implementation Notes:
/// @dev - This contract is the core engine and should be used as-is. Customizations should be implemented through mandates.
/// @dev - All DAO actions flow through Powers.sol governance functions, even non-voting actions.
/// @dev - Complex features (multi-chain governance, oracle-based governance, timelocks, weighted voting, staking, etc.) are added via mandates, not by modifying this core contract.
///
/// @dev For example organizational implementations, see the script/organisations folder.
///
/// @dev Roadmap:
/// @dev - Integration with new ENS standards for on-chain organizational metadata
/// @dev - Additional governance primitives and mandate templates
///
/// @author 7Cedars

pragma solidity ^0.8.26;

import { Mandate } from "./Mandate.sol";
import { IMandate } from "./interfaces/IMandate.sol";
import { IPowers } from "./interfaces/IPowers.sol";
import { Checks } from "./libraries/Checks.sol";
import { ERC165Checker } from "@lib/openzeppelin-contracts/contracts/utils/introspection/ERC165Checker.sol";
import { Address } from "@lib/openzeppelin-contracts/contracts/utils/Address.sol";
import { EIP712 } from "@lib/openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import { Context } from "@lib/openzeppelin-contracts/contracts/utils/Context.sol";

// import { console2 } from "forge-std/console2.sol"; // remove before deploying.

contract Powers is EIP712, IPowers, Context {
    //////////////////////////////////////////////////////////////
    //                           STORAGE                        //
    /////////////////////////////////////////////////////////////
    /// @dev Mapping from actionId to Action struct
    mapping(uint256 actionId => Action) internal _actions;
    /// @dev Mapping from mandateId to AdoptedMandate struct
    mapping(uint16 mandateId => AdoptedMandate) internal mandates;
    /// @dev Mapping from roleId to Role struct
    mapping(uint256 roleId => Role) internal roles;
    /// @dev Mapping from account to blacklisted status
    mapping(address account => bool blacklisted) internal _blacklist;
    /// @dev Mapping of trusted forwarders for meta-transactions (ERC-2771)
    mapping(address forwarder => bool trusted) public trustedForwarders;

    // two roles are preset: ADMIN_ROLE == 0 and PUBLIC_ROLE == type(uint256).max. These values should be avoided in any arythmetic operations with roleIds, to avoid overflow/underflow issues.
    /// @notice Role identifier for the admin role
    uint256 public constant ADMIN_ROLE = type(uint256).min;
    /// @notice Role identifier for the public role (everyone)
    uint256 public constant PUBLIC_ROLE = type(uint256).max;
    /// @notice Denominator used for percentage calculations (100%)
    uint256 public constant DENOMINATOR = 100;

    /// @notice Maximum length of calldata for a mandate action
    uint256 public immutable MAX_CALLDATA_LENGTH;
    /// @notice Maximum length of return data stored from execution
    uint256 public immutable MAX_RETURN_DATA_LENGTH;
    /// @notice Maximum number of execution targets per action
    uint256 public immutable MAX_EXECUTIONS_LENGTH;
    /// @notice block number at which the Powers contract was deployed.
    uint256 public immutable FOUNDED_AT;

    /// @notice Name of the DAO
    string public name;
    /// @notice URI to metadata of the DAO
    /// @dev Can be altered
    string public uri;
    /// @notice Address to the treasury of the organisation
    address payable private treasury;
    // NB! this is a gotcha: mandates start counting a 1, NOT 0!. 0 is used as a default 'false' value.
    /// @notice Number of mandates that have been initiated throughout the life of the organisation
    uint16 public mandateCounter = 1;
    /// @notice array of flows to provide human and mandate readable structure to governance.  
    Flow[] public flows;
    /// @dev Is the constitute phase closed? Note: no actions can be started when the constitute phase is open.
    bool private _constituteClosed;

    //////////////////////////////////////////////////////////////
    //                          MODIFIERS                       //
    //////////////////////////////////////////////////////////////
    /// @notice A modifier that sets a function to only be callable by the {Powers} contract.
    modifier onlyPowers() {
        _onlyPowers();
        _;
    }

    /// @dev Internal check for onlyPowers modifier.
    function _onlyPowers() internal view {
        if (_msgSender() != address(this)) revert Powers__OnlyPowers();
    }

    /// @notice Modifier to restrict access to the admin role.
    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    /// @dev Internal check for onlyAdmin modifier.
    function _onlyAdmin() internal view {
        if (hasRoleSince(_msgSender(), ADMIN_ROLE) == 0) revert Powers__OnlyAdmin();
    }

    //////////////////////////////////////////////////////////////
    //              CONSTRUCTOR & RECEIVE                       //
    //////////////////////////////////////////////////////////////
    /// @notice  Sets the value for {name} at the time of construction.
    ///
    /// @param name_ name of the contract
    /// @param uri_ uri of the contract
    /// @param maxCallDataLength_ maximum length of calldata for a mandate
    /// @param maxReturnDataLength_ maximum length of return data for a mandate
    /// @param maxExecutionsLength_ maximum length of executions for a mandate
    constructor(
        string memory name_,
        string memory uri_,
        uint256 maxCallDataLength_,
        uint256 maxReturnDataLength_,
        uint256 maxExecutionsLength_
        // add here the init data for initial mandates?
    ) payable EIP712(name_, version()) {
        if (bytes(name_).length == 0) revert Powers__InvalidName();
        if (maxCallDataLength_ == 0) revert Powers__InvalidMaxCallDataLength();
        if (maxReturnDataLength_ == 0) revert Powers__InvalidReturnCallDataLength();
        if (maxExecutionsLength_ == 0) revert Powers__InvalidMaxExecutionsLength();

        _setRole(ADMIN_ROLE, _msgSender(), true); // the account that initiates a Powerscontract is set to its admin.
        name = name_;
        uri = uri_;
        MAX_CALLDATA_LENGTH = maxCallDataLength_;
        MAX_RETURN_DATA_LENGTH = maxReturnDataLength_;
        MAX_EXECUTIONS_LENGTH = maxExecutionsLength_;
        FOUNDED_AT = block.number;

        emit Powers__Initialized(address(this), name, uri);
    }

    /// @notice Function to receive Ether. Emits a {PowersEvents::FundsReceived} event.
    /// @dev If the protocol does not have a mandate to handle transfers of native currency (and is not upgradable) it will be stuck in the contract. 
    receive() external payable {
        emit FundsReceived(_msgSender(), msg.value);
    }

    //////////////////////////////////////////////////////////////
    //                  CONSTITUTE LOGIC                        //
    //////////////////////////////////////////////////////////////
    /// @dev WARNING: any adopted mandate needs to be audited carefully as it will give powers to role holders over the organisation.
    /// @inheritdoc IPowers
    function constitute(MandateInitData[] memory constituentMandates) external onlyAdmin {
        if (_constituteClosed) revert Powers__ConstituteClosed();
        
        uint16 currentId = mandateCounter;
        //  set mandates as active.
        for (uint256 i = 0; i < constituentMandates.length; i++) {
            // note: ignore empty slots in MandateInitData array.
            if (constituentMandates[i].targetMandate != address(0)) {
                _storeMandate(currentId, constituentMandates[i]);
                unchecked { ++currentId; }
            }
        }
        mandateCounter = currentId;
    }

    /// @inheritdoc IPowers
    function closeConstitute() external onlyAdmin() {  
        _closeConstitute(_msgSender(), new Flow[](0));
    }

    /// @inheritdoc IPowers
    function closeConstitute(address newAdmin) external onlyAdmin() { 
        _closeConstitute(newAdmin, new Flow[](0));
    }

    /// @inheritdoc IPowers
    function closeConstitute(address newAdmin, Flow[] memory _flows) external onlyAdmin() { 
        _closeConstitute(newAdmin, _flows);
    }

    /// @dev Internal function to close constitution phase.
    /// @param newAdmin Address of the new admin.
    /// @param _flows The initial governance flows to set in the protocol.
    function _closeConstitute(address newAdmin, Flow[] memory _flows) internal {
        // if newAdmin is different from current admin, set new admin...
        if (_msgSender() != newAdmin) {
            _setRole(ADMIN_ROLE, _msgSender(), false);
            _setRole(ADMIN_ROLE, newAdmin, true);
        }
        // save flows if provided.
        if (_flows.length > 0) {
            for (uint256 i = 0; i < _flows.length; i++) {
                flows.push(_flows[i]);
            }
        }
        _constituteClosed = true;
    }

    //////////////////////////////////////////////////////////////
    //                  GOVERNANCE LOGIC                        //
    //////////////////////////////////////////////////////////////
    /// @inheritdoc IPowers
    function propose(uint16 mandateId, bytes calldata mandateCalldata, uint256 nonce, string memory uriAction)
        external
        returns (uint256 actionId)
    {
        // check 0: is constitution closed?
        if (!_constituteClosed) revert Powers__ConstituteOpen();
        
        AdoptedMandate storage mandate = mandates[mandateId];

        // check 1: is targetMandate is an active mandate?
        if (!mandate.active) revert Powers__MandateNotActive();

        // check 2: does _msgSender() have access to targetMandate?
        if (!canCallMandate(_msgSender(), mandateId)) revert Powers__CannotCallMandate();

        // check 3: is caller blacklisted?
        if (isBlacklisted(_msgSender())) revert Powers__AddressBlacklisted();

        // check 4: is caller too long?
        if (mandateCalldata.length > MAX_CALLDATA_LENGTH) revert Powers__CalldataTooLong();

        // if checks pass: propose.
        uint32 votingPeriod = mandate.conditions.votingPeriod;
        uint8 quorum = mandate.conditions.quorum;

        actionId = Checks.computeActionId(mandateId, mandateCalldata, nonce);

        // check 5: do we have an action with the same targetMandate and mandateCalldata?
        Action storage action = _actions[actionId];
        if (action.mandateId != 0) revert Powers__ActionAlreadyInitiated();

        // register actionId at mandate.
        mandate.actionIds.push(actionId);

        // if checks pass: create proposedAction
        action.mandateCalldata = mandateCalldata;
        action.proposedAt = uint48(block.number);
        action.mandateId = mandateId;
        action.voteStart = quorum > 0 ? uint48(block.number) : 0; 
        action.voteDuration = votingPeriod;
        action.caller = _msgSender();
        action.uri = uriAction;
        action.nonce = nonce;

        emit ProposedActionCreated(
            actionId,
            _msgSender(),
            mandateId,
            "",
            mandateCalldata,
            block.number,
            block.number + votingPeriod,
            nonce,
            uriAction
        );

        return actionId;
    }


    /// @inheritdoc IPowers
    /// @dev The request -> fulfill functions follow a call-and-return mechanism. This allows for async execution of mandates.
    function request(uint16 mandateId, bytes calldata mandateCalldata, uint256 nonce, string memory uriAction)
        external
        returns (uint256 actionId)
    {
        if (!_constituteClosed) revert Powers__ConstituteOpen();

        actionId = Checks.computeActionId(mandateId, mandateCalldata, nonce);
        AdoptedMandate storage mandate = mandates[mandateId];

        if (!mandate.active) revert Powers__MandateNotActive();

        // check 0 is calldata length is too long
        if (mandateCalldata.length > MAX_CALLDATA_LENGTH) revert Powers__CalldataTooLong();

        // check 1: is _msgSender() blacklisted?
        if (isBlacklisted(_msgSender())) revert Powers__AddressBlacklisted();

        // check 2: does caller have access to mandate being executed?
        if (!canCallMandate(_msgSender(), mandateId)) revert Powers__CannotCallMandate();
 
        Action storage action = _actions[actionId];

        // check 3: has action already been set as requested or fulfilled?
        if (action.requestedAt > 0 || action.fulfilledAt > 0) revert Powers__ActionAlreadyInitiated();

        // check 4: is proposedAction cancelled?
        if (action.cancelledAt > 0) revert Powers__ActionCancelled();  

        // check 5: do checks pass?
        Checks.check(mandateId, mandateCalldata, address(this), nonce, mandate.latestFulfillment);

        // if not registered yet, register actionId at mandate.
        if (action.mandateId == 0) mandate.actionIds.push(actionId);

        // If everything passed, set action as requested.
        action.caller = _msgSender(); // note if caller had been set during proposedAction, it will be overwritten.
        action.requestedAt = uint48(block.number);
        action.mandateId = mandateId;
        action.mandateCalldata = mandateCalldata;
        action.uri = uriAction;
        action.nonce = nonce;

        // execute mandate.
        (bool success) = IMandate(mandate.targetMandate).executeMandate(_msgSender(), mandateId, mandateCalldata, nonce);
        if (!success) revert Powers__MandateRequestFailed();

        // emit event.
        emit ActionRequested(_msgSender(), mandateId, mandateCalldata, nonce, uriAction);

        return actionId;
    }

    /// @inheritdoc IPowers
    function fulfill(
        uint16 mandateId,
        uint256 actionId,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external {
        AdoptedMandate storage mandate = mandates[mandateId];

        // check 1: is mandate active?
        if (!mandate.active) revert Powers__MandateNotActive();

        // check 2: is _msgSender() the targetMandate?
        if (mandate.targetMandate != _msgSender()) revert Powers__CallerNotTargetMandate();

        Action storage action = _actions[actionId];

        // check 3: has action already been set as requested?
        if (action.requestedAt == 0 || action.cancelledAt > 0) revert Powers__ActionNotRequested();

        // check 4: has action already been fulfilled?
        if (action.fulfilledAt > 0) revert Powers__ActionAlreadyFulfilled();

        // check 5: are the lengths of targets, values and calldatas equal?
        uint256 targetsLength = targets.length;
        if (targetsLength != values.length || targetsLength != calldatas.length) revert Powers__InvalidCallData();

        // check 6: check array length is too long
        if (targetsLength > MAX_EXECUTIONS_LENGTH) revert Powers__ExecutionArrayTooLong();

        // set action as fulfilled
        action.fulfilledAt = uint48(block.number);

        // execute targets[], values[], calldatas[] received from mandate.
        for (uint256 i = 0; i < targetsLength;) {
            if (calldatas[i].length > MAX_CALLDATA_LENGTH) revert Powers__CalldataTooLong();
            if (isBlacklisted(targets[i])) revert Powers__AddressBlacklisted();

            (bool success, bytes memory returndata) = targets[i].call{ value: values[i] }(calldatas[i]);
            if (!success) {
                // logging block number of failed action. 
                action.failedAt = uint48(block.number); // log time of failure. 
                // this bubbles up the revert reason if the call reverted with one, otherwise it reverts with a default error message.
                if (returndata.length > 0) {
                    assembly {
                        let returndata_size := mload(returndata)
                        revert(add(32, returndata), returndata_size)
                    }
                } else {
                    revert Powers__MandateFulfillCallFailed();
                }
            }
            if (returndata.length <= MAX_RETURN_DATA_LENGTH) {
                action.returnDatas.push(returndata);
            } else {
                action.returnDatas.push(abi.encode(0));
            }
            unchecked { ++i; }
        }

        // emit event. -- commented out to save gas, can be re-enabled if needed.
        // emit ActionFulfilled(mandateId, actionId, targets, values, calldatas);

        // register latestFulfillment at mandate.
        mandate.latestFulfillment = uint48(block.number);
    }

    /// @inheritdoc IPowers
    /// @dev the account to cancel must be the account that created the proposedAction.
    function cancel(uint16 mandateId, bytes calldata mandateCalldata, uint256 nonce)
        external
        returns (uint256)
    {
        AdoptedMandate storage mandate = mandates[mandateId];
        if (!mandate.active) revert Powers__MandateNotActive();

        uint256 actionId = Checks.computeActionId(mandateId, mandateCalldata, nonce);
        Action storage action = _actions[actionId];

        // check 1: is caller the caller of the proposedAction?
        if (_msgSender() != action.caller) revert Powers__NotProposerAction();

        // check 2: does action exist?
        if (action.proposedAt == 0) revert Powers__ActionNotProposed();

        // check 3: is action already fulfilled or cancelled?
        if (action.fulfilledAt > 0 || action.cancelledAt > 0) {
            revert Powers__UnexpectedActionState();
        }

        // set action as cancelled.
        action.cancelledAt = uint48(block.number);

        // emit event.
        emit ProposedActionCancelled(actionId);

        return actionId;
    }

    /// @inheritdoc IPowers
    function castVote(uint256 actionId, uint8 support) external {
        return _castVote(actionId, _msgSender(), support, "");
    }

    /// @inheritdoc IPowers
    function castVoteWithReason(uint256 actionId, uint8 support, string calldata reason) external {
        return _castVote(actionId, _msgSender(), support, reason);
    }

    /// @notice Internal vote casting mechanism.
    /// @dev Check that the proposal is active, and that account has access to targetMandate.
    /// @param actionId The ID of the action being voted on.
    /// @param account The address casting the vote.
    /// @param support The support value (0=Against, 1=For, 2=Abstain).
    /// @param reason The reason for the vote.
    ///
    /// Emits a {PowersEvents::VoteCast} event.
    function _castVote(uint256 actionId, address account, uint8 support, string memory reason) internal {
        Action storage action = _actions[actionId];

        // Check that the proposal is active, that it has not been paused, cancelled or ended yet.
        if (action.proposedAt == 0 ||
            action.fulfilledAt > 0 ||
            action.cancelledAt > 0 ||
            action.requestedAt > 0 ||
            action.voteStart + action.voteDuration < block.number)
        {
            revert Powers__ProposedActionNotActive();
        }

        // Note that we check if account has access to the mandate targetted in the proposedAction.
        uint16 mandateId = action.mandateId;
        if (!canCallMandate(account, mandateId)) revert Powers__CannotCallMandate();
        // check 2: has account already voted?
        if (action.hasVoted[account]) revert Powers__AlreadyCastVote();

        // if all this passes: cast vote.
        _countVote(actionId, account, support);

        emit VoteCast(account, actionId, support, reason);
    }

    //////////////////////////////////////////////////////////////
    //             ROLE, MANDATE AND FLOW ADMIN                 //
    //////////////////////////////////////////////////////////////
    /// @inheritdoc IPowers
    function adoptMandate(MandateInitData memory mandateInitData) public onlyPowers returns (uint16 mandateId) {
        mandateId = mandateCounter;
        _storeMandate(mandateId, mandateInitData);
        unchecked { mandateCounter++; }
        return mandateId;
    }

    /// @inheritdoc IPowers
    function revokeMandate(uint16 mandateId) external onlyPowers {
        if (mandates[mandateId].active == false) revert Powers__MandateNotActive();

        mandates[mandateId].active = false;
        emit MandateRevoked(mandateId);
    }

    /// @dev WARNING: any adopted mandate needs to be audited carefully as it will give powers to role holders over the organisation. 
    /// @dev Internal helper to store mandate data and initialize it.
    function _storeMandate(uint16 mandateId, MandateInitData memory mandateInitData) internal {
        // check if added address is indeed a mandate. Note that this will also revert with address(0).
        if (!ERC165Checker.supportsInterface(mandateInitData.targetMandate, type(IMandate).interfaceId)) {
            revert Powers__IncorrectInterface(mandateInitData.targetMandate);
        }

        // check if targetMandate is blacklisted
        if (isBlacklisted(mandateInitData.targetMandate)) revert Powers__AddressBlacklisted();

        // check if conditions combine PUBLIC_ROLE with a vote - which is impossible due to PUBLIC_ROLE having an infinite number of members.
        if (mandateInitData.conditions.allowedRole == PUBLIC_ROLE && mandateInitData.conditions.quorum > 0) {
            revert Powers__VoteWithPublicRoleDisallowed();
        }

        AdoptedMandate storage mandate = mandates[mandateId];
        mandate.active = true;
        mandate.targetMandate = mandateInitData.targetMandate;
        mandate.conditions = mandateInitData.conditions;

        Mandate(mandateInitData.targetMandate)
            .initializeMandate(mandateId, mandateInitData.nameDescription, "", mandateInitData.config);

        emit MandateAdopted(mandateId);
    }

    /// @inheritdoc IPowers
    function addFlow (Flow memory flow) external onlyPowers {
        flows.push(flow);
        emit FlowAdded(flow.mandateIds, flow.nameDescription);
    }

    /// @inheritdoc IPowers
    function removeFlow(uint8 index) external onlyPowers {
        if (index >= flows.length) revert Powers__InvalidFlowIndex();

        // delete flow by replacing it with the last flow and popping the last flow.
        uint256 lastIndex = flows.length - 1;
        if (index != lastIndex) {
            flows[index] = flows[lastIndex];
        }
        flows.pop();

        emit FlowDeleted(index);
    }
    
    /// @inheritdoc IPowers
    function editFlowByIndex(uint8 index1, uint8 index2, uint16 mandateId) external onlyPowers {
        if (mandateId >= mandateCounter) revert Powers__InvalidMandateId();
        if (index1 >= flows.length) revert Powers__InvalidFlowIndex();
        Flow storage flow = flows[index1];
        if (index2 >= flow.mandateIds.length) revert Powers__InvalidMandateIndex();

        flow.mandateIds[index2] = mandateId;

        emit FlowAdapted(index1, index2, mandateId);
    }

    /// @inheritdoc IPowers
    function labelRole(uint256 roleId, string memory label, string memory metadata) external onlyPowers {
        if (bytes(label).length == 0) revert Powers__InvalidLabel();
        if (bytes(label).length > 255) revert Powers__LabelTooLong();
        if (bytes(metadata).length > 255) revert Powers__UriTooLong();
        
        roles[roleId].label = label;
        roles[roleId].metadata = metadata;
        emit RoleLabel(roleId, label);
    }


    /// @inheritdoc IPowers
    function assignRole(uint256 roleId, address account) external onlyPowers {
        if (isBlacklisted(account)) revert Powers__AddressBlacklisted();

        _setRole(roleId, account, true);
    }

    /// @inheritdoc IPowers
    function revokeRole(uint256 roleId, address account) external onlyPowers {
        _setRole(roleId, account, false);
    }

    /// @notice Internal version of {setRole} without access control.
    /// @dev This function is used to set a role for a given account. Public role is locked as everyone has it.
    /// Note that it does allow Admin role to be assigned and revoked.
    /// Note that the function does not revert if trying to remove a role someone does not have, or add a role someone already has.
    /// @param roleId The ID of the role to set.
    /// @param account The address to assign/revoke the role for.
    /// @param access True to grant role, false to revoke.
    ///
    /// Emits a {PowersEvents::RoleSet} event.
    function _setRole(uint256 roleId, address account, bool access) internal {
        // check 1: Public role is locked.
        if (roleId == PUBLIC_ROLE) revert Powers__CannotSetPublicRole();
        // check 2: Zero address is not allowed.
        if (account == address(0)) revert Powers__CannotAddZeroAddress();
        // check 3: The organisation itself cannot be assigned a role. This to avoid re-entrancy attacks. 
        if (account == address(this)) revert Powers__CannotAddPowersAddressAsMember();

        Role storage role = roles[roleId];
        uint256 index = role.members[account];
        bool hasRole = index != 0;

        // add role if role requested and account does not already have role.
        if (access && !hasRole) {
            role.membersArray.push(Member({ account: account, since: uint48(block.number) }));
            role.members[account] = role.membersArray.length; // 'index of new member is length of array (which is 1-based index).
        // remove role if access set to false and account has role.
        } else if (!access && hasRole) {
            uint256 indexEnd = role.membersArray.length - 1;
            Member memory memberEnd = role.membersArray[indexEnd];

            // updating array. Note that 1 is added to the index to avoid 0 index of first member in array. We here have to subtract it.
            role.membersArray[index - 1] = memberEnd; // replace account with last member account.
            role.membersArray.pop(); // remove last member.

            // updating indices in mapping.
            role.members[memberEnd.account] = index; // update index of last member in list
            role.members[account] = 0; // 'index of removed member is set to 0.
        }
        // note: nothing happens when 1: access is requested and not a new member 2: access is false and account does not have role. No revert.

        emit RoleSet(roleId, account, access);
    }


    /// @inheritdoc IPowers
    function blacklistAddress(address account, bool blacklisted) external onlyPowers {
        _blacklist[account] = blacklisted;
        emit BlacklistSet(account, blacklisted);
    }

    /// @inheritdoc IPowers
    function setUri(string memory newUri) external onlyPowers {
        uri = newUri;
    }

    /// @inheritdoc IPowers
    function setTreasury(address payable newTreasury) external onlyPowers {
        if (newTreasury == address(0)) revert Powers__CannotSetZeroAddress();
        treasury = newTreasury;
    }

    /// @inheritdoc IPowers
    function setTrustedForwarder(address forwarder, bool trusted) external onlyPowers {
        if (forwarder == address(0)) revert Powers__CannotSetZeroAddress();
        trustedForwarders[forwarder] = trusted;
    }

    //////////////////////////////////////////////////////////////
    //               INTERNAL HELPER FUNCTIONS                  //
    //////////////////////////////////////////////////////////////
    /// @notice Internal function to check if the quorum for a given proposal has been reached.
    /// @param actionId The ID of the proposal.
    /// @return True if quorum is reached, false otherwise.
    function _quorumReached(uint256 actionId) internal view returns (bool) {
        // retrieve quorum and allowedRole from mandate.
        Action storage proposedAction = _actions[actionId];
        Conditions memory conditions = getConditions(proposedAction.mandateId);
        uint256 amountMembers = _countMembersRole(conditions.allowedRole);

        // check if quorum is set to 0 in a Mandate, it will automatically return true. Otherwise, check if quorum has been reached.
        return (conditions.quorum == 0
                || amountMembers * conditions.quorum
                    <= (proposedAction.forVotes + proposedAction.abstainVotes) * DENOMINATOR);
    }

    /// @notice Internal function to check if a given action has been requested.
    /// @param actionId The ID of the action.
    /// @return True if the action has been requested or fulfilled, false otherwise.
    function _hasBeenRequested(uint256 actionId) internal view returns (bool) {
        ActionState state = getActionState(actionId);
        if (state == ActionState.Requested || state == ActionState.Fulfilled) {
            return true;
        }
        return false;
    }

    /// @notice Internal function to check if a vote for a given proposal has succeeded.
    /// @param actionId The ID of the proposal.
    /// @return True if the vote succeeded, false otherwise.
    function _voteSucceeded(uint256 actionId) internal view returns (bool) {
        // retrieve quorum and success threshold from mandate.
        Action storage proposedAction = _actions[actionId];
        Conditions memory conditions = getConditions(proposedAction.mandateId);
        uint256 amountMembers = _countMembersRole(conditions.allowedRole);

        // note if quorum is set to 0 in a Mandate, it will automatically return true. Otherwise, check if success threshold has been reached.
        return conditions.quorum == 0 || amountMembers * conditions.succeedAt <= proposedAction.forVotes * DENOMINATOR;
    }

    /// @notice Internal function to count against, for, and abstain votes for a given proposal.
    /// @dev In this module, the support follows the `VoteType` enum (from Governor Bravo).
    /// It does not check if account has roleId referenced in actionId. This has to be done by {Powers.castVote} function.
    /// @param actionId The ID of the proposal.
    /// @param account The address casting the vote.
    /// @param support The support value (0=Against, 1=For, 2=Abstain).
    function _countVote(uint256 actionId, address account, uint8 support) internal {
        Action storage proposedAction = _actions[actionId];

        // set account as voted.
        proposedAction.hasVoted[account] = true;

        // add vote to tally.
        if (support == uint8(VoteType.Against)) {
            proposedAction.againstVotes++;
        } else if (support == uint8(VoteType.For)) {
            proposedAction.forVotes++;
        } else if (support == uint8(VoteType.Abstain)) {
            proposedAction.abstainVotes++;
        } else {
            revert Powers__InvalidVoteType();
        }
    }

    /// @notice Internal function that counts the number of members in a given role.
    /// @dev If needed, this function can be overridden with bespoke logic.
    /// @param roleId The ID of the role.
    /// @return amountMembers Number of members in the role.
    function _countMembersRole(uint256 roleId) internal view returns (uint256 amountMembers) {
        return roles[roleId].membersArray.length;
    }

    /// @dev ERC-2771: Override to extract sender from calldata if caller is a trusted forwarder
    function _msgSender() internal view override returns (address sender) {
        if (trustedForwarders[msg.sender] && msg.data.length >= 20) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            return super._msgSender();
        }
    }

    /// @dev ERC-2771: Override to extract data from calldata if caller is a trusted forwarder
    function _msgData() internal view override returns (bytes calldata) {
        if (trustedForwarders[msg.sender] && msg.data.length >= 20) {
            return msg.data[:msg.data.length - 20];
        } else {
            return super._msgData();
        }
    }

    //////////////////////////////////////////////////////////////
    //                 VIEW / GETTER FUNCTIONS                  //
    //////////////////////////////////////////////////////////////
    /// @inheritdoc IPowers
    function version() public pure returns (string memory) {
        return "v0.6.1";
    }

    /// @inheritdoc IPowers
    function getAmountFlows() public view returns (uint256) {
        return flows.length;
    }

    /// @inheritdoc IPowers
    function getFlowMandatesAtIndex(uint8 index) public view returns (uint16[] memory) {
        if (index >= flows.length) {
            revert Powers__InvalidIndex();
        }
        return flows[index].mandateIds;
    }
    
    /// @inheritdoc IPowers
    function getFlowDescriptionAtIndex(uint8 index) public view returns (string memory) {
        if (index >= flows.length) {
            revert Powers__InvalidIndex();
        }
        return flows[index].nameDescription;
    }

    /// @inheritdoc IPowers
    function canCallMandate(address caller, uint16 mandateId) public view returns (bool) {
        uint256 allowedRole = mandates[mandateId].conditions.allowedRole;
        uint48 since = hasRoleSince(caller, allowedRole);

        return since != 0 || allowedRole == PUBLIC_ROLE;
    }

    /// @inheritdoc IPowers
    function hasRoleSince(address account, uint256 roleId) public view returns (uint48 since) {
        Role storage role = roles[roleId];
        uint256 index = role.members[account];
        if (index == 0) {
            return 0;
        }
        return role.membersArray[index - 1].since;
    }

    /// @inheritdoc IPowers
    function getAmountRoleHolders(uint256 roleId) public view returns (uint256 amountMembers) {
        return roles[roleId].membersArray.length;
    }

    /// @inheritdoc IPowers
    function getRoleHolderAtIndex(uint256 roleId, uint256 index) public view returns (address account) {
        Role storage role = roles[roleId];
        if (index >= role.membersArray.length) {
            revert Powers__InvalidIndex();
        }
        return role.membersArray[index].account;
    }

    /// @inheritdoc IPowers
    function getRoleLabel(uint256 roleId) public view returns (string memory label) {
        return roles[roleId].label;
    }

    /// @inheritdoc IPowers
    function getRoleMetadata(uint256 roleId) public view returns (string memory metadata) {
        return roles[roleId].metadata;
    }

    /// @inheritdoc IPowers
    function getActionState(uint256 actionId) public view returns (ActionState) {
        // We read the struct fields into the stack at once so Solidity emits a single SLOAD
        Action storage action = _actions[actionId];

        if (action.proposedAt == 0 && action.requestedAt == 0 && action.fulfilledAt == 0 && action.cancelledAt == 0) {
            return ActionState.NonExistent;
        }
        if (action.failedAt > 0) {
            return ActionState.Failed;
        }
        if (action.fulfilledAt > 0) {
            return ActionState.Fulfilled;
        }
        if (action.cancelledAt > 0) {
            return ActionState.Cancelled;
        }
        if (action.requestedAt > 0) {
            return ActionState.Requested;
        }

        uint256 deadline = action.voteStart + action.voteDuration;

        if (deadline >= block.number) {
            return ActionState.Active;
        } else if (!_quorumReached(actionId) || !_voteSucceeded(actionId)) {
            return ActionState.Defeated;
        } else {
            return ActionState.Succeeded;
        }
    }

    /// @inheritdoc IPowers
    function getActionData(uint256 actionId)
        public
        view
        returns (
            uint16 mandateId,
            uint48 proposedAt,
            uint48 requestedAt,
            uint48 fulfilledAt,
            uint48 cancelledAt,
            address caller,
            uint256 nonce
        )
    {
        Action storage action = _actions[actionId];

        return (
            action.mandateId,
            action.proposedAt,
            action.requestedAt,
            action.fulfilledAt,
            action.cancelledAt,
            action.caller,
            action.nonce
        );
    }

    /// @inheritdoc IPowers
    function getActionVoteData(uint256 actionId)
        public
        view
        returns (
            uint48 voteStart,
            uint32 voteDuration,
            uint256 voteEnd,
            uint32 againstVotes,
            uint32 forVotes,
            uint32 abstainVotes
        )
    {
        Action storage action = _actions[actionId];

        return (
            action.voteStart,
            action.voteDuration,
            action.voteStart + action.voteDuration,
            action.againstVotes,
            action.forVotes,
            action.abstainVotes
        );
    }

    /// @inheritdoc IPowers
    function getActionCalldata(uint256 actionId) public view returns (bytes memory callData) {
        return _actions[actionId].mandateCalldata;
    }

    /// @inheritdoc IPowers
    function getActionReturnData(uint256 actionId, uint256 index)
        public
        view
        returns (bytes memory returnData)
    {
        return _actions[actionId].returnDatas[index];
    }

    /// @inheritdoc IPowers
    function getActionUri(uint256 actionId) public view returns (string memory _uri) {
        _uri = _actions[actionId].uri;
    }

    /// @inheritdoc IPowers
    function hasVoted(uint256 actionId, address account) public view returns (bool) {
        return _actions[actionId].hasVoted[account];
    }

    /// @inheritdoc IPowers
    function getAdoptedMandate(uint16 mandateId)
        external
        view
        returns (address mandate, bytes32 mandateHash, bool active)
    {
        AdoptedMandate storage m = mandates[mandateId];
        mandate = m.targetMandate;
        active = m.active;
        mandateHash = keccak256(abi.encode(address(this), mandateId));

        return (mandate, mandateHash, active);
    }

    /// @inheritdoc IPowers
    function getMandateCounter() external view returns (uint16) {
        return mandateCounter;
    }

    /// @inheritdoc IPowers
    function getLatestFulfillment(uint16 mandateId) external view returns (uint48 latestFulfillment) {
        return mandates[mandateId].latestFulfillment;
    }

    /// @inheritdoc IPowers
    function getQuantityMandateActions(uint16 mandateId) external view returns (uint256 quantityMandateActions) {
        return mandates[mandateId].actionIds.length;
    }

    /// @inheritdoc IPowers
    function getMandateActionAtIndex(uint16 mandateId, uint256 index) external view returns (uint256 actionId) {
        AdoptedMandate storage m = mandates[mandateId];
        if (index >= m.actionIds.length) {
            revert Powers__InvalidIndex();
        }
        return m.actionIds[index];
    }

    /// @inheritdoc IPowers
    function getConditions(uint16 mandateId) public view returns (Conditions memory conditions) {
        return mandates[mandateId].conditions;
    }

    /// @inheritdoc IPowers
    function getTreasury() external view returns (address payable) {
        return treasury;
    }

    /// @inheritdoc IPowers
    function isBlacklisted(address account) public view returns (bool) {
        return _blacklist[account];
    }
}
