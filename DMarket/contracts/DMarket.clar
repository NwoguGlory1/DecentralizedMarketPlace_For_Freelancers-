;; Freelancer Marketplace Contract - Updated
;; Allows clients to post jobs, freelancers to bid, and handles escrow payments

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-invalid-status (err u103))
(define-constant err-insufficient-funds (err u104))
(define-constant err-unauthorized (err u105))
(define-constant err-invalid-amount (err u106))
(define-constant err-past-deadline (err u107))
(define-constant err-invalid-rating (err u108))
(define-constant err-already-rated (err u109))
(define-constant err-invalid-team (err u110))
(define-constant err-invalid-percentage (err u111))
(define-constant err-verification-required (err u112))
(define-constant err-invalid-invitation (err u113))
(define-constant minimum-bid-time u720)

;; Job Status: 1-Open, 2-In Progress, 3-Completed, 4-Cancelled
(define-data-var next-job-id uint u1)
(define-data-var next-dispute-id uint u1)
(define-data-var next-team-id uint u1)
(define-data-var next-invitation-id uint u1)
(define-data-var next-verification-id uint u1)


;; Job Details Map
(define-map jobs
    uint
    {
        client: principal,
        title: (string-ascii 100),
        description: (string-ascii 500),
        budget: uint,
        freelancer: (optional principal),
        status: uint,
        deadline: uint,
        created-at: uint,
        is-featured: bool
    }
)

;; Bids mapping: job-id -> freelancer -> bid amount
(define-map bids
    {job-id: uint, freelancer: principal}
    {
        amount: uint,
        proposal: (string-ascii 500)
    }
)

;; Escrow balances
(define-map escrow-balance
    uint
    uint
)

;; Subscription system for featured job listings
(define-map subscriptions
    principal
    {
        level: uint,  ;; 1-Basic, 2-Premium, 3-Enterprise
        expiry: uint,
        featured-jobs-remaining: uint
    }
)

;; Direct Job Invitations
(define-map job-invitations
    uint  ;; invitation-id
    {
        job-id: uint,
        client: principal,
        freelancer: principal,
        message: (string-ascii 200),
        status: uint  ;; 1-Pending, 2-Accepted, 3-Declined
    }
)

;; Skill Verification System
(define-map verified-skills
    uint  ;; verification-id
    {
        freelancer: principal,
        skill: (string-ascii 50),
        verifier: principal,
        verified-at: uint,
        level: uint  ;; 1-Beginner, 2-Intermediate, 3-Expert, 4-Master
    }
)

;; Freelancer Teams/Collaboration
(define-map teams
    uint  ;; team-id
    {
        name: (string-ascii 50),
        leader: principal,
        members: (list 10 principal),
        created-at: uint
    }
)

;; Team Assignments for Jobs
(define-map team-assignments
    uint  ;; job-id
    {
        team-id: uint,
        payment-splits: (list 10 {member: principal, percentage: uint})
    }
)

;; Referral System
(define-map referrals
    {referrer: principal, referee: principal}
    {
        created-at: uint,
        status: uint,  ;; 1-Pending, 2-Completed
        reward: uint
    }
)

;; Smart Deadlines
(define-map smart-deadlines
    uint  ;; job-id
    {
        original-deadline: uint,
        extensions: (list 5 {reason: (string-ascii 100), length: uint}),
        current-deadline: uint
    }
)

;; Read-only functions

(define-read-only (get-job (job-id uint))
    (map-get? jobs job-id)
)

(define-read-only (get-bid (job-id uint) (freelancer principal))
    (map-get? bids {job-id: job-id, freelancer: freelancer})
)

(define-read-only (get-escrow-balance (job-id uint))
    (default-to u0 (map-get? escrow-balance job-id))
)

(define-read-only (get-subscription (user principal))
    (map-get? subscriptions user)
)

(define-read-only (get-invitation (invitation-id uint))
    (map-get? job-invitations invitation-id)
)

(define-read-only (get-verified-skill (verification-id uint))
    (map-get? verified-skills verification-id)
)

(define-read-only (get-team (team-id uint))
    (map-get? teams team-id)
)

(define-read-only (get-team-assignment (job-id uint))
    (map-get? team-assignments job-id)
)

(define-read-only (get-referral (referrer principal) (referee principal))
    (map-get? referrals {referrer: referrer, referee: referee})
)

(define-read-only (get-smart-deadline (job-id uint))
    (map-get? smart-deadlines job-id)
)



