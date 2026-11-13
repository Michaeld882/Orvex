// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOrvexIdentity, IOrvexProof, ActivityKind} from "./interfaces/IOrvex.sol";
import {OrvexText} from "./libraries/OrvexText.sol";

/// @notice Creator-reviewed challenges with bounded submissions and no value handling or administrator.
contract OrvexChallenges is ReentrancyGuard {
    enum Status { Open, Closed, Cancelled }
    enum SubmissionStatus { None, Pending, Approved, Rejected }
    struct Challenge {
        uint64 id;
        address creator;
        uint40 createdAt;
        uint40 deadline;
        uint32 maxParticipants;
        uint32 participants;
        uint32 submissions;
        uint32 approved;
        Status status;
        string title;
        string description;
        string skill;
        string rewardNote;
    }
    struct Submission {
        SubmissionStatus status;
        uint8 attempts;
        uint40 submittedAt;
        uint40 reviewedAt;
        string uri;
        string note;
    }
    uint256 public constant MAX_PAGE = 50;
    uint256 public constant MIN_TITLE = 3;
    uint256 public constant MAX_TITLE = 80;
    uint256 public constant MIN_DESCRIPTION = 10;
    uint256 public constant MAX_DESCRIPTION = 1000;
    uint256 public constant MIN_SKILL = 1;
    uint256 public constant MAX_SKILL = 24;
    uint256 public constant MIN_REWARD_NOTE = 0;
    uint256 public constant MAX_REWARD_NOTE = 120;
    uint256 public constant MIN_URI = 1;
    uint256 public constant MAX_URI = 200;
    uint256 public constant MIN_NOTE = 0;
    uint256 public constant MAX_NOTE = 280;
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 365 days;
    uint32 public constant MIN_PARTICIPANTS = 1;
    uint32 public constant MAX_PARTICIPANTS = 1000;
    uint8 public constant MAX_ATTEMPTS = 3;
    IOrvexIdentity public immutable identity;
    IOrvexProof public immutable proof;
    uint64 private _count;
    mapping(uint64 => Challenge) private _challenges;
    mapping(uint64 => mapping(address => Submission)) private _submissions;
    mapping(uint64 => mapping(address => bool)) private _joined;
    mapping(uint64 => address[]) private _participants;
    mapping(address => uint64[]) private _createdIds;
    mapping(address => uint64[]) private _joinedIds;
    mapping(uint64 => mapping(address => bool)) private _removed;
    // Stores the participant's index in _participants plus one.
    mapping(uint64 => mapping(address => uint256)) private _participantIndex;
    mapping(uint64 => uint32) private _pendingCount;

    /// @notice A sibling address must be nonzero.
    error ZeroAddress();
    /// @notice The challenge identifier does not exist.
    error UnknownChallenge();
    /// @notice The challenge deadline is outside the allowed duration range.
    /// @param submitted The rejected deadline.
    /// @param minAllowed The earliest accepted deadline at the time of the call.
    /// @param maxAllowed The latest accepted deadline at the time of the call.
    error InvalidDeadline(uint256 submitted, uint256 minAllowed, uint256 maxAllowed);
    /// @notice Capacity is outside the permitted range.
    error InvalidCapacity();
    /// @notice Challenge creators cannot participate in their own challenge.
    error CreatorCannotJoin();
    /// @notice The action requires an open challenge before its deadline.
    error ChallengeNotOpen();
    /// @notice Challenge capacity has been reached.
    error ChallengeFull();
    /// @notice The caller has already joined.
    error AlreadyJoined();
    /// @notice The caller has not joined this challenge.
    error NotParticipant();
    /// @notice Pending or approved work cannot be submitted again.
    error InvalidSubmissionStatus();
    /// @notice All permitted submission attempts have been used.
    error TooManyAttempts();
    /// @notice Only the challenge creator may perform this action.
    error NotCreator();
    /// @notice Cancelled challenges cannot be reviewed.
    error ChallengeIsCancelled();
    /// @notice There is no pending submission to review.
    error SubmissionNotPending();
    /// @notice Cancellation is forbidden after an approval.
    error HasApprovedSubmissions();
    /// @notice Cancellation is forbidden while submissions await review.
    error HasPendingSubmissions();
    /// @notice Participants with pending or approved work cannot be removed; rejected work can be.
    error ParticipantHasSubmitted();
    /// @notice The creator permanently removed the caller from this challenge.
    error RemovedByCreator();
    /// @notice The creator removed a participant with no pending or approved work.
    /// @param id The challenge identifier.
    /// @param participant The removed participant.
    /// @param creator The challenge creator who removed the participant.
    event ParticipantRemoved(uint64 indexed id, address indexed participant, address indexed creator);
    /// @notice A new challenge was created.
    event ChallengeCreated(uint64 indexed id, address indexed creator, uint40 deadline, uint32 maxParticipants, string title);
    /// @notice A participant joined a challenge.
    event ChallengeJoined(uint64 indexed id, address indexed participant);
    /// @notice Work was submitted or resubmitted for review.
    event WorkSubmitted(uint64 indexed id, address indexed participant, uint8 attempt);
    /// @notice The creator approved or rejected a pending submission.
    event SubmissionReviewed(uint64 indexed id, address indexed participant, address indexed reviewer, bool approved);
    /// @notice The creator closed the challenge to further joins and submissions.
    event ChallengeClosed(uint64 indexed id);
    /// @notice The creator cancelled a challenge without any approvals.
    event ChallengeCancelled(uint64 indexed id);

    /// @notice Bind immutable identity and proof ledgers.
    constructor(IOrvexIdentity identity_, IOrvexProof proof_) {
        if (address(identity_) == address(0) || address(proof_) == address(0)) revert ZeroAddress();
        identity = identity_;
        proof = proof_;
    }

    /// @notice Create a challenge; rewardNote is descriptive text and never a payment promise.
    function createChallenge(string calldata title, string calldata description, string calldata skill, string calldata rewardNote, uint40 deadline, uint32 maxParticipants)
        external nonReentrant returns (uint64 id)
    {
        OrvexText.requireLen(title, MIN_TITLE, MAX_TITLE);
        OrvexText.requireLen(description, MIN_DESCRIPTION, MAX_DESCRIPTION);
        OrvexText.requireLen(skill, MIN_SKILL, MAX_SKILL);
        OrvexText.requireLen(rewardNote, MIN_REWARD_NOTE, MAX_REWARD_NOTE);
        if (deadline < block.timestamp + MIN_DURATION || deadline > block.timestamp + MAX_DURATION) {
            revert InvalidDeadline(deadline, block.timestamp + MIN_DURATION, block.timestamp + MAX_DURATION);
        }
        if (maxParticipants < MIN_PARTICIPANTS || maxParticipants > MAX_PARTICIPANTS) revert InvalidCapacity();
        id = ++_count;
        {
            Challenge storage c = _challenges[id];
            c.id = id;
            c.creator = msg.sender;
            c.createdAt = uint40(block.timestamp);
            c.deadline = deadline;
            c.maxParticipants = maxParticipants;
            c.title = title;
            c.description = description;
            c.skill = skill;
            c.rewardNote = rewardNote;
        }
        _createdIds[msg.sender].push(id);
        emit ChallengeCreated(id, msg.sender, deadline, maxParticipants, title);
        identity.record(msg.sender, ActivityKind.ChallengeCreated, "");
    }

    /// @notice Join an open unexpired challenge once, subject to capacity.
    function joinChallenge(uint64 id) external nonReentrant {
        Challenge storage c = _get(id);
        if (msg.sender == c.creator) revert CreatorCannotJoin();
        _requireOpen(c);
        if (_removed[id][msg.sender]) revert RemovedByCreator();
        if (_joined[id][msg.sender]) revert AlreadyJoined();
        if (c.participants >= c.maxParticipants) revert ChallengeFull();
        _joined[id][msg.sender] = true;
        ++c.participants;
        _participants[id].push(msg.sender);
        _participantIndex[id][msg.sender] = _participants[id].length;
        _joinedIds[msg.sender].push(id);
        emit ChallengeJoined(id, msg.sender);
        identity.record(msg.sender, ActivityKind.ChallengeJoined, "");
    }

    /// @notice Let the creator free a slot by permanently removing a participant who has no pending or approved work.
    /// @dev Rejected submissions stay readable as history but no longer reserve capacity, so placeholder submissions
    /// cannot be used to squat slots. Allowed after closure or expiry, but not cancellation.
    /// Uses swap-and-pop; participant order may change.
    /// @param id The challenge identifier.
    /// @param participant The current participant to remove and permanently ban from rejoining.
    function removeParticipant(uint64 id, address participant) external {
        Challenge storage c = _get(id);
        if (msg.sender != c.creator) revert NotCreator();
        if (c.status == Status.Cancelled) revert ChallengeIsCancelled();
        if (!_joined[id][participant]) revert NotParticipant();
        SubmissionStatus current = _submissions[id][participant].status;
        if (current == SubmissionStatus.Pending || current == SubmissionStatus.Approved) revert ParticipantHasSubmitted();
        _joined[id][participant] = false;
        _removed[id][participant] = true;
        --c.participants;
        uint256 index = _participantIndex[id][participant] - 1;
        uint256 lastIndex = _participants[id].length - 1;
        if (index != lastIndex) {
            address lastParticipant = _participants[id][lastIndex];
            _participants[id][index] = lastParticipant;
            _participantIndex[id][lastParticipant] = index + 1;
        }
        _participants[id].pop();
        delete _participantIndex[id][participant];
        // _joinedIds[participant] intentionally retains the stale id as join history.
        emit ParticipantRemoved(id, participant, msg.sender);
    }

    /// @notice Submit work before the deadline, with at most three attempts after rejections.
    function submitWork(uint64 id, string calldata uri, string calldata note) external {
        Challenge storage c = _get(id);
        _requireOpen(c);
        if (!_joined[id][msg.sender]) revert NotParticipant();
        OrvexText.requireLen(uri, MIN_URI, MAX_URI);
        OrvexText.requireLink(uri, MAX_URI);
        OrvexText.requireLen(note, MIN_NOTE, MAX_NOTE);
        Submission storage s = _submissions[id][msg.sender];
        if (s.status != SubmissionStatus.None && s.status != SubmissionStatus.Rejected) revert InvalidSubmissionStatus();
        if (s.attempts >= MAX_ATTEMPTS) revert TooManyAttempts();
        if (s.attempts == 0) ++c.submissions;
        ++s.attempts;
        s.status = SubmissionStatus.Pending;
        ++_pendingCount[id];
        s.submittedAt = uint40(block.timestamp);
        s.reviewedAt = 0;
        s.uri = uri;
        s.note = note;
        emit WorkSubmitted(id, msg.sender, s.attempts);
    }

    /// @notice Review pending work, including after closure or expiry; approvals record proof and reputation atomically.
    function reviewSubmission(uint64 id, address participant, bool approve) external nonReentrant {
        Challenge storage c = _get(id);
        if (msg.sender != c.creator) revert NotCreator();
        if (c.status == Status.Cancelled) revert ChallengeIsCancelled();
        Submission storage s = _submissions[id][participant];
        if (s.status != SubmissionStatus.Pending) revert SubmissionNotPending();
        s.reviewedAt = uint40(block.timestamp);
        s.status = approve ? SubmissionStatus.Approved : SubmissionStatus.Rejected;
        --_pendingCount[id];
        if (approve) ++c.approved;
        emit SubmissionReviewed(id, participant, msg.sender, approve);
        if (approve) {
            proof.record(participant, c.creator, IOrvexProof.Source.Challenge, id, c.title, s.uri);
            identity.record(participant, ActivityKind.ChallengeCompleted, c.skill);
        }
    }

    /// @notice Close an open challenge without preventing later reviews.
    function closeChallenge(uint64 id) external {
        Challenge storage c = _get(id);
        if (msg.sender != c.creator) revert NotCreator();
        if (c.status != Status.Open) revert ChallengeNotOpen();
        c.status = Status.Closed;
        emit ChallengeClosed(id);
    }

    /// @notice Cancel an open or closed challenge only if it has no approvals.
    function cancelChallenge(uint64 id) external {
        Challenge storage c = _get(id);
        if (msg.sender != c.creator) revert NotCreator();
        if (c.status == Status.Cancelled) revert ChallengeIsCancelled();
        if (c.approved != 0) revert HasApprovedSubmissions();
        if (_pendingCount[id] != 0) revert HasPendingSubmissions();
        c.status = Status.Cancelled;
        emit ChallengeCancelled(id);
    }

    /// @notice Total challenges created.
    function challengeCount() external view returns (uint64) { return _count; }

    /// @notice Read the number of submissions awaiting review for an existing challenge.
    /// @dev Reverts with UnknownChallenge if the identifier does not exist.
    /// @param id The challenge identifier.
    /// @return The number of pending submissions.
    function pendingCount(uint64 id) external view returns (uint32) {
        _get(id);
        return _pendingCount[id];
    }

    /// @notice Read an existing challenge.
    function getChallenge(uint64 id) external view returns (Challenge memory) { return _get(id); }

    /// @notice List challenges in insertion order, clamped to MAX_PAGE.
    function listChallenges(uint256 offset, uint256 limit) external view returns (Challenge[] memory items) {
        uint256 n = _page(_count, offset, limit);
        items = new Challenge[](n);
        for (uint256 i; i < n; ++i) items[i] = _challenges[uint64(offset + i + 1)];
    }

    /// @notice Return Open=0, Closed=1, Cancelled=2, or Expired=3 at or after the deadline.
    function effectiveStatus(uint64 id) external view returns (uint8) {
        Challenge storage c = _get(id);
        if (c.status == Status.Open && block.timestamp >= c.deadline) return 3;
        return uint8(c.status);
    }

    /// @notice Read a participant's submission, or its empty None state.
    function getSubmission(uint64 id, address participant) external view returns (Submission memory) {
        _get(id);
        return _submissions[id][participant];
    }

    /// @notice Whether a user joined an existing challenge.
    function isParticipant(uint64 id, address participant) external view returns (bool) {
        _get(id);
        return _joined[id][participant];
    }

    /// @notice List challenge participants, clamped to MAX_PAGE.
    function listParticipants(uint64 id, uint256 offset, uint256 limit) external view returns (address[] memory users) {
        _get(id);
        uint256 n = _page(_participants[id].length, offset, limit);
        users = new address[](n);
        for (uint256 i; i < n; ++i) users[i] = _participants[id][offset + i];
    }

    /// @notice List a user's created challenge identifiers, clamped to MAX_PAGE.
    function listCreatedIds(address user, uint256 offset, uint256 limit) external view returns (uint64[] memory) {
        return _listIds(_createdIds[user], offset, limit);
    }

    /// @notice List a user's joined challenge identifiers, clamped to MAX_PAGE.
    function listJoinedIds(address user, uint256 offset, uint256 limit) external view returns (uint64[] memory) {
        return _listIds(_joinedIds[user], offset, limit);
    }

    /// @notice Number of challenges created by a user.
    function createdCount(address user) external view returns (uint256) { return _createdIds[user].length; }

    /// @notice Number of challenges joined by a user.
    function joinedCount(address user) external view returns (uint256) { return _joinedIds[user].length; }

    function _get(uint64 id) private view returns (Challenge storage c) {
        if (id == 0 || id > _count) revert UnknownChallenge();
        return _challenges[id];
    }

    function _requireOpen(Challenge storage c) private view {
        if (c.status != Status.Open || block.timestamp >= c.deadline) revert ChallengeNotOpen();
    }

    function _listIds(uint64[] storage source, uint256 offset, uint256 limit) private view returns (uint64[] memory ids) {
        uint256 n = _page(source.length, offset, limit);
        ids = new uint64[](n);
        for (uint256 i; i < n; ++i) ids[i] = source[offset + i];
    }

    function _page(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256) {
        if (offset >= total) return 0;
        uint256 n = limit > MAX_PAGE ? MAX_PAGE : limit;
        return n > total - offset ? total - offset : n;
    }
}
