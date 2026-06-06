// Noir port of DonationVerifier.circom (depth-10 Poseidon Merkle proof).
// Same statement as the Circom circuit: prove knowledge of donation fields +
// salt whose Poseidon(5) commitment sits in a Merkle tree under a public root.
//
// Deviation (documented in the benchmark design): the computed root is
// RETURNED as a public output rather than asserted against a public input —
// semantically identical binding, and robust to Poseidon-constant differences
// across stdlib implementations when preparing inputs.
use poseidon::poseidon::bn254;

fn main(
    donor_id: Field,
    amount: Field,
    ngo_id: Field,
    timestamp: Field,
    salt: Field,
    path_elements: [Field; 10],
    path_indices: [Field; 10],
) -> pub Field {
    // commitment = Poseidon(5 donation fields)
    let commitment = bn254::hash_5([donor_id, amount, ngo_id, timestamp, salt]);

    let mut node = commitment;
    for i in 0..10 {
        let idx = path_indices[i];
        // Constrain path index to binary (mirrors the Circom constraint)
        assert(idx * (1 - idx) == 0);
        // Conditional left/right swap, fully constrained
        let left = node + idx * (path_elements[i] - node);
        let right = path_elements[i] + idx * (node - path_elements[i]);
        node = bn254::hash_2([left, right]);
    }
    node
}
