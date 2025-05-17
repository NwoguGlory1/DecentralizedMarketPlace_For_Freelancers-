import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Basic functionality tests
Clarinet.test({
    name: "Ensure that contract owner can initialize the contract",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "initialize",
                [],
                deployer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
    },
});

// Job posting tests
Clarinet.test({
    name: "Ensure that users can post a job",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const title = "Web3 Development";
        const description = "Build a dApp";
        const budget = 1000000; // 1 STX
        const deadline = 10000; // Some block height in the future
        
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii(title),
                    types.ascii(description),
                    types.uint(budget),
                    types.uint(deadline)
                ],
                client.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u1)'); // First job id should be 1
    },
});

Clarinet.test({
    name: "Ensure that job posting fails with invalid parameters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const title = "Web3 Development";
        const description = "Build a dApp";
        const invalidBudget = 0; // Invalid budget
        const currentBlockHeight = chain.blockHeight;
        const invalidDeadline = currentBlockHeight - 1; // Deadline in the past
        
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii(title),
                    types.ascii(description),
                    types.uint(invalidBudget),
                    types.uint(currentBlockHeight + 100)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii(title),
                    types.ascii(description),
                    types.uint(1000000),
                    types.uint(invalidDeadline)
                ],
                client.address
            )
        ]);
        
        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, '(err u106)'); // err-invalid-amount
        assertEquals(block.receipts[1].result, '(err u107)'); // err-past-deadline
    },
});

// Bid submission tests
Clarinet.test({
    name: "Ensure that freelancers can submit bids on open jobs",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        
        // First post a job
        let block1 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            )
        ]);
        
        const jobId = 1; // First job id
        
        // Now submit a bid
        let block2 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(jobId),
                    types.uint(900000), // Bid less than budget
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            )
        ]);
        
        assertEquals(block2.receipts.length, 1);
        assertEquals(block2.receipts[0].result, '(ok true)');
        
        // Check that the bid was recorded correctly
        const bidResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-bid",
            [types.uint(jobId), types.principal(freelancer.address)],
            freelancer.address
        );
        
        assertEquals(bidResult.result, `(some {amount: u900000, proposal: "I can build this dApp efficiently"})`);
    },
});

Clarinet.test({
    name: "Ensure client cannot bid on their own job",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        
        // First post a job
        let block1 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            )
        ]);
        
        const jobId = 1; // First job id
        
        // Try to submit a bid on own job
        let block2 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(jobId),
                    types.uint(900000),
                    types.ascii("I'll do my own job")
                ],
                client.address
            )
        ]);
        
        assertEquals(block2.receipts.length, 1);
        assertEquals(block2.receipts[0].result, '(err u105)'); // err-unauthorized
    },
});

// Bid acceptance tests
Clarinet.test({
    name: "Ensure client can accept a bid and fund escrow",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        const bidAmount = 900000;
        
        // Post a job
        let block1 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            )
        ]);
        
        const jobId = 1;
        
        // Submit a bid
        let block2 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(jobId),
                    types.uint(bidAmount),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            )
        ]);
        
        // Accept the bid
        let block3 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(jobId),
                    types.principal(freelancer.address)
                ],
                client.address
            )
        ]);
        
        assertEquals(block3.receipts.length, 1);
        assertEquals(block3.receipts[0].result, '(ok true)');
        
        // Check that job status was updated
        const jobResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-job",
            [types.uint(jobId)],
            client.address
        );
        
        // Job status should be 2 (In Progress) and freelancer should be set
        const jobData = jobResult.result.replace(/\s+/g, " ");
        assertTrue(jobData.includes(`status: u2`));
        assertTrue(jobData.includes(`freelancer: (some ${freelancer.address})`));
        
        // Check that escrow was funded
        const escrowResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-escrow-balance",
            [types.uint(jobId)],
            client.address
        );
        
        assertEquals(escrowResult.result, `u${bidAmount}`);
    },
});

Clarinet.test({
    name: "Ensure only client can accept a bid",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        const unauthorized = accounts.get('wallet_3')!;
        
        // Post a job
        let block1 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            )
        ]);
        
        const jobId = 1;
        
        // Submit a bid
        let block2 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(jobId),
                    types.uint(900000),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            )
        ]);
        
        // Unauthorized user tries to accept the bid
        let block3 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(jobId),
                    types.principal(freelancer.address)
                ],
                unauthorized.address
            )
        ]);
        
        assertEquals(block3.receipts.length, 1);
        assertEquals(block3.receipts[0].result, '(err u105)'); // err-unauthorized
    },
});

// Job completion and payment tests
Clarinet.test({
    name: "Ensure client can mark job as complete and release payment",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        const bidAmount = 900000;
        
        // Setup: Post job, submit bid, accept bid
        let setup = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(1),
                    types.uint(bidAmount),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(1),
                    types.principal(freelancer.address)
                ],
                client.address
            )
        ]);
        
        // Get freelancer's initial balance
        const initialBalance = chain.getAssetsMaps().assets["STX"][freelancer.address];
        
        // Complete the job
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "complete-job",
                [types.uint(1)],
                client.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Check job status was updated
        const jobResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-job",
            [types.uint(1)],
            client.address
        );
        
        const jobData = jobResult.result.replace(/\s+/g, " ");
        assertTrue(jobData.includes(`status: u3`)); // Completed
        
        // Check that escrow was cleared
        const escrowResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-escrow-balance",
            [types.uint(1)],
            client.address
        );
        
        assertEquals(escrowResult.result, `u0`);
        
        // Check that freelancer got paid
        const finalBalance = chain.getAssetsMaps().assets["STX"][freelancer.address];
        assertEquals(finalBalance, initialBalance + BigInt(bidAmount));
    },
});

Clarinet.test({
    name: "Ensure only client can mark job as complete",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        const unauthorized = accounts.get('wallet_3')!;
        
        // Setup: Post job, submit bid, accept bid
        let setup = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(1),
                    types.uint(900000),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(1),
                    types.principal(freelancer.address)
                ],
                client.address
            )
        ]);
        
        // Unauthorized user tries to complete the job
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "complete-job",
                [types.uint(1)],
                unauthorized.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u105)'); // err-unauthorized  
    },
});

// Job cancellation tests
Clarinet.test({
    name: "Ensure client can cancel a job that hasn't started",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        
        // Post a job
        let block1 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            )
        ]);
        
        // Cancel the job
        let block2 = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "cancel-job",
                [types.uint(1)],
                client.address
            )
        ]);
        
        assertEquals(block2.receipts.length, 1);
        assertEquals(block2.receipts[0].result, '(ok true)');
        
        // Check job status was updated
        const jobResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-job",
            [types.uint(1)],
            client.address
        );
        
        const jobData = jobResult.result.replace(/\s+/g, " ");
        assertTrue(jobData.includes(`status: u4`)); // Cancelled
    },
});

Clarinet.test({
    name: "Ensure client cannot cancel a job that's in progress",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        
        // Setup: Post job, submit bid, accept bid
        let setup = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(1),
                    types.uint(900000),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(1),
                    types.principal(freelancer.address)
                ],
                client.address
            )
        ]);
        
        // Try to cancel the job that's in progress
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "cancel-job",
                [types.uint(1)],
                client.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // err-invalid-status
    },
});

// Dispute resolution tests
Clarinet.test({
    name: "Ensure users can open disputes for jobs",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        
        // Setup: Post job, submit bid, accept bid
        let setup = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(1),
                    types.uint(900000),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(1),
                    types.principal(freelancer.address)
                ],
                client.address
            )
        ]);
        
        // Client opens a dispute
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "open-dispute",
                [
                    types.uint(1),
                    types.ascii("Work quality is below expectations")
                ],
                client.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u1)'); // First dispute id
    },
});

Clarinet.test({
    name: "Ensure contract owner can resolve disputes",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        const bidAmount = 900000;
        
        // Setup: Post job, submit bid, accept bid, open dispute
        let setup = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(1),
                    types.uint(bidAmount),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(1),
                    types.principal(freelancer.address)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "open-dispute",
                [
                    types.uint(1),
                    types.ascii("Work quality is below expectations")
                ],
                client.address
            )
        ]);
        
        // Get freelancer's initial balance
        const initialBalance = chain.getAssetsMaps().assets["STX"][freelancer.address];
        
        // Contract owner resolves the dispute (pays 60% to freelancer)
        const resolutionAmount = Math.floor(bidAmount * 0.6);
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "resolve-dispute",
                [
                    types.uint(1), // Dispute id
                    types.uint(resolutionAmount)
                ],
                deployer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Check freelancer got paid partial amount
        const finalBalance = chain.getAssetsMaps().assets["STX"][freelancer.address];
        assertEquals(Number(finalBalance - initialBalance), resolutionAmount);
    },
});

// User profile and skills tests
Clarinet.test({
    name: "Ensure users can create and update profiles",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "update-profile",
                [
                    types.ascii("John Doe"),
                    types.ascii("Experienced blockchain developer specializing in Clarity smart contracts"),
                    types.ascii("john@example.com"),
                    types.uint(100000) // 0.1 STX per hour
                ],
                user.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Check profile was created
        const profileResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-profile",
            [types.principal(user.address)],
            user.address
        );
        
        const profileData = profileResult.result.replace(/\s+/g, " ");
        assertTrue(profileData.includes(`name: "John Doe"`));
        assertTrue(profileData.includes(`hourly-rate: u100000`));
    },
});

Clarinet.test({
    name: "Ensure freelancers can update their skills",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const freelancer = accounts.get('wallet_2')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "update-skills",
                [
                    types.list([
                        types.ascii("Clarity"),
                        types.ascii("Solidity"),
                        types.ascii("JavaScript"),
                        types.ascii("React")
                    ])
                ],
                freelancer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
    },
});

// Rating system tests
Clarinet.test({
    name: "Ensure clients can rate freelancers after job completion",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        
        // Setup: Post job, submit bid, accept bid, complete job
        let setup = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(1),
                    types.uint(900000),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(1),
                    types.principal(freelancer.address)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "complete-job",
                [types.uint(1)],
                client.address
            )
        ]);
        
        // Client rates the freelancer
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "rate-job",
                [
                    types.uint(1), // Job id
                    types.uint(5)  // 5-star rating
                ],
                client.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Check that rating was recorded
        const ratingResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-user-rating",
            [types.principal(freelancer.address)],
            client.address
        );
        
        const ratingData = ratingResult.result.replace(/\s+/g, " ");
        assertTrue(ratingData.includes(`average-rating: u5`));
        assertTrue(ratingData.includes(`ratings-count: u1`));
    },
});

Clarinet.test({
    name: "Ensure freelancers can rate clients after job completion",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const client = accounts.get('wallet_1')!;
        const freelancer = accounts.get('wallet_2')!;
        
        // Setup: Post job, submit bid, accept bid, complete job
        let setup = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "post-job",
                [
                    types.ascii("Web3 Development"),
                    types.ascii("Build a dApp"),
                    types.uint(1000000),
                    types.uint(10000)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "submit-bid",
                [
                    types.uint(1),
                    types.uint(900000),
                    types.ascii("I can build this dApp efficiently")
                ],
                freelancer.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "accept-bid",
                [
                    types.uint(1),
                    types.principal(freelancer.address)
                ],
                client.address
            ),
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "complete-job",
                [types.uint(1)],
                client.address
            )
        ]);
        
        // Freelancer rates the client
        let block = chain.mineBlock([
            Tx.contractCall(
                "decentralized-marketplace-for-freelancers",
                "rate-job",
                [
                    types.uint(1), // Job id
                    types.uint(4)  // 4-star rating
                ],
                freelancer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Check that rating was recorded
        const ratingResult = chain.callReadOnlyFn(
            "decentralized-marketplace-for-freelancers",
            "get-user-rating",
            [types.principal(client.address)],
            freelancer.address
        );
        
        const ratingData = ratingResult.result.replace(/\s+/g, " ");
        assertTrue(ratingData.includes(`average-rating: u4`));
        assertTrue(ratingData.includes(`ratings-count: u1`));
    },
});

// Helper function for tests
function assertTrue(condition: boolean) {
    assertEquals(condition, true);
}