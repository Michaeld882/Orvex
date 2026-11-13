// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IOrvexIdentity, ActivityKind} from "./interfaces/IOrvex.sol";
import {OrvexText} from "./libraries/OrvexText.sol";

/// @notice Public innovation board with rate-limited ideas and irreversible peer endorsements; no admin.
contract OrvexIdeas {
    struct Idea {
        uint64 id;
        address author;
        uint40 createdAt;
        uint32 endorsements;
        bool retracted;
        string title;
        string body;
        string tag;
    }
    uint256 public constant MAX_PAGE = 50;
    uint256 public constant MIN_TITLE = 3;
    uint256 public constant MAX_TITLE = 80;
    uint256 public constant MIN_BODY = 10;
    uint256 public constant MAX_BODY = 600;
    uint256 public constant MIN_TAG = 1;
    uint256 public constant MAX_TAG = 24;
    uint256 public constant POST_COOLDOWN = 10 minutes;
    IOrvexIdentity public immutable identity;
    uint64 private _count;
    mapping(uint64 => Idea) private _ideas;
    mapping(uint64 => mapping(address => bool)) private _endorsed;
    mapping(address => uint64[]) private _authoredIds;
    mapping(address => uint256) private _nextPostAt;

    /// @notice The identity address must be nonzero.
    error ZeroAddress();
    /// @notice The idea identifier does not exist.
    error UnknownIdea();
    /// @notice The caller must wait until their posting cooldown expires.
    error CooldownActive();
    /// @notice Authors cannot endorse their own ideas.
    error AuthorCannotEndorse();
    /// @notice A retracted idea cannot be endorsed or retracted again.
    error IdeaIsRetracted();
    /// @notice This address has already endorsed this idea.
    error AlreadyEndorsed();
    /// @notice Only the author may retract an idea.
    error NotAuthor();
    /// @notice A new idea was posted.
    event IdeaPosted(uint64 indexed id, address indexed author, string title);
    /// @notice A peer endorsed an idea and credited its author.
    event IdeaEndorsed(uint64 indexed id, address indexed endorser, address indexed author);
    /// @notice An author retracted an idea without deleting its data.
    event IdeaRetracted(uint64 indexed id);

    /// @notice Bind the immutable identity ledger.
    constructor(IOrvexIdentity identity_) {
        if (address(identity_) == address(0)) revert ZeroAddress();
        identity = identity_;
    }

    /// @notice Post an idea at most once per cooldown; the first post is immediately permitted.
    function postIdea(string calldata title, string calldata body, string calldata tag) external returns (uint64 id) {
        if (block.timestamp < _nextPostAt[msg.sender]) revert CooldownActive();
        OrvexText.requireLen(title, MIN_TITLE, MAX_TITLE);
        OrvexText.requireLen(body, MIN_BODY, MAX_BODY);
        OrvexText.requireLen(tag, MIN_TAG, MAX_TAG);
        id = ++_count;
        _ideas[id] = Idea(id, msg.sender, uint40(block.timestamp), 0, false, title, body, tag);
        _authoredIds[msg.sender].push(id);
        _nextPostAt[msg.sender] = block.timestamp + POST_COOLDOWN;
        emit IdeaPosted(id, msg.sender, title);
        identity.record(msg.sender, ActivityKind.IdeaPosted, "");
    }

    /// @notice Endorse another user's nonretracted idea once, recording a zero-point author activity.
    function endorse(uint64 id) external {
        Idea storage idea = _get(id);
        if (msg.sender == idea.author) revert AuthorCannotEndorse();
        if (idea.retracted) revert IdeaIsRetracted();
        if (_endorsed[id][msg.sender]) revert AlreadyEndorsed();
        _endorsed[id][msg.sender] = true;
        ++idea.endorsements;
        emit IdeaEndorsed(id, msg.sender, idea.author);
        identity.record(idea.author, ActivityKind.EndorsementReceived, "");
    }

    /// @notice Retract only the caller's own idea; stored text and endorsements remain readable.
    function retractIdea(uint64 id) external {
        Idea storage idea = _get(id);
        if (msg.sender != idea.author) revert NotAuthor();
        if (idea.retracted) revert IdeaIsRetracted();
        idea.retracted = true;
        emit IdeaRetracted(id);
    }

    /// @notice Total ideas ever posted, including retracted ideas.
    function ideaCount() external view returns (uint64) { return _count; }

    /// @notice Read an existing idea, including retracted ideas.
    function getIdea(uint64 id) external view returns (Idea memory) { return _get(id); }

    /// @notice List all ideas in insertion order, clamped to MAX_PAGE; clients may hide retracted entries.
    function listIdeas(uint256 offset, uint256 limit) external view returns (Idea[] memory items) {
        uint256 n = _page(_count, offset, limit);
        items = new Idea[](n);
        for (uint256 i; i < n; ++i) items[i] = _ideas[uint64(offset + i + 1)];
    }

    /// @notice Whether a user has endorsed an existing idea.
    function hasEndorsed(uint64 id, address user) external view returns (bool) {
        _get(id);
        return _endorsed[id][user];
    }

    /// @notice List an author's idea identifiers, clamped to MAX_PAGE.
    function listAuthoredIds(address user, uint256 offset, uint256 limit) external view returns (uint64[] memory ids) {
        uint256 n = _page(_authoredIds[user].length, offset, limit);
        ids = new uint64[](n);
        for (uint256 i; i < n; ++i) ids[i] = _authoredIds[user][offset + i];
    }

    function _get(uint64 id) private view returns (Idea storage idea) {
        if (id == 0 || id > _count) revert UnknownIdea();
        return _ideas[id];
    }

    function _page(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256) {
        if (offset >= total) return 0;
        uint256 n = limit > MAX_PAGE ? MAX_PAGE : limit;
        return n > total - offset ? total - offset : n;
    }
}
