// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IOrvexIdentity, ActivityKind} from "./interfaces/IOrvex.sol";
import {OrvexText} from "./libraries/OrvexText.sol";

/// @notice Public profiles and saturating peer-validated reputation; recorder wiring freezes forever.
contract OrvexIdentity is Ownable2Step, IOrvexIdentity {
    uint256 public constant MAX_PAGE = 50;
    uint256 public constant MIN_DISPLAY_NAME = 1;
    uint256 public constant MAX_DISPLAY_NAME = 32;
    uint256 public constant MIN_BIO = 0;
    uint256 public constant MAX_BIO = 280;
    uint256 public constant MIN_SKILLS_NOTE = 0;
    uint256 public constant MAX_SKILLS_NOTE = 120;
    uint256 public constant MIN_LINK = 0;
    uint256 public constant MAX_LINK = 200;
    uint256 public constant MIN_SKILL = 1;
    uint256 public constant MAX_SKILL = 24;
    uint256 public constant MAX_SKILLS = 32;
    uint32 public constant POINTS_CHALLENGE_COMPLETED = 20;
    uint32 public constant POINTS_CONTRIBUTION_ACCEPTED = 15;

    /// @notice An address must be nonzero.
    error ZeroAddress();
    /// @notice Caller is not an authorized recorder.
    error NotRecorder();
    /// @notice The recorder configuration is permanently frozen.
    error RecorderConfigurationFinalized();
    /// @notice Ownership cannot be renounced before the recorder allowlist is frozen.
    error RecorderConfigurationNotFinalized();
    /// @notice Emitted when a recorder's authorization is set.
    event RecorderSet(address indexed recorder, bool allowed);
    /// @notice Emitted when recorder configuration becomes immutable.
    event RecordersFinalized();
    /// @notice Emitted when a user replaces their public profile.
    event ProfileUpdated(address indexed user);
    /// @notice Emitted for every reputation activity recorded.
    event ActivityRecorded(address indexed user, ActivityKind indexed kind, uint32 pointsAwarded, uint32 totalPoints);
    /// @notice Emitted when a peer-validated skill counter increases or saturates.
    event SkillVerified(address indexed user, bytes32 indexed skillKey, string skill, uint32 count);

    mapping(address => bool) public isRecorder;
    bool public recordersFinalized;
    uint256 public totalProfiles;
    mapping(address => Profile) private _profiles;
    mapping(address => Stats) private _stats;
    address[] private _participants;
    mapping(address => bool) private _participating;
    mapping(address => string[]) private _skillNames;
    mapping(address => mapping(bytes32 => uint32)) private _skillCounts;

    /// @notice Initialize the two-step owner responsible solely for recorder configuration.
    constructor(address owner) Ownable(owner) {}

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

    /// @notice Freeze the recorder allowlist permanently, including against the owner.
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

    /// @notice Create or replace only the caller's profile with byte-bounded text.
    function setProfile(string calldata displayName, string calldata bio, string calldata skillsNote, string calldata link) external {
        OrvexText.requireLen(displayName, MIN_DISPLAY_NAME, MAX_DISPLAY_NAME);
        OrvexText.requireLen(bio, MIN_BIO, MAX_BIO);
        OrvexText.requireLen(skillsNote, MIN_SKILLS_NOTE, MAX_SKILLS_NOTE);
        OrvexText.requireLen(link, MIN_LINK, MAX_LINK);
        if (!OrvexText.isEmpty(link)) OrvexText.requireLink(link, MAX_LINK);
        if (!_profiles[msg.sender].exists) ++totalProfiles;
        _profiles[msg.sender] = Profile(displayName, bio, skillsNote, link, uint40(block.timestamp), true);
        emit ProfileUpdated(msg.sender);
    }

    /// @inheritdoc IOrvexIdentity
    function getProfile(address user) external view override returns (Profile memory) { return _profiles[user]; }

    /// @inheritdoc IOrvexIdentity
    function statsOf(address user) external view override returns (Stats memory) { return _stats[user]; }

    /// @inheritdoc IOrvexIdentity
    function record(address user, ActivityKind kind, string calldata skill) external override onlyRecorder {
        if (user == address(0)) revert ZeroAddress();
        bool verified = kind == ActivityKind.ChallengeCompleted || kind == ActivityKind.ContributionAccepted;
        if (!OrvexText.isEmpty(skill)) OrvexText.requireLen(skill, MIN_SKILL, MAX_SKILL);
        if (!_participating[user]) {
            _participating[user] = true;
            _participants.push(user);
        }
        Stats storage s = _stats[user];
        uint32 award;
        if (kind == ActivityKind.ChallengeCreated) s.challengesCreated = _add(s.challengesCreated, 1);
        else if (kind == ActivityKind.ChallengeJoined) s.challengesJoined = _add(s.challengesJoined, 1);
        else if (kind == ActivityKind.ChallengeCompleted) {
            s.challengesCompleted = _add(s.challengesCompleted, 1);
            award = POINTS_CHALLENGE_COMPLETED;
        } else if (kind == ActivityKind.ProjectProposed) s.projectsProposed = _add(s.projectsProposed, 1);
        else if (kind == ActivityKind.ContributionAccepted) {
            s.contributionsAccepted = _add(s.contributionsAccepted, 1);
            award = POINTS_CONTRIBUTION_ACCEPTED;
        } else if (kind == ActivityKind.IdeaPosted) s.ideasPosted = _add(s.ideasPosted, 1);
        else if (kind == ActivityKind.EndorsementReceived) s.endorsementsReceived = _add(s.endorsementsReceived, 1);
        s.points = _add(s.points, award);
        emit ActivityRecorded(user, kind, award, s.points);
        if (verified && !OrvexText.isEmpty(skill)) {
            bytes32 key = keccak256(bytes(skill));
            uint32 count = _skillCounts[user][key];
            if (count == 0 && _skillNames[user].length < MAX_SKILLS) _skillNames[user].push(skill);
            count = _add(count, 1);
            _skillCounts[user][key] = count;
            emit SkillVerified(user, key, skill, count);
        }
    }

    /// @notice Return up to MAX_SKILLS exact-byte skill names and their verified counts.
    function getSkills(address user) external view returns (string[] memory names, uint32[] memory counts) {
        names = _skillNames[user];
        counts = new uint32[](names.length);
        for (uint256 i; i < names.length; ++i) counts[i] = _skillCounts[user][keccak256(bytes(names[i]))];
    }

    /// @notice Convert total points to one of five fixed reputation levels.
    function levelOf(uint32 points) public pure returns (uint8) {
        if (points >= 1000) return 5;
        if (points >= 400) return 4;
        if (points >= 150) return 3;
        if (points >= 50) return 2;
        return 1;
    }

    /// @notice Return a user's current level.
    function levelOfUser(address user) external view returns (uint8) { return levelOf(_stats[user].points); }

    /// @notice Number of users with at least one recorded activity.
    function participantCount() external view returns (uint256) { return _participants.length; }

    /// @notice List activity participants in insertion order, clamped to MAX_PAGE.
    function listParticipants(uint256 offset, uint256 limit) external view returns (address[] memory users) {
        uint256 n = _page(_participants.length, offset, limit);
        users = new address[](n);
        for (uint256 i; i < n; ++i) users[i] = _participants[offset + i];
    }

    /// @notice Return aligned participant addresses and statistics, clamped to MAX_PAGE.
    function listParticipantStats(uint256 offset, uint256 limit) external view returns (address[] memory users, Stats[] memory stats) {
        uint256 n = _page(_participants.length, offset, limit);
        users = new address[](n);
        stats = new Stats[](n);
        for (uint256 i; i < n; ++i) {
            users[i] = _participants[offset + i];
            stats[i] = _stats[users[i]];
        }
    }

    function _add(uint32 value, uint32 amount) private pure returns (uint32) {
        uint256 sum = uint256(value) + amount;
        return sum > type(uint32).max ? type(uint32).max : uint32(sum);
    }

    function _page(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256) {
        if (offset >= total) return 0;
        uint256 n = limit > MAX_PAGE ? MAX_PAGE : limit;
        return n > total - offset ? total - offset : n;
    }
}
