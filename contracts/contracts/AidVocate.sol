// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IVerifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[1] calldata _pubSignals
    ) external view returns (bool);
}

contract AidVocate is Ownable {
    IVerifier public immutable verifier;

    mapping(uint256 => bytes32) public merkleRoots;
    uint256 public batchCount;

    event MerkleRootStored(uint256 indexed batchId, bytes32 root, uint256 timestamp);
    event DonationVerified(uint256 indexed batchId, bool valid, uint256 timestamp);

    constructor(address _verifier) Ownable(msg.sender) {
        verifier = IVerifier(_verifier);
    }

    function storeMerkleRoot(bytes32 _root) external onlyOwner returns (uint256) {
        uint256 batchId = batchCount;
        merkleRoots[batchId] = _root;
        batchCount++;
        emit MerkleRootStored(batchId, _root, block.timestamp);
        return batchId;
    }

    function getMerkleRoot(uint256 _batchId) external view returns (bytes32) {
        return merkleRoots[_batchId];
    }

    function verifyDonation(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[1] calldata _pubSignals,
        uint256 _batchId
    ) external returns (bool) {
        bytes32 storedRoot = merkleRoots[_batchId];
        require(storedRoot != bytes32(0), "Batch does not exist");
        require(bytes32(_pubSignals[0]) == storedRoot, "Public signal does not match stored root");

        bool valid = verifier.verifyProof(_pA, _pB, _pC, _pubSignals);
        emit DonationVerified(_batchId, valid, block.timestamp);
        return valid;
    }
}
