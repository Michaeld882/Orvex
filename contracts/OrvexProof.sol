// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IOrvexIdentity, IOrvexProof} from "./interfaces/IOrvex.sol";
import {OrvexText} from "./libraries/OrvexText.sol";

/// @notice Append-only peer-attested contributions and six non-transferable achievement claims.
contract OrvexProof is Ownable2Step, IOrvexProof {
    uint256 public constant MAX_PAGE = 50;
    uint256 public constant MIN_TITLE = 1;
    uint256 public constant MAX_TITLE = 80;
    uint256 public constant MIN_URI = 1;
    uint256 public constant MAX_URI = 200;
    uint8 public constant ACHIEVEMENT_COUNT = 6;
    IOrvexIdentity public immutable identity;
    mapping(address => bool) public isRecorder;
    bool public recordersFinalized;
    mapping(address => uint256) public achievementMask;
    uint64 private _count;
    mapping(uint64 => Contribution) private _records;
    mapping(address => uint64[]) private _userIds;

    /// @notice An address must be nonzero.
    error ZeroAddress();
    /// @notice Source identifiers start at one.
    error InvalidSourceId();
    /// @notice Caller is not an authorized recorder.
    error NotRecorder();
    /// @notice Recorder configuration is permanently frozen.
    error RecorderConfigurationFinalized();
    /// @notice Ownership cannot be renounced before the recorder allowlist is frozen.
    error RecorderConfigurationNotFinalized();
    /// @notice The contribution identifier does not exist.
    error UnknownRecord();
    /// @notice The achievement identifier is not one of the six fixed achievements.
    error UnknownAchievement();
    /// @notice The caller does not satisfy the achievement criteria.
    error NotEligible();
    /// @notice The caller has already claimed this achievement.
    error AlreadyClaimed();
    /// @notice Recorder authorization was configured.
    event RecorderSet(address indexed recorder, bool allowed);
    /// @notice Recorder configuration was frozen permanently.
    event RecordersFinalized();
    /// @notice An immutable contribution was recorded with its domain-separated digest.
    event ContributionRecorded(uint64 indexed id, address indexed contributor, address indexed attestor, Source source, uint64 sourceId, bytes32 digest);
    /// @notice A user claimed a non-transferable achievement.
    event AchievementClaimed(address indexed user, uint8 indexed id);

    /// @notice Initialize ownership and the immutable identity ledger.
    constructor(address owner, IOrvexIdentity identity_) Ownable(owner) {
        if (address(identity_) == address(0)) revert ZeroAddress();
        identity = identity_;
    }

    modifier onlyRecorder() {
        if (!isRecorder[msg.sender]) revert NotRecorder();
        _;
    }

    /// @notice Configure a recorder before permanent finalization.
    function setRecorder(address recorder, bool allowed) external onlyOwner {
        if (recordersFinalized) revert RecorderConfigurationFinalized();
        if (recorder == address(0)) revert ZeroAddress();
        isRecorder[recorder] = allowed;
        emit RecorderSet(recorder, allowed);
    }

    /// @notice Permanently freeze the recorder allowlist.
    function finalizeRecorders() external onlyOwner {
        if (recordersFinalized) revert RecorderConfigurationFinalized();
        recordersFinalized = true;
        emit RecordersFinalized();
    }

    /// @notice Ownership may only be renounced once the recorder allowlist is frozen, so wiring can never be stranded.
    function renounceOwnership() public override onlyOwner {
        if (!recordersFinalized) revert RecorderConfigurationNotFinalized();
        super.renounceOwnership();
    }

    /// @inheritdoc IOrvexProof
    function record(address contributor, address attestor, Source source, uint64 sourceId, string calldata title, string calldata uri)
        external override onlyRecorder returns (uint64 id)
    {
        if (contributor == address(0) || attestor == address(0)) revert ZeroAddress();
        if (sourceId == 0) revert InvalidSourceId();
        OrvexText.requireLen(title, MIN_TITLE, MAX_TITLE);
        OrvexText.requireLen(uri, MIN_URI, MAX_URI);
        OrvexText.requireLink(uri, MAX_URI);
        id = ++_count;
        bytes32 digest = keccak256(abi.encode(id, contributor, attestor, source, sourceId, title, uri, block.chainid, address(this)));
        _records[id] = Contribution(id, contributor, attestor, source, sourceId, uint40(block.timestamp), title, uri, digest);
        _userIds[contributor].push(id);
        emit ContributionRecorded(id, contributor, attestor, source, sourceId, digest);
    }

    /// @notice Total immutable contribution records.
    function contributionCount() external view returns (uint64) { return _count; }

    /// @notice Read a contribution; identifier zero is invalid.
    function getContribution(uint64 id) public view returns (Contribution memory) {
        if (id == 0 || id > _count) revert UnknownRecord();
        return _records[id];
    }

    /// @notice List contributions in insertion order, clamped to MAX_PAGE.
    function listContributions(uint256 offset, uint256 limit) external view returns (Contribution[] memory records) {
        uint256 n = _page(_count, offset, limit);
        records = new Contribution[](n);
        for (uint256 i; i < n; ++i) records[i] = _records[uint64(offset + i + 1)];
    }

    /// @notice Number of immutable proofs belonging to a user.
    function userContributionCount(address user) public view returns (uint256) { return _userIds[user].length; }

    /// @notice List a user's contribution identifiers, clamped to MAX_PAGE.
    function listUserContributionIds(address user, uint256 offset, uint256 limit) external view returns (uint64[] memory ids) {
        uint256 n = _page(_userIds[user].length, offset, limit);
        ids = new uint64[](n);
        for (uint256 i; i < n; ++i) ids[i] = _userIds[user][offset + i];
    }

    /// @notice Return true only for an existing record with the exact stored digest.
    function verifyRecord(uint64 id, bytes32 digest) external view returns (bool) {
        return id != 0 && id <= _count && _records[id].digest == digest;
    }

    /// @notice Check fixed achievement criteria against proofs and current identity statistics.
    function isEligible(address user, uint8 id) public view returns (bool) {
        if (id >= ACHIEVEMENT_COUNT) revert UnknownAchievement();
        if (id == 0) return userContributionCount(user) >= 1;
        IOrvexIdentity.Stats memory s = identity.statsOf(user);
        if (id == 1) return s.challengesCompleted >= 1;
        if (id == 2) return s.challengesCompleted >= 5;
        if (id == 3) return s.challengesCreated >= 1;
        if (id == 4) return s.projectsProposed >= 1 || s.ideasPosted >= 1;
        return s.points >= 500;
    }

    /// @notice Claim an eligible achievement for the caller only, once forever.
    function claimAchievement(uint8 id) external {
        if (!isEligible(msg.sender, id)) revert NotEligible();
        uint256 bit = uint256(1) << id;
        if (achievementMask[msg.sender] & bit != 0) revert AlreadyClaimed();
        achievementMask[msg.sender] |= bit;
        emit AchievementClaimed(msg.sender, id);
    }

    /// @notice Read all claimed achievement bits.
    function achievementsOf(address user) external view returns (uint256 mask) { return achievementMask[user]; }

    /// @notice Check a claimed achievement, rejecting unknown achievement identifiers.
    function hasAchievement(address user, uint8 id) external view returns (bool) {
        if (id >= ACHIEVEMENT_COUNT) revert UnknownAchievement();
        return achievementMask[user] & (uint256(1) << id) != 0;
    }

    function _page(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256) {
        if (offset >= total) return 0;
        uint256 n = limit > MAX_PAGE ? MAX_PAGE : limit;
        return n > total - offset ? total - offset : n;
    }
}
