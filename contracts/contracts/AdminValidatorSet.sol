pragma solidity 0.4.24;
import "./SafeMath.sol";
import "./SimpleValidatorSet.sol";
import "./Admin.sol";

contract AdminValidatorSet is SimpleValidatorSet {

    // Set of objects for O(1) for all operations
    AdminSet admins = new AdminSet();
    AdminSet proposedAdmins = new AdminSet();

    // Consortium Name and default value
    string consortiumName = "Microsoft Proof of Authority";
    
    mapping (address => string) adminAlias;

    // Defines how many validators each admin can run at once
    // To be replaced prior to compilation
    uint constant validatorCapacity = 13;

    event AdminProposed(address admin);
    event AdminAdded(address admin);
    event AdminRemoved(address admin);

    constructor() SimpleValidatorSet() public {
        // Truffle dev account
	    // testHooksEnabled allows us to call finalize from non-system account
        if (msg.sender == TRUFFLEADDRESS) {
            testHooksEnabled = true;
            bootstrapAdminAddress = msg.sender;
        }
        proposeAdmin(bootstrapAdminAddress, "");
    }

    // Only an admin can add their own validators
    function addValidators(address[] validatorAddresses) public callerIsAdmin lastChangeFinalized {
        address adminAddress = msg.sender;
        // Before adding, ensure validatorCapacity won't be exceeded
        assert(AdminToValidators[adminAddress].length + validatorAddresses.length <= validatorCapacity);
        addValidatorsInternal(validatorAddresses, adminAddress, false);
    }

    // Only an admin can remove their own validators
    function removeValidators(address[] validatorAddresses) public callerIsAdmin lastChangeFinalized {
        address adminAddress = msg.sender;
        removeValidatorsInternal(validatorAddresses, adminAddress);
    }

    // Returns list of active admins
    function getAdmins() public view returns (address[]) {
        return admins.getAddressList();
    }

    function getAdminCount() public view returns (uint) {
        return admins.getCount();
    }

    function getAliasForAdmin(address admin) public view returns (string) {
        return adminAlias[admin];
    }

    function getValidatorCapacity() public pure returns (uint) {
        return validatorCapacity;
    }

    // Returns list of proposed admins
    // Returning array of structs not supported in Solidity yet
    function getProposedAdmins() public view returns (address[]) {
        return proposedAdmins.getAddressList();
    }

    function getProposedCount() public view returns (uint) {
        return proposedAdmins.getCount();
    }

    // Propose to add another admin
    function proposeAdmin(address proposedAdminAddress, string alias) public {
        require (!admins.isInSet(proposedAdminAddress));
        // if an admin is already proposed, use the voteFor function
        require (!proposedAdmins.isInSet(proposedAdminAddress));
        require (proposedAdminAddress != address(0));

        address proposedBy = msg.sender;
        // admin can only set another admin's alias if it's a new admin
        adminAlias[proposedAdminAddress] = alias;
        // if there are no admins yet, add as admin
        if (admins.getCount() == 0) {
            admins.addAdmin(proposedAdminAddress);
            return;
        }  
        proposedAdmins.addAdmin(proposedAdminAddress);
        emit AdminProposed(proposedAdminAddress);

        // if the proposer is an admin, also add a vote
        if (admins.isInSet(proposedBy)) {
            voteFor(proposedAdminAddress);
        }
    }
    
    // Get count for majority vote
    function votesNeededForMajority() private view returns (uint) {
        // > 50% (ex. 11/2 + 1 = 6) (ex. 12/2 +1 = 7)
        // Floating point math !exist in Solidity
        return SafeMath.add(SafeMath.div(admins.getCount(), 2), 1);
    }

    // Add if admin has enough votes for
    function promoteToAdminIfConditionsMet(address proposedAdminAddress, uint votesFor) internal {
        require(proposedAdmins.isInSet(proposedAdminAddress));
        Admin proposedAdmin = proposedAdmins.getAdmin(proposedAdminAddress);
        assert(proposedAdmin.getIdentity() == proposedAdminAddress);
        uint votesNeeded = votesNeededForMajority();
        if (votesFor >= votesNeeded) {
            // Move to admin list
            proposedAdmins.removeAdmin(proposedAdminAddress);
            admins.addAdmin(proposedAdminAddress);
            emit AdminAdded(proposedAdminAddress);
        }
    }
    
    // Remove if admin has enough votes against
    function removeAdminIfConditionsMet(address adminAddress, uint votesAgainst) internal {        
        require(admins.isInSet(adminAddress));
        assert(admins.getAdmin(adminAddress).getIdentity() == adminAddress);
        uint votesNeeded = votesNeededForMajority();
        if (votesAgainst >= votesNeeded) {
            admins.removeAdmin(adminAddress);
            // Remove all admin's validators
            removeValidatorsInternal(AdminToValidators[adminAddress], adminAddress);
            // Remove all votesFor from this admin
            address[] memory currProposedAdmins = getProposedAdmins();
            for (uint i = 0; i < currProposedAdmins.length; i++) {
                address proposedAdminAddress = currProposedAdmins[i];
                // Break once we've hit empty addresses
                if (!proposedAdmins.isInSet(proposedAdminAddress)) {
                    break;
                }
                // rescindVoteFor will ignore in the case that this admin never voted for
                proposedAdmins.getAdmin(proposedAdminAddress).rescindVoteFor(adminAddress);
            }
            // Remove all votesAgainst from this admin
            address[] memory currAdmins = getAdmins();
            for (i = 0; i < currAdmins.length; i++) {
                address currAdminAddress = currAdmins[i];
                // Break once we've hit empty addresses
                if (!admins.isInSet(currAdminAddress)) {
                    break;
                }
                // rescindVoteAgainst will ignore in the case that this admin never voted against
                admins.getAdmin(currAdminAddress).rescindVoteAgainst(adminAddress);
            }
            emit AdminRemoved(adminAddress);
        }
    }
    
    // Vote for adding an existing proposed admin
    function voteFor(address proposedAdminAddress) public callerIsAdmin {
        // can only vote for already proposed admins
        require(proposedAdmins.isInSet(proposedAdminAddress));
        uint votesFor = proposedAdmins.getAdmin(proposedAdminAddress).voteFor(msg.sender);
        promoteToAdminIfConditionsMet(proposedAdminAddress, votesFor);
    }

    // Cancel a vote for adding an existing proposed admin
    function rescindVoteFor(address proposedAdminAddress) public callerIsAdmin {
        // can only rescind vote for an already proposed admin
        assert(proposedAdmins.isInSet(proposedAdminAddress));
        proposedAdmins.getAdmin(proposedAdminAddress).rescindVoteFor(msg.sender);
        
        // If an address now has zero votes, then remove from the list of proposed admins
        if(countOfVotesFor(proposedAdminAddress) == 0)
        { 
            proposedAdmins.removeAdmin(proposedAdminAddress); 
        }
    }

    function hasAlreadyVotedFor(address proposedAdminAddress) public view callerIsAdmin returns(bool)
    {
        // can only vote for an already proposed admin
        assert(proposedAdmins.isInSet(proposedAdminAddress));
        return proposedAdmins.getAdmin(proposedAdminAddress).hasAlreadyVotedFor(msg.sender);
    }

    function countOfVotesFor(address proposedAdminAddress) public view returns (uint) {
        require(proposedAdmins.isInSet(proposedAdminAddress));
        return proposedAdmins.getAdmin(proposedAdminAddress).countOfVotesFor();
    }
    
    // Vote for removing an existing admin
    function voteAgainst(address admin) public callerIsAdmin {
        // can only vote against admins
        require(admins.isInSet(admin));

        uint votesAgainst = admins.getAdmin(admin).voteAgainst(msg.sender);
        removeAdminIfConditionsMet(admin, votesAgainst);
    }

    function hasAlreadyVotedAgainst(address adminAddress) public view callerIsAdmin returns(bool)
    {
        // can only vote for an already proposed admin
        assert(admins.isInSet(adminAddress));
        return admins.getAdmin(adminAddress).hasAlreadyVotedAgainst(msg.sender);
    }

    function countOfVotesAgainst(address admin) public view returns (uint) {
        require(admins.isInSet(admin));
        return admins.getAdmin(admin).countOfVotesAgainst();
    }

    // Cancel a vote for removing an existing admin
    function rescindVoteAgainst(address existingAdminAddress) public callerIsAdmin {
        // can only rescind vote for existing admins
        assert(admins.isInSet(existingAdminAddress));
        Admin adminToRescind = admins.getAdmin(existingAdminAddress);
        adminToRescind.rescindVoteAgainst(msg.sender);
    }

    // Change alias for existing admin
    function updateAdminAlias(string alias) public callerIsAdmin {
        // only admin can change their own alias
        adminAlias[msg.sender] = alias;
    }

    function whoHasVotedFor(address proposedAdminAddress) public view returns (address[])
    {
        require(proposedAdmins.isInSet(proposedAdminAddress));
        return proposedAdmins.getAdmin(proposedAdminAddress).whoHasVotedFor();
    }

    function whoHasVotedAgainst(address adminAddress) public view returns (address[])
    {        
        require(admins.isInSet(adminAddress));
        return admins.getAdmin(adminAddress).whoHasVotedAgainst();
    }

    function getConsortiumName() public view returns(string) {
        return consortiumName;
    }

    function setConsortiumName(string newName) public callerIsAdmin {
        consortiumName = newName;
    }

    modifier callerIsAdmin() {
        require(admins.isInSet(msg.sender));
        _;
    }
}