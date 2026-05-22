pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template MerkleTreeVerifier(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component hashers[depth];
    signal intermediates[depth + 1];
    signal left[depth];
    signal right[depth];
    intermediates[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // Constrain pathIndices to binary (0 or 1) to prevent forgery
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        hashers[i] = Poseidon(2);

        left[i] <== intermediates[i] + pathIndices[i] * (pathElements[i] - intermediates[i]);
        right[i] <== pathElements[i] + pathIndices[i] * (intermediates[i] - pathElements[i]);

        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        intermediates[i + 1] <== hashers[i].out;
    }

    root <== intermediates[depth];
}

template DonationVerifier(depth) {
    signal input donorId;
    signal input amount;
    signal input ngoId;
    signal input timestamp;
    signal input salt;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input merkleRoot;

    component commitHasher = Poseidon(5);
    commitHasher.inputs[0] <== donorId;
    commitHasher.inputs[1] <== amount;
    commitHasher.inputs[2] <== ngoId;
    commitHasher.inputs[3] <== timestamp;
    commitHasher.inputs[4] <== salt;

    component merkleVerifier = MerkleTreeVerifier(depth);
    merkleVerifier.leaf <== commitHasher.out;
    for (var i = 0; i < depth; i++) {
        merkleVerifier.pathElements[i] <== pathElements[i];
        merkleVerifier.pathIndices[i] <== pathIndices[i];
    }

    merkleRoot === merkleVerifier.root;
}

component main {public [merkleRoot]} = DonationVerifier(10);
