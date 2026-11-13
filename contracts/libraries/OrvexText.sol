// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Byte-length and link validation shared by ORVEX contracts.
library OrvexText {
    /// @notice A string's byte length is outside the inclusive permitted range.
    error InvalidLength(uint256 actual, uint256 min, uint256 max);
    /// @notice A link does not start with https:// or ipfs://.
    error InvalidLink();

    /// @notice Require an inclusive byte-length range, not a Unicode character range.
    function requireLen(string memory text, uint256 min, uint256 max) internal pure {
        uint256 length = bytes(text).length;
        if (length < min || length > max) revert InvalidLength(length, min, max);
    }

    /// @notice Require a nonempty bounded link beginning with an allowed scheme.
    function requireLink(string memory text, uint256 maxLen) internal pure {
        requireLen(text, 1, maxLen);
        bytes memory value = bytes(text);
        bytes memory https = bytes("https://");
        bytes memory ipfs = bytes("ipfs://");
        bool matchesHttps = value.length >= https.length;
        bool matchesIpfs = value.length >= ipfs.length;
        for (uint256 i; i < https.length && matchesHttps; ++i) {
            if (value[i] != https[i]) matchesHttps = false;
        }
        for (uint256 i; i < ipfs.length && matchesIpfs; ++i) {
            if (value[i] != ipfs[i]) matchesIpfs = false;
        }
        if (!matchesHttps && !matchesIpfs) revert InvalidLink();
    }

    /// @notice Whether the string contains zero bytes.
    function isEmpty(string memory text) internal pure returns (bool) {
        return bytes(text).length == 0;
    }
}
