// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/// @dev TEST-ONLY probe that mirrors the canonical off-chain hashing so the
///      TypeScript helpers can be verified against real Solidity execution.
///      Canonical DNA field order (fixed, never reorder):
///      hpGene, attackGene, defenseGene, speedGene, mutationGene
///      DNA hash  = keccak256(abi.encode(hpGene, attackGene, defenseGene, speedGene, mutationGene))
///      Game ID   = keccak256(bytes(offchain monster id))
contract DNAHashProbe {
    function computeDnaHash(
        uint32 hpGene,
        uint32 attackGene,
        uint32 defenseGene,
        uint32 speedGene,
        uint32 mutationGene
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    hpGene,
                    attackGene,
                    defenseGene,
                    speedGene,
                    mutationGene
                )
            );
    }

    function computeGameMonsterIdHash(string calldata id)
        public
        pure
        returns (bytes32)
    {
        return keccak256(bytes(id));
    }
}
