// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Reputation activity categories; ordering is part of the public ABI.
enum ActivityKind { ChallengeCreated, ChallengeJoined, ChallengeCompleted, ProjectProposed, ContributionAccepted, IdeaPosted, EndorsementReceived }

/// @notice Public identity and reputation ledger used by ORVEX modules.
interface IOrvexIdentity {
    struct Profile {
        string displayName;
        string bio;
        string skillsNote;
        string link;
        uint40 updatedAt;
        bool exists;
    }
    struct Stats {
        uint32 points;
        uint32 challengesCreated;
        uint32 challengesJoined;
        uint32 challengesCompleted;
        uint32 projectsProposed;
        uint32 contributionsAccepted;
        uint32 ideasPosted;
        uint32 endorsementsReceived;
    }
    /// @notice Record an activity; callable only by an authorized recorder.
    function record(address user, ActivityKind kind, string calldata skill) external;
    /// @notice Read a user's counters and points.
    function statsOf(address user) external view returns (Stats memory);
    /// @notice Read a user's public profile.
    function getProfile(address user) external view returns (Profile memory);
}

/// @notice Immutable proof recording interface shared by peer-review modules.
interface IOrvexProof {
    enum Source { Challenge, Project }
    struct Contribution {
        uint64 id;
        address contributor;
        address attestor;
        Source source;
        uint64 sourceId;
        uint40 recordedAt;
        string title;
        string uri;
        bytes32 digest;
    }
    /// @notice Append an immutable peer-attested contribution.
    function record(address contributor, address attestor, Source source, uint64 sourceId, string calldata title, string calldata uri) external returns (uint64 id);
}
