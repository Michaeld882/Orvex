// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOrvexIdentity, IOrvexProof, ActivityKind} from "./interfaces/IOrvex.sol";
import {OrvexText} from "./libraries/OrvexText.sol";

/// @notice Owner-managed projects and peer-reviewed contributions; no administrator or value handling.
contract OrvexLaunchpad is ReentrancyGuard {
    enum Stage { Idea, Building, Beta, Live, Paused, Archived }
    enum ReviewStatus { Pending, Accepted, Rejected, Withdrawn }
    struct Project {
        uint64 id;
        address owner;
        Stage stage;
        uint40 createdAt;
        uint40 updatedAt;
        uint32 contributions;
        uint32 accepted;
        uint32 updates;
        string name;
        string tagline;
        string description;
        string category;
        string link;
    }
    struct ProjectUpdate { uint40 at; Stage stage; string text; }
    struct Contribution {
        uint64 id;
        uint64 projectId;
        address contributor;
        ReviewStatus status;
        uint40 submittedAt;
        uint40 reviewedAt;
        string title;
        string uri;
    }
    uint256 public constant MAX_PAGE = 50;
    uint256 public constant MIN_NAME = 3;
    uint256 public constant MAX_NAME = 48;
    uint256 public constant MIN_TAGLINE = 5;
    uint256 public constant MAX_TAGLINE = 100;
    uint256 public constant MIN_DESCRIPTION = 10;
    uint256 public constant MAX_DESCRIPTION = 1000;
    uint256 public constant MIN_CATEGORY = 1;
    uint256 public constant MAX_CATEGORY = 24;
    uint256 public constant MIN_LINK = 0;
    uint256 public constant MAX_LINK = 200;
    uint256 public constant MIN_UPDATE_TEXT = 3;
    uint256 public constant MAX_UPDATE_TEXT = 280;
    uint256 public constant MIN_TITLE = 3;
    uint256 public constant MAX_TITLE = 80;
    uint256 public constant MIN_URI = 1;
    uint256 public constant MAX_URI = 200;
    uint32 public constant MAX_UPDATES = 100;
    uint32 public constant MAX_PENDING = 1;
    IOrvexIdentity public immutable identity;
    IOrvexProof public immutable proof;
    uint64 private _projectCount;
    uint64 private _contributionCount;
    mapping(uint64 => Project) private _projects;
    mapping(uint64 => Contribution) private _contributions;
    mapping(uint64 => ProjectUpdate[]) private _updates;
    mapping(uint64 => uint64[]) private _projectContributionIds;
    mapping(uint64 => mapping(address => uint32)) private _pending;
    mapping(address => uint64[]) private _ownedIds;

    /// @notice A sibling address must be nonzero.
    error ZeroAddress();
    /// @notice The project identifier does not exist.
    error UnknownProject();
    /// @notice The contribution identifier does not exist.
    error UnknownContribution();
    /// @notice Only the project's owner may perform this action.
    error NotProjectOwner();
    /// @notice An archived project cannot change stage, post updates, or accept new submissions.
    error ProjectArchived();
    /// @notice The project has reached its update cap.
    error TooManyUpdates();
    /// @notice Project owners cannot contribute to their own project.
    error OwnerCannotContribute();
    /// @notice This contributor already has the maximum pending contributions for this project.
    error TooManyPending();
    /// @notice Only pending contributions can be reviewed.
    error ContributionNotPending();
    /// @notice Only the contribution's contributor may withdraw it.
    error NotContributor();
    /// @notice A new project was proposed.
    event ProjectProposed(uint64 indexed id, address indexed owner, string name);
    /// @notice A project's stage was set.
    event StageChanged(uint64 indexed id, Stage stage);
    /// @notice A project update was appended at the zero-based index.
    event ProjectUpdated(uint64 indexed id, uint32 index);
    /// @notice A contributor submitted work to a project.
    event ContributionSubmitted(uint64 indexed contributionId, uint64 indexed projectId, address indexed contributor);
    /// @notice The owner reviewed a pending contribution.
    event ContributionReviewed(uint64 indexed contributionId, uint64 indexed projectId, address indexed reviewer, bool accepted);
    /// @notice A contributor withdrew pending work and released their pending slot.
    /// @param id The withdrawn contribution identifier.
    /// @param projectId The project identifier.
    /// @param contributor The contributor who withdrew the work.
    event ContributionWithdrawn(uint64 indexed id, uint64 indexed projectId, address indexed contributor);

    /// @notice Bind immutable identity and proof ledgers.
    constructor(IOrvexIdentity identity_, IOrvexProof proof_) {
        if (address(identity_) == address(0) || address(proof_) == address(0)) revert ZeroAddress();
        identity = identity_;
        proof = proof_;
    }

    /// @notice Propose a project in the Idea stage and record the proposal in the identity ledger.
    function proposeProject(string calldata name, string calldata tagline, string calldata description, string calldata category, string calldata link)
        external nonReentrant returns (uint64 id)
    {
        OrvexText.requireLen(name, MIN_NAME, MAX_NAME);
        OrvexText.requireLen(tagline, MIN_TAGLINE, MAX_TAGLINE);
        OrvexText.requireLen(description, MIN_DESCRIPTION, MAX_DESCRIPTION);
        OrvexText.requireLen(category, MIN_CATEGORY, MAX_CATEGORY);
        OrvexText.requireLen(link, MIN_LINK, MAX_LINK);
        if (!OrvexText.isEmpty(link)) OrvexText.requireLink(link, MAX_LINK);
        id = ++_projectCount;
        Project storage p = _projects[id];
        p.id = id;
        p.owner = msg.sender;
        p.createdAt = uint40(block.timestamp);
        p.updatedAt = uint40(block.timestamp);
        p.name = name;
        p.tagline = tagline;
        p.description = description;
        p.category = category;
        p.link = link;
        _ownedIds[msg.sender].push(id);
        emit ProjectProposed(id, msg.sender, name);
        identity.record(msg.sender, ActivityKind.ProjectProposed, "");
    }

    /// @notice Set a project's stage; Archived is terminal.
    function setStage(uint64 id, Stage stage) external {
        Project storage p = _getProject(id);
        _requireOwner(p);
        _requireActive(p);
        p.stage = stage;
        p.updatedAt = uint40(block.timestamp);
        emit StageChanged(id, stage);
    }

    /// @notice Append a bounded public update, capturing the current project stage.
    function postUpdate(uint64 id, string calldata text) external {
        Project storage p = _getProject(id);
        _requireOwner(p);
        _requireActive(p);
        if (p.updates >= MAX_UPDATES) revert TooManyUpdates();
        OrvexText.requireLen(text, MIN_UPDATE_TEXT, MAX_UPDATE_TEXT);
        uint32 index = p.updates++;
        p.updatedAt = uint40(block.timestamp);
        _updates[id].push(ProjectUpdate(uint40(block.timestamp), p.stage, text));
        emit ProjectUpdated(id, index);
    }

    /// @notice Submit work to a nonarchived project, including paused projects; only one pending per contributor.
    function submitContribution(uint64 projectId, string calldata title, string calldata uri) external returns (uint64 id) {
        Project storage p = _getProject(projectId);
        if (msg.sender == p.owner) revert OwnerCannotContribute();
        _requireActive(p);
        if (_pending[projectId][msg.sender] >= MAX_PENDING) revert TooManyPending();
        OrvexText.requireLen(title, MIN_TITLE, MAX_TITLE);
        OrvexText.requireLen(uri, MIN_URI, MAX_URI);
        OrvexText.requireLink(uri, MAX_URI);
        id = ++_contributionCount;
        _contributions[id] = Contribution(id, projectId, msg.sender, ReviewStatus.Pending, uint40(block.timestamp), 0, title, uri);
        ++_pending[projectId][msg.sender];
        ++p.contributions;
        p.updatedAt = uint40(block.timestamp);
        _projectContributionIds[projectId].push(id);
        emit ContributionSubmitted(id, projectId, msg.sender);
    }

    /// @notice Review pending work even after archival; accepted work records proof and reputation atomically.
    function reviewContribution(uint64 contributionId, bool accept) external nonReentrant {
        Contribution storage c = _getContribution(contributionId);
        Project storage p = _projects[c.projectId];
        _requireOwner(p);
        if (c.status != ReviewStatus.Pending) revert ContributionNotPending();
        c.status = accept ? ReviewStatus.Accepted : ReviewStatus.Rejected;
        c.reviewedAt = uint40(block.timestamp);
        --_pending[c.projectId][c.contributor];
        if (accept) ++p.accepted;
        p.updatedAt = uint40(block.timestamp);
        emit ContributionReviewed(contributionId, c.projectId, msg.sender, accept);
        if (accept) {
            proof.record(c.contributor, p.owner, IOrvexProof.Source.Project, c.projectId, c.title, c.uri);
            identity.record(c.contributor, ActivityKind.ContributionAccepted, p.category);
        }
    }

    /// @notice Withdraw your pending contribution and release its pending slot, regardless of project stage.
    /// @dev Works while Archived or Paused; only status, reviewedAt, and the pending count change.
    /// No proof or reputation is awarded. Unknown identifiers revert with UnknownContribution.
    /// @param contributionId The identifier of your pending contribution to withdraw.
    function withdrawContribution(uint64 contributionId) external {
        Contribution storage c = _getContribution(contributionId);
        if (msg.sender != c.contributor) revert NotContributor();
        if (c.status != ReviewStatus.Pending) revert ContributionNotPending();
        c.status = ReviewStatus.Withdrawn;
        c.reviewedAt = uint40(block.timestamp);
        --_pending[c.projectId][c.contributor];
        emit ContributionWithdrawn(contributionId, c.projectId, c.contributor);
    }

    /// @notice Total proposed projects.
    function projectCount() external view returns (uint64) { return _projectCount; }

    /// @notice Read an existing project.
    function getProject(uint64 id) external view returns (Project memory) { return _getProject(id); }

    /// @notice List projects in insertion order, clamped to MAX_PAGE.
    function listProjects(uint256 offset, uint256 limit) external view returns (Project[] memory items) {
        uint256 n = _page(_projectCount, offset, limit);
        items = new Project[](n);
        for (uint256 i; i < n; ++i) items[i] = _projects[uint64(offset + i + 1)];
    }

    /// @notice Read a submitted contribution, including its current review status.
    function getContribution(uint64 id) external view returns (Contribution memory) { return _getContribution(id); }

    /// @notice List a project's global contribution identifiers, clamped to MAX_PAGE.
    function listProjectContributionIds(uint64 projectId, uint256 offset, uint256 limit) external view returns (uint64[] memory) {
        _getProject(projectId);
        return _listIds(_projectContributionIds[projectId], offset, limit);
    }

    /// @notice Total submitted project contributions.
    function contributionCount() external view returns (uint64) { return _contributionCount; }

    /// @notice List a project's updates in insertion order, clamped to MAX_PAGE.
    function listUpdates(uint64 projectId, uint256 offset, uint256 limit) external view returns (ProjectUpdate[] memory items) {
        _getProject(projectId);
        uint256 n = _page(_updates[projectId].length, offset, limit);
        items = new ProjectUpdate[](n);
        for (uint256 i; i < n; ++i) items[i] = _updates[projectId][offset + i];
    }

    /// @notice List a user's owned project identifiers, clamped to MAX_PAGE.
    function listOwnedIds(address user, uint256 offset, uint256 limit) external view returns (uint64[] memory) {
        return _listIds(_ownedIds[user], offset, limit);
    }

    /// @notice Number of projects owned by a user.
    function ownedCount(address user) external view returns (uint256) { return _ownedIds[user].length; }

    function _getProject(uint64 id) private view returns (Project storage p) {
        if (id == 0 || id > _projectCount) revert UnknownProject();
        return _projects[id];
    }

    function _getContribution(uint64 id) private view returns (Contribution storage c) {
        if (id == 0 || id > _contributionCount) revert UnknownContribution();
        return _contributions[id];
    }

    function _requireOwner(Project storage p) private view {
        if (msg.sender != p.owner) revert NotProjectOwner();
    }

    function _requireActive(Project storage p) private view {
        if (p.stage == Stage.Archived) revert ProjectArchived();
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
