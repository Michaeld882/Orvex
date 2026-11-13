# ORVEX contract specification

Target chain: Arc Mainnet (chain id 5042). Native gas is USDC. No contract moves, holds or accepts value. No payable functions, no `receive`/`fallback`. "Rewards" on challenges are a free-text note only.

Global rules: `pragma solidity 0.8.28;` (exact). OpenZeppelin 5.6.1 (`Ownable2Step`, `ReentrancyGuard`). Custom errors only (no revert strings). NatSpec on every contract, event, error and external function. Every file strictly below 500 lines. No upgradeability, no proxies, no selfdestruct, no delegatecall, no hidden admin power. Events for every state change. Immutable references to sibling contracts. Strings are stored onchain with explicit byte-length bounds; every bound is a `public constant`.

All paginated views take `(uint256 offset, uint256 limit)`, clamp `limit` to `MAX_PAGE = 50`, return an empty array when `offset >= total`, and never revert on a large offset. Ids start at 1. `0` is never a valid id.

Shared files: `contracts/interfaces/IOrvex.sol` (interfaces + `ActivityKind` enum), `contracts/libraries/OrvexText.sol` (library with `requireLen(string, min, max)` and `requireLink(string, maxLen)` where a link must start with `https://` or `ipfs://`, plus `isEmpty`).

```
enum ActivityKind { ChallengeCreated, ChallengeJoined, ChallengeCompleted, ProjectProposed, ContributionAccepted, IdeaPosted, EndorsementReceived }
```

## 1. OrvexIdentity (contracts/OrvexIdentity.sol)
Public profiles + the reputation ledger. `Ownable2Step`.
- Recorder allowlist: `setRecorder(address, bool)` onlyOwner, reverts after `finalizeRecorders()`; `finalizeRecorders()` onlyOwner, one-way, permanently freezes the allowlist (event `RecordersFinalized`). `isRecorder(address)`, `recordersFinalized()`. Zero address rejected.
- Profile (anyone, for themselves): `setProfile(string displayName (1..32), string bio (0..280), string skillsNote (0..120), string link (0..200, if non-empty must pass requireLink))`. Event `ProfileUpdated(address indexed user)`. `getProfile(address) returns (Profile)` with fields `displayName, bio, skillsNote, link, updatedAt (uint40), exists (bool)`.
- Stats struct `Stats { uint32 points; uint32 challengesCreated; uint32 challengesJoined; uint32 challengesCompleted; uint32 projectsProposed; uint32 contributionsAccepted; uint32 ideasPosted; uint32 endorsementsReceived; }`. `statsOf(address) returns (Stats)`.
- `record(address user, ActivityKind kind, string skill)` onlyRecorder (reverts `NotRecorder`). Increments the matching counter. Points are awarded ONLY for peer-validated outcomes: `ChallengeCompleted` = 20, `ContributionAccepted` = 15 (public constants `POINTS_CHALLENGE_COMPLETED`, `POINTS_CONTRIBUTION_ACCEPTED`). All other kinds are counters with 0 points. Saturating adds on uint32 (never revert on overflow of a counter). If `skill` is non-empty and kind is `ChallengeCompleted` or `ContributionAccepted`, bump the user's verified-skill count for that skill (skill key = keccak256 of the lowercased-agnostic exact bytes; skill length 1..24). Track a per-user unique skill list, capped at `MAX_SKILLS = 32` (further new skills still count toward points but are not listed). Emit `ActivityRecorded(address indexed user, ActivityKind indexed kind, uint32 pointsAwarded, uint32 totalPoints)` and `SkillVerified(address indexed user, bytes32 indexed skillKey, string skill, uint32 count)`.
- `getSkills(address) returns (string[] names, uint32[] counts)`.
- `levelOf(uint32 points) pure returns (uint8)`: thresholds 0->1, 50->2, 150->3, 400->4, 1000->5. `levelOf` exposed also as `levelOfUser(address)`.
- `totalProfiles()` counter of distinct profiles created; `knownUsers` list is NOT needed.
- Leaderboard support: the contract keeps an append-only `address[] participants` list that adds a user the first time they receive any `record` call (dedupe with a mapping), `participantCount()`, `listParticipants(offset, limit)`. Frontend ranks client side from `statsOf`. Add view `listParticipantStats(offset, limit) returns (address[] users, Stats[] stats)`.

## 2. OrvexProof (contracts/OrvexProof.sol)
Immutable contribution records + achievement claims. `Ownable2Step`, same recorder allowlist/finalize pattern as Identity. Constructor `(address owner, IOrvexIdentity identity)`.
- `Contribution { uint64 id; address contributor; address attestor; Source source (enum Challenge, Project); uint64 sourceId; uint40 recordedAt; string title; string uri; bytes32 digest; }`.
- `record(address contributor, address attestor, Source source, uint64 sourceId, string title, string uri) returns (uint64 id)` onlyRecorder. Title 1..80, uri 1..200 (requireLink). `digest = keccak256(abi.encode(id, contributor, attestor, source, sourceId, title, uri, block.chainid, address(this)))`. Records are never editable or deletable. Event `ContributionRecorded(uint64 indexed id, address indexed contributor, address indexed attestor, Source source, uint64 sourceId, bytes32 digest)`.
- Views: `contributionCount()`, `getContribution(id)` (revert `UnknownRecord`), `listContributions(offset, limit)`, `userContributionCount(user)`, `listUserContributionIds(user, offset, limit) returns (uint64[])`, `verifyRecord(uint64 id, bytes32 digest) returns (bool)` (true only if the record exists and digest matches).
- Achievements (fixed in code, 6 of them): 0 FIRST_PROOF (userContributionCount >= 1), 1 CHALLENGER (stats.challengesCompleted >= 1), 2 BUILDER (challengesCompleted >= 5), 3 ORGANIZER (challengesCreated >= 1), 4 VISIONARY (projectsProposed >= 1 or ideasPosted >= 1), 5 LUMINARY (points >= 500). `ACHIEVEMENT_COUNT = 6`.
- `isEligible(address user, uint8 id) returns (bool)` view (reverts `UnknownAchievement` for id >= 6). `claimAchievement(uint8 id)` callable by anyone for themselves only: requires eligible and not already claimed, sets bit in `achievementMask[user]`, event `AchievementClaimed(address indexed user, uint8 indexed id)`. Badges are non-transferable (a mapping bitmask, not a token). `achievementsOf(user) returns (uint256 mask)`; `hasAchievement(user, id)`.

## 3. OrvexChallenges (contracts/OrvexChallenges.sol)
`ReentrancyGuard`. Not owned, no admin. Constructor `(IOrvexIdentity identity, IOrvexProof proof)` both immutable.
- `Status { Open, Closed, Cancelled }`; `SubmissionStatus { None, Pending, Approved, Rejected }`.
- `Challenge { uint64 id; address creator; uint40 createdAt; uint40 deadline; uint32 maxParticipants; uint32 participants; uint32 submissions; uint32 approved; Status status; string title; string description; string skill; string rewardNote; }`.
- `Submission { SubmissionStatus status; uint8 attempts; uint40 submittedAt; uint40 reviewedAt; string uri; string note; }`.
- `createChallenge(string title (3..80), string description (10..1000), string skill (1..24), string rewardNote (0..120), uint40 deadline, uint32 maxParticipants (1..1000)) returns (uint64)`. Deadline must be >= block.timestamp + `MIN_DURATION` (1 hour) and <= block.timestamp + `MAX_DURATION` (365 days). Records `ChallengeCreated` in identity. Event `ChallengeCreated(uint64 indexed id, address indexed creator, uint40 deadline, uint32 maxParticipants, string title)`.
- `joinChallenge(id)`: not creator (`CreatorCannotJoin`), status Open, before deadline, not full, not already joined. Records `ChallengeJoined`. Event `ChallengeJoined(uint64 indexed id, address indexed participant)`.
- `submitWork(id, string uri (requireLink, <=200), string note (0..280))`: must be a participant, status Open and before deadline, submission status None or Rejected, attempts < `MAX_ATTEMPTS` (3). Sets Pending. Event `WorkSubmitted(uint64 indexed id, address indexed participant, uint8 attempt)`.
- `reviewSubmission(id, address participant, bool approve)` onlyCreator, nonReentrant, status != Cancelled, submission must be Pending. Approve: status Approved, `approved++`, then (effects before interactions) call `proof.record(participant, creator, Source.Challenge, id, challenge.title, submission.uri)` and `identity.record(participant, ChallengeCompleted, challenge.skill)`. Reject: status Rejected. Event `SubmissionReviewed(uint64 indexed id, address indexed participant, address indexed reviewer, bool approved)`. Reviews are allowed after the deadline and after Closed.
- `closeChallenge(id)` onlyCreator, Open -> Closed (no new joins or submissions). `cancelChallenge(id)` onlyCreator, only while `approved == 0`, Open or Closed -> Cancelled. Events `ChallengeClosed`, `ChallengeCancelled`.
- Views: `challengeCount()`, `getChallenge(id)` (revert `UnknownChallenge`), `listChallenges(offset, limit)`, `effectiveStatus(id) returns (uint8)` where 0 Open, 1 Closed, 2 Cancelled, 3 Expired (Open and past deadline), `getSubmission(id, participant)`, `isParticipant(id, participant)`, `listParticipants(id, offset, limit) returns (address[])`, `listCreatedIds(user, offset, limit) returns (uint64[])`, `listJoinedIds(user, offset, limit) returns (uint64[])`, `createdCount(user)`, `joinedCount(user)`.

## 4. OrvexLaunchpad (contracts/OrvexLaunchpad.sol)
`ReentrancyGuard`. No admin. Constructor `(IOrvexIdentity identity, IOrvexProof proof)`.
- `Stage { Idea, Building, Beta, Live, Paused, Archived }`; `ReviewStatus { Pending, Accepted, Rejected }`.
- `Project { uint64 id; address owner; Stage stage; uint40 createdAt; uint40 updatedAt; uint32 contributions; uint32 accepted; uint32 updates; string name; string tagline; string description; string category; string link; }`.
- `proposeProject(name 3..48, tagline 5..100, description 10..1000, category 1..24, link 0..200 (requireLink when non-empty)) returns (uint64)`; stage starts as `Idea`. Records `ProjectProposed`. Event `ProjectProposed(uint64 indexed id, address indexed owner, string name)`.
- `setStage(id, Stage)` onlyOwnerOfProject, Archived is terminal. Event `StageChanged(uint64 indexed id, Stage stage)`.
- `postUpdate(id, string text 3..280)` project owner only, not Archived, max `MAX_UPDATES` = 100 per project (`TooManyUpdates`). Stored in `ProjectUpdate { uint40 at; Stage stage; string text }` array. Event `ProjectUpdated(uint64 indexed id, uint32 index)`.
- `submitContribution(projectId, string title 3..80, string uri (requireLink))` returns contribution id (uint64, global counter starting at 1). Owner of the project cannot contribute to their own project (`OwnerCannotContribute`). Project must not be Archived/Paused-is-allowed. Per (project, contributor) at most `MAX_PENDING = 1` pending at a time. `ContributionSubmitted(uint64 indexed contributionId, uint64 indexed projectId, address indexed contributor)`.
- `reviewContribution(contributionId, bool accept)` project owner only, nonReentrant, must be Pending. Accept: update state first, then `proof.record(contributor, owner, Source.Project, projectId, title, uri)` and `identity.record(contributor, ContributionAccepted, project.category)`. Event `ContributionReviewed(uint64 indexed contributionId, uint64 indexed projectId, address indexed reviewer, bool accepted)`.
- Views: `projectCount()`, `getProject(id)`, `listProjects(offset, limit)`, `getContribution(id)`, `listProjectContributionIds(projectId, offset, limit)`, `contributionCount()`, `listUpdates(projectId, offset, limit)`, `listOwnedIds(user, offset, limit)`, `ownedCount(user)`.

## 5. OrvexIdeas (contracts/OrvexIdeas.sol)
Innovation Board. No admin. Constructor `(IOrvexIdentity identity)`.
- `Idea { uint64 id; address author; uint40 createdAt; uint32 endorsements; bool retracted; string title; string body; string tag; }`.
- `postIdea(title 3..80, body 10..600, tag 1..24) returns (uint64)`; records `IdeaPosted` in identity. Rate limit: one idea per address per `POST_COOLDOWN` = 10 minutes (`CooldownActive`). Event `IdeaPosted(uint64 indexed id, address indexed author, string title)`.
- `endorse(id)`: not the author, not retracted, once per address. Records `EndorsementReceived` for the author. Event `IdeaEndorsed(uint64 indexed id, address indexed endorser, address indexed author)`. No unendorse.
- `retractIdea(id)` author only; sets `retracted` (data remains readable, UI hides). Event `IdeaRetracted`.
- Views: `ideaCount()`, `getIdea(id)`, `listIdeas(offset, limit)`, `hasEndorsed(id, user)`, `listAuthoredIds(user, offset, limit)`.

## Deployment script (contracts/script/DeployOrvex.s.sol)
Foundry script: deploy Identity (owner = deployer broadcaster), Proof, Challenges, Launchpad, Ideas; `setRecorder` wiring (Identity: Challenges, Launchpad, Ideas; Proof: Challenges, Launchpad); then `finalizeRecorders()` on both; then `transferOwnership` is NOT used (ownership remains with the deployer only for the already-frozen allowlist; document this). Log all addresses with `console2`. Refuse to run unless `block.chainid` is 5042 or 5042002 (`revert("unsupported chain")` is fine in a script). Must not contain any private key.
