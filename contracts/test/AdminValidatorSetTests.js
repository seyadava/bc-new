import expectThrow from './helpers/expectThrow';
var AdminValidatorSet = artifacts.require("./AdminValidatorSet.sol");

var validatorIDList = ['0x00f4131a087bfc65bcb0edc795c468d50b0c9161', '0x10f4131a087bfc6dbcb0edc795c468d50b0c9161', '0x23f4131a087bfc6dbcb0edc795c468d50b0c9145', '0x33f4131a087bfc65bcb0edc795c468d50b0c9133', '0x44f4131a087bfc6dbcb0edc795c468d50b0c9144', '0x55f4131a087bfc6dbcb0edc795c468d50b0c9155', '0x66f4131a087bfc65bcb0edc795c468d50b0c9166', '0x77f4131a087bfc6dbcb0edc795c468d50b0c9177', '0x88f4131a087bfc6dbcb0edc795c468d50b0c9188','0x99f4131a087bfc65bcb0edc795c468d50b0c9199', '0x1004131a087bfc6dbcb0edc795c468d50b0c9100', '0x1114131a087bfc6dbcb0edc795c468d50b0c9111', '0x2224131a087bfc6dbcb0edc795c468d50b0c9222','0x3334131a087bfc65bcb0edc795c468d50b0c9333', '0x4444131a087bfc6dbcb0edc795c468d50b0c9444', '0x5554131a087bfc6dbcb0edc795c468d50b0c9555'];

contract('AdminValidatorSet', async (accounts) => {

    it("should start with 1 admin", async () => {
        let instance = await AdminValidatorSet.deployed();
        let count = await instance.getAdminCount.call();
        let admins = await instance.getAdmins.call();
        assert.equal(count, 1, "expected 1 admin, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
    });

    it("should let admins change their alias", async () => {
        let instance = await AdminValidatorSet.deployed();
        instance.updateAdminAlias("Satoshi", 
                                            {from: web3.eth.accounts[0]});
                      
        let alias = await instance.getAliasForAdmin.call(web3.eth.accounts[0]);
        assert.equal("Satoshi", alias, "change alias failed")                                                        
    });

    it("should let admin propose and vote for new admins", async () => {
        let instance = await AdminValidatorSet.deployed();
        let count = await instance.getAdminCount.call();
        let admins = await instance.getAdmins.call();
        assert.equal(count, 1, "expected 1 admin, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
        var tx = "";

        // Should reject if admin already exists (nice try Craig...)
        expectThrow(instance.proposeAdmin(web3.eth.accounts[0], "Wright", 
        {from: web3.eth.accounts[0]}));

        await instance.proposeAdmin(web3.eth.accounts[1], "Vitalik", 
                                            {from: web3.eth.accounts[0]});
        
        admins = await instance.getAdmins.call();
        count = await instance.getAdminCount.call();
        assert.equal(count, 2, "expected 2 admins, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
        assert.equal(web3.eth.accounts[1], admins[1], "missing expected admin");
        count = await instance.getProposedCount.call();
        assert.equal(count, 0, "expected 0 proposed admin, found " + count);
        
        // One vote is not majority (1/2)
        await instance.proposeAdmin(web3.eth.accounts[2], "Finney", 
                                            {from: web3.eth.accounts[0]});

        admins = await instance.getAdmins.call();
        count = await instance.getAdminCount.call();
        assert.equal(count, 2, "expected 2 admins, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
        assert.equal(web3.eth.accounts[1], admins[1], "missing expected admin");
        count = await instance.getProposedCount.call();
        assert.equal(count, 1, "expected 1 proposed admin, found " + count);
        instance.hasAlreadyVotedFor.call(web3.eth.accounts[2], 
                        {from: web3.eth.accounts[0]}).then(result => {
                            assert.equal(result, true, "expected hasAlreadyVotedFor to return true");
                        });
        // Account 1 has not voted for this candidate
        instance.hasAlreadyVotedFor.call(web3.eth.accounts[2], 
                        {from: web3.eth.accounts[1]}).then(result => {
                            assert.equal(result, false, "expected hasAlreadyVotedFor to return false");
                        });
        
        // Two votes is majority (2/2)
        await instance.voteFor(web3.eth.accounts[2], 
                                            {from: web3.eth.accounts[1]});

        admins = await instance.getAdmins.call();
        count = await instance.getAdminCount.call();
        assert.equal(count, 3, "expected 3 admins, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
        assert.equal(web3.eth.accounts[1], admins[1], "missing expected admin");
        assert.equal(web3.eth.accounts[2], admins[2], "missing expected admin");
        count = await instance.getProposedCount.call();
        assert.equal(count, 0, "expected 0 proposed admin, found " + count);

        // One vote is not majority (1/3)
        await instance.proposeAdmin(web3.eth.accounts[3], "Gavin", 
                                            {from: web3.eth.accounts[0]});

        admins = await instance.getAdmins.call();
        count = await instance.getAdminCount.call();
        assert.equal(count, 3, "expected 3 admins, found " + count);
        count = await instance.getProposedCount.call();
        assert.equal(count, 1, "expected 1 proposed admin, found " + count);
        count = await instance.countOfVotesFor(web3.eth.accounts[3]);
        assert.equal(count, 1, "expected 1 voteFor, found " + count);
        instance.hasAlreadyVotedFor.call(web3.eth.accounts[3], 
                        {from: web3.eth.accounts[0]}).then(result => {
                            assert.equal(result, true, "expected hasAlreadyVotedFor to return true");
                        });

        // Admin cannot vote for the same admin twice
        expectThrow(instance.proposeAdmin(web3.eth.accounts[3], "Gavin", 
                                            {from: web3.eth.accounts[1]}));

        // Propose should fail since admin already proposed
        expectThrow(instance.proposeAdmin(web3.eth.accounts[3], "Gavin", 
                                            {from: web3.eth.accounts[1]}));

        // Two votes is majority (2/3)
        await instance.voteFor(web3.eth.accounts[3],
                                {from: web3.eth.accounts[1]});

        admins = await instance.getAdmins.call();
        count = await instance.getAdminCount.call();
        assert.equal(count, 4, "expected 4 admins, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
        assert.equal(web3.eth.accounts[1], admins[1], "missing expected admin");
        assert.equal(web3.eth.accounts[2], admins[2], "missing expected admin");
        assert.equal(web3.eth.accounts[3], admins[3], "missing expected admin");
        let alias = await instance.getAliasForAdmin.call(web3.eth.accounts[3]);
        assert.equal("Gavin", alias, "change alias failed");
        count = await instance.getProposedCount.call();
        assert.equal(count, 0, "expected 0 proposed admin, found " + count);
    });

    it("should let admin add/remove validators up to limit", async () => {
        let instance = await AdminValidatorSet.deployed();
        let vals = await instance.getValidators.call();
        assert.equal(vals.length, 3, "expected 3 validators found " + vals.length);

        await instance.addValidators([validatorIDList[0],
                                    validatorIDList[1],
                                    validatorIDList[2],
                                    validatorIDList[3],
                                    validatorIDList[4],
                                    validatorIDList[5],
                                    validatorIDList[6],
                                    validatorIDList[7],
                                    validatorIDList[8],
                                    validatorIDList[9],
                                    validatorIDList[10],
                                    validatorIDList[11],
                                    validatorIDList[12]],
                                    {from: web3.eth.accounts[1]});
        
        await instance.finalizeChange();

        vals = await instance.getValidators.call();
        assert.equal(vals.length, 16, "expected 16 validators found " + vals.length);
        
        // attempt to add 14th validator for a given admin
        expectThrow(instance.addValidators([validatorIDList[13]],
                                    {from: web3.eth.accounts[1]}));
        
        await instance.removeValidators([validatorIDList[0],
                                    validatorIDList[1],
                                    validatorIDList[2],
                                    validatorIDList[3],
                                    validatorIDList[4],
                                    validatorIDList[5],
                                    validatorIDList[6],
                                    validatorIDList[7],
                                    validatorIDList[8],
                                    validatorIDList[9],
                                    validatorIDList[10],
                                    validatorIDList[11],
                                    validatorIDList[12]],
                                    {from: web3.eth.accounts[1]});
        
        await instance.finalizeChange();

        vals = await instance.getValidators.call();
        assert.equal(vals.length, 3, "expected 3 validators found " + vals.length);
    });

    it("should let admin add/remove the same validator multiple times", async () => {
        let instance = await AdminValidatorSet.deployed();
        let vals = await instance.getValidators.call();
        assert.equal(vals.length, 3, "expected 3 validators found " + vals.length);

        await instance.addValidators([validatorIDList[13]],
                                    {from: web3.eth.accounts[1]});
        
        await instance.finalizeChange();

        vals = await instance.getValidators.call();
        assert.equal(vals.length, 4, "expected 4 validators found " + vals.length);
        
        await instance.removeValidators([validatorIDList[13],],
                                    {from: web3.eth.accounts[1]});
        
        await instance.finalizeChange();

        vals = await instance.getValidators.call();
        assert.equal(vals.length, 3, "expected 3 validators found " + vals.length);
        await instance.addValidators([validatorIDList[13]],
                                    {from: web3.eth.accounts[1]});
        
        await instance.finalizeChange();

        vals = await instance.getValidators.call();
        assert.equal(vals.length, 4, "expected 4 validators found " + vals.length);
        
        await instance.removeValidators([validatorIDList[13],],
                                    {from: web3.eth.accounts[1]});
        
        await instance.finalizeChange();

        vals = await instance.getValidators.call();
        assert.equal(vals.length, 3, "expected 3 validators found " + vals.length);
    });

    it("should not let non-admins add/remove validators", async () => {
        let instance = await AdminValidatorSet.deployed();
        let admins = await instance.getAdmins.call();
        assert.equal(admins.indexOf(web3.eth.accounts[4]), -1, "Test assumptions are incorrect: Expected admin not present");

        // Non-Admin
        let vals = await instance.getValidators.call();
        expectThrow(instance.addValidators([validatorIDList[0]],
                                    {from: web3.eth.accounts[4]}));
        expectThrow(instance.removeValidators([validatorIDList[0]],
                                    {from: web3.eth.accounts[4]}));
    });    
 
    it("should allow an admin to rescind a vote for a proposed admin", async () => {
        let instance = await AdminValidatorSet.deployed();
        let admins = await instance.getAdmins.call();
        let count = await instance.getAdminCount.call();

        // Test Setup to make sure everything is already right 
        assert.equal(count, 4, "expected 4 admins, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
        assert.equal(web3.eth.accounts[1], admins[1], "missing expected admin");
        assert.equal(web3.eth.accounts[2], admins[2], "missing expected admin");
        assert.equal(web3.eth.accounts[3], admins[3], "missing expected admin");
        count = await instance.getProposedCount.call();
        assert.equal(count, 0, "expected 0 proposed admin, found " + count);

        // Propose a new admin from account 1
        await instance.proposeAdmin(web3.eth.accounts[5], "Stephen", 
                                            {from: web3.eth.accounts[0]});
               
        count = await instance.getAdminCount.call();        
        assert.equal(count, 4, "expected 4 admins, found " + count);// Should still only have 4 admins
        count = await instance.getProposedCount.call();
        assert.equal(count, 1, "expected 1 proposed admin, found " + count);
        count = await instance.countOfVotesFor(web3.eth.accounts[5]);
        // Should only have the proposer's vote
        assert.equal(count, 1, "expected 1 voteFor, found " + count);
        instance.hasAlreadyVotedFor.call(web3.eth.accounts[5], 
            {from: web3.eth.accounts[0]}).then(result => {
                assert.equal(result, true, "expected hasAlreadyVotedFor to return true");
            });

        // Vote from account 2
        await instance.voteFor(web3.eth.accounts[5], 
            {from: web3.eth.accounts[2]});
        count = await instance.countOfVotesFor(web3.eth.accounts[5]);
        // Should have proposer's and second account votefor
        assert.equal(count, 2, "expected 2 voteFor, found " + count);
        instance.hasAlreadyVotedFor.call(web3.eth.accounts[5], 
            {from: web3.eth.accounts[2]}).then(result => {
                assert.equal(result, true, "expected hasAlreadyVotedFor to return true");
            });

        // Rescind from account 2
        await instance.rescindVoteFor(web3.eth.accounts[5], 
            {from: web3.eth.accounts[2]});
        count = await instance.countOfVotesFor(web3.eth.accounts[5]);
        // Should have proposer's votefor
        assert.equal(count, 1, "expected 1 voteFor, found " + count);
        instance.hasAlreadyVotedFor.call(web3.eth.accounts[5], 
            {from: web3.eth.accounts[2]}).then(result => {
                assert.equal(result, false, "expected hasAlreadyVotedFor to return false");
            });

        // Rescind from account 1
        await instance.rescindVoteFor(web3.eth.accounts[5], {from: web3.eth.accounts[0]});
        count = await instance.getProposedCount.call();
        assert.equal(count, 0, "expected 0 proposed admins, found " + count); 
    });

    it("should allow an admin to rescind a vote against an existing admin", async () => {
        let instance = await AdminValidatorSet.deployed();
        let admins = await instance.getAdmins.call();
        let count = await instance.getAdminCount.call();

        // Test Setup to make sure everything is already right 
        assert.equal(count, 4, "expected 4 admins, found " + count);
        let admin1 = admins[0];
        let admin2 = admins[1];
        let adminToVoteAgainst = admins[2];
        assert.equal(web3.eth.accounts[0], admin1, "missing expected admin");
        assert.equal(web3.eth.accounts[1], admin2, "missing expected admin");
        assert.equal(web3.eth.accounts[2], adminToVoteAgainst, "missing expected admin");
        assert.equal(web3.eth.accounts[3], admins[3], "missing expected admin");

        // Vote against the admin from account 1
        await instance.voteAgainst(adminToVoteAgainst, { from: admin1 });               
        count = await instance.getAdminCount.call();        
        assert.equal(count, 4, "expected 4 admins, found " + count); // Should start with 4 admins
        count = await instance.countOfVotesAgainst(adminToVoteAgainst);
        assert.equal(count, 1, "expected 1 voteAgainst, found " + count);
        instance.hasAlreadyVotedAgainst.call(adminToVoteAgainst, 
            {from: admin1}).then(result => {
                assert.equal(result, true, "expected hasAlreadyVotedFor to return true");
            }); 

        // Vote against the admin from account 2
        await instance.voteAgainst(adminToVoteAgainst, { from: admin2 });
        count = await instance.getAdminCount.call();
        assert.equal(count, 4, "expected 4 admins, found " + count); // Should still have 4 admins
        count = await instance.countOfVotesAgainst(adminToVoteAgainst);
        assert.equal(count, 2, "expected 2 voteAgainst, found " + count);
        instance.hasAlreadyVotedAgainst.call(adminToVoteAgainst, 
            {from: admin2}).then(result => {
                assert.equal(result, true, "expected hasAlreadyVotedFor to return true");
            }); 


        // Rescind vote from account 1
        await instance.rescindVoteAgainst(adminToVoteAgainst, {from: admin1});
        count = await instance.countOfVotesAgainst(adminToVoteAgainst);
        assert.equal(count, 1, "expected 1 voteAgainst, found " + count);
        instance.hasAlreadyVotedAgainst.call(adminToVoteAgainst, 
            {from: admin1}).then(result => {
                assert.equal(result, false, "expected hasAlreadyVotedFor to return false");
            }); 

        // Rescind vote from account 2
        await instance.rescindVoteAgainst(adminToVoteAgainst, {from: admin2});
        count = await instance.countOfVotesAgainst(adminToVoteAgainst);
        assert.equal(count, 0, "expected 0 voteAgainst, found " + count);
        instance.hasAlreadyVotedAgainst.call(adminToVoteAgainst, 
            {from: admin2}).then(result => {
                assert.equal(result, false, "expected hasAlreadyVotedFor to return false");
            }); 
    });

    it("should list votes for a proposed admin", async () => {
        let instance = await AdminValidatorSet.deployed();
        let admins = await instance.getAdmins.call();
        let count = await instance.getAdminCount.call();

        // Test Setup to make sure everything is already right 
        assert.equal(count, 4, "expected 4 admins, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
        assert.equal(web3.eth.accounts[1], admins[1], "missing expected admin");
        assert.equal(web3.eth.accounts[2], admins[2], "missing expected admin");
        assert.equal(web3.eth.accounts[3], admins[3], "missing expected admin");
        count = await instance.getProposedCount.call();
        assert.equal(count.toNumber(), 0, "expected 0 proposed admin, found " + count);

        let tempAdmin = web3.eth.accounts[5];

        // Propose a new admin from account 1
        await instance.proposeAdmin(tempAdmin, "Stephen", {
            from: web3.eth.accounts[0]
        });

        count = await instance.getAdminCount.call();
        // Should still only have 4 admins
        assert.equal(count, 4, "expected 4 admins, found " + count); 
        count = await instance.getProposedCount.call();
        assert.equal(count, 1, "expected 1 proposed admin, found " + count);

        let adminsWhoVotedFor = await instance.whoHasVotedFor(tempAdmin);
        assert.equal(adminsWhoVotedFor.length, 1, "should return an array of length 1");
        // Should only have the proposer's vote
        assert.equal(adminsWhoVotedFor[0], web3.eth.accounts[0], "the proposer should have voted for the tempAdmin"); 

        // Vote from account 2
        await instance.voteFor(tempAdmin, {from: web3.eth.accounts[2]});
        adminsWhoVotedFor = await instance.whoHasVotedFor(tempAdmin);
        assert.equal(adminsWhoVotedFor.length, 2, "expected 2 votes found " + adminsWhoVotedFor.length);
        // Should only have the proposer's vote
        assert.equal(adminsWhoVotedFor[0], web3.eth.accounts[0], "the proposer should have voted for the tempAdmin"); 
        assert.equal(adminsWhoVotedFor[1], web3.eth.accounts[2], "the second admin should be in the list");

        // Rescind from account 2
        await instance.rescindVoteFor(tempAdmin, {from: web3.eth.accounts[2]});
        adminsWhoVotedFor = await instance.whoHasVotedFor(tempAdmin);
        assert.equal(adminsWhoVotedFor.length, 1, "expected 1 vote found " + adminsWhoVotedFor.length);
        // Should only have the proposer's vote
        assert.equal(adminsWhoVotedFor[0], web3.eth.accounts[0], "the proposer should have voted for the tempAdmin");

        // Rescind from account 1
        await instance.rescindVoteFor(tempAdmin, {from: web3.eth.accounts[0]});
        // Make sure the tempAdmin is no longer proposed
        count = await instance.getProposedCount.call();
        assert.equal(count, 0, "expected 0 proposed admins, found " + count);   
    });

    it("should list votes against an admin", async () => {
        let instance = await AdminValidatorSet.deployed();
        let admins = await instance.getAdmins.call();
        let count = await instance.getAdminCount.call();

        // Test Setup to make sure everything is already right 
        assert.equal(count, 4, "expected 4 admins, found " + count);
        assert.equal(web3.eth.accounts[0], admins[0], "missing expected admin");
        assert.equal(web3.eth.accounts[1], admins[1], "missing expected admin");
        assert.equal(web3.eth.accounts[2], admins[2], "missing expected admin");
        assert.equal(web3.eth.accounts[3], admins[3], "missing expected admin");
        count = await instance.getProposedCount.call();
        assert.equal(count.toNumber(), 0, "expected 0 proposed admin, found " + count);

        let testAdmin = web3.eth.accounts[3];

        let adminsWhoVotedAgainst = await instance.whoHasVotedAgainst(testAdmin);
        assert.equal(adminsWhoVotedAgainst.length, 0, "expected 0 votes found " + adminsWhoVotedAgainst.length);

        // Vote against the testAdmin
        await instance.voteAgainst(testAdmin,{
            from: web3.eth.accounts[0]
        })

        adminsWhoVotedAgainst = await instance.whoHasVotedAgainst(testAdmin);
        assert.equal(adminsWhoVotedAgainst.length, 1, "expected 1 votes found " + adminsWhoVotedAgainst.length);
        assert.equal(adminsWhoVotedAgainst[0], web3.eth.accounts[0], "the first admin should have voted against");

        // Vote against the testAdmin again 
        await instance.voteAgainst(testAdmin,{
            from: web3.eth.accounts[1]
        })
        adminsWhoVotedAgainst = await instance.whoHasVotedAgainst(testAdmin);
        assert.equal(adminsWhoVotedAgainst.length, 2, "expected 2 votes found " + adminsWhoVotedAgainst.length);
        assert.equal(adminsWhoVotedAgainst[0], web3.eth.accounts[0], "the first admin should have voted against");
        assert.equal(adminsWhoVotedAgainst[1], web3.eth.accounts[1], "the second admin should have voted against");

        // Rescind the vote from one account
        await instance.rescindVoteAgainst(testAdmin, {from: web3.eth.accounts[0]});
        adminsWhoVotedAgainst = await instance.whoHasVotedAgainst(testAdmin);
        assert.equal(adminsWhoVotedAgainst.length, 1, "expected 1 votes found " + adminsWhoVotedAgainst.length);
        assert.equal(adminsWhoVotedAgainst[0], web3.eth.accounts[1], "only the second admin should have voted against");

        await instance.rescindVoteAgainst(testAdmin, {from: web3.eth.accounts[1]});
        adminsWhoVotedAgainst = await instance.whoHasVotedAgainst(testAdmin);
        assert.equal(adminsWhoVotedAgainst.length, 0, "expected 0 votes found " + adminsWhoVotedAgainst.length);
    });
  
    it("should let admin vote to remove admins", async () => {
        let instance = await AdminValidatorSet.deployed();
        let count = await instance.getAdminCount.call();
        assert.equal(count, 4, "expected 4 admin, found " + count);

        // Add a validator the admin about to be removed
        await instance.addValidators([validatorIDList[13]],
            {from: web3.eth.accounts[0]});

        await instance.finalizeChange();
        let vals = await instance.getValidators.call();
        assert.equal(vals.length, 4, "expected 4 validators found " + vals.length);

        // Add more validators to the network to make sure we keep at least the minimum required
        await instance.addValidators([validatorIDList[0],
            validatorIDList[1]],
            {from: web3.eth.accounts[2]});

        await instance.finalizeChange();

        vals = await instance.getValidators.call();
        assert.equal(vals.length, 6, "expected 6 validators found " + vals.length);

        // Setting up a voteFor and voteAgainst from admin0 (should be removed with admin) 
        // VoteFor
        await instance.proposeAdmin(web3.eth.accounts[4], "ToBeRemoved", 
                                            {from: web3.eth.accounts[0]});
        count = await instance.countOfVotesFor(web3.eth.accounts[4]);
        assert.equal(count, 1, "expected 1 voteFor, found " + count);

        // VoteAgainst
        await instance.voteAgainst(web3.eth.accounts[1],
            {from: web3.eth.accounts[0]});
        count = await instance.countOfVotesAgainst(web3.eth.accounts[1]);
        assert.equal(count, 1, "expected 1 voteAgainst, found " + count);
        // Expect no change since not majority
        count = await instance.getAdminCount.call();
        assert.equal(count, 4, "expected 4 admin, found " + count);

        // Admin can vote to remove themselves
        // One vote is not majority (1/4)
        await instance.voteAgainst(web3.eth.accounts[0],
            {from: web3.eth.accounts[0]});

        count = await instance.countOfVotesAgainst(web3.eth.accounts[0]);
        assert.equal(count, 1, "expected 1 voteAgainst, found " + count);

        count = await instance.getAdminCount.call();
        assert.equal(count, 4, "expected 4 admin, found " + count);

        // Two votes is not majority (2/4)
        await instance.voteAgainst(web3.eth.accounts[0],
            {from: web3.eth.accounts[2]});
        
        count = await instance.countOfVotesAgainst(web3.eth.accounts[0]);
        assert.equal(count, 2, "expected 2 voteAgainst, found " + count);

        count = await instance.getAdminCount.call();
        assert.equal(count, 4, "expected 4 admin, found " + count);

        // Three votes is majority (3/4) 
        await instance.voteAgainst(web3.eth.accounts[0],
            {from: web3.eth.accounts[3]});

        // call finalize to remove validators
        await instance.finalizeChange();

        count = await instance.getAdminCount.call();
        assert.equal(count, 3, "expected 3 admin, found " + count);
        let admins = await instance.getAdmins.call();
        assert.equal(admins.indexOf(web3.eth.accounts[0]) < 0, true, "expected admin to be removed");

        // Removing an admin will remove all the admin's validators
        vals = await instance.getValidators.call();
        assert.equal(vals.length, 2, "expected 2 validators found " + vals.length);

        // Removing an admin will remove all votes from that admin
        count = await instance.countOfVotesFor(web3.eth.accounts[4]);
        assert.equal(count, 0, "expected 0 voteFor, found " + count);
        count = await instance.countOfVotesAgainst(web3.eth.accounts[1]);
        assert.equal(count, 0, "expected 0 voteAgainst, found " + count);

        // Cannot vote against an admin that's not present
        expectThrow(instance.voteAgainst(web3.eth.accounts[0],
            {from: web3.eth.accounts[0]}));
    });

    it("should let admin change consortium name", async () => {
        let instance = await AdminValidatorSet.deployed();
        var tempConsortiumName = "TestConsortium123";

        var defaultConsortiumName = "Microsoft Proof of Authority";
        var currentConsortiumName = await instance.getConsortiumName();
        assert.equal(currentConsortiumName, defaultConsortiumName, "Should equal default name");

        // Change the consortium name
        await instance.setConsortiumName(tempConsortiumName, {
            from: web3.eth.accounts[1]
        });

        currentConsortiumName = await instance.getConsortiumName();
        assert.equal(currentConsortiumName, tempConsortiumName, "Temporary consortium name");

        // Change the consortium name back to default value
        await instance.setConsortiumName(defaultConsortiumName, {
            from: web3.eth.accounts[1]
        });
        currentConsortiumName = await instance.getConsortiumName();
        assert.equal(currentConsortiumName, defaultConsortiumName, "Consortium name should be back to default");        
    });
    
    it("should not let non-admins change consortium name", async () => {
        let instance = await AdminValidatorSet.deployed();
        
        // Should reject if non-admin tries to change consortium name
        expectThrow(instance.setConsortiumName("test", {
                    from: web3.eth.accounts[6]
        }));
    });
    
    it("should let non-admins propose themselves", async () => {
        let instance = await AdminValidatorSet.deployed();
        
        var prevCount = await instance.getProposedCount.call();
        // Non-admins can propose themselves 
        await instance.proposeAdmin(web3.eth.accounts[6], "Szabo", 
                                            {from: web3.eth.accounts[6]});

        var proposedAdmins = await instance.getProposedAdmins.call();
        assert.equal(true, proposedAdmins.indexOf(web3.eth.accounts[6]) >= 0, "missing expected proposed admin");
        var count = await instance.getProposedCount.call();
        var expectedCount = prevCount.toNumber() + 1;
        assert.equal(count.toNumber(), expectedCount, "expected 1 more proposed admin");
        var votesFor = await instance.whoHasVotedFor.call(web3.eth.accounts[6]);
        assert.equal(votesFor.length, 0, "expected 0 votes for admin");
    });
});  