// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/// @title ChainMon Monster NFT interface
/// @notice Read/write surface of the MonsterNFT asset identity contract.
/// @dev On-chain data is the immutable asset identity only — game state
///      (EXP, level, HP, skills, inventory) stays off-chain.
interface IMonsterNFT {
    /// @notice Core asset identity stored on-chain per token.
    struct MonsterData {
        uint32 speciesId; // Phase 2 species ids (FireCub = 1, ...)
        uint16 generation;
        uint8 rarity; // 0 Common · 1 Rare · 2 Epic · 3 Legendary
        uint8 evolutionStage; // 0 base · 1 · 2
        bytes32 dnaHash; // keccak256(abi.encode(hpGene, attackGene, defenseGene, speedGene, mutationGene))
        bytes32 gameMonsterIdHash; // keccak256(bytes(offchain monster id))
    }

    struct MintMonsterInput {
        bytes32 gameMonsterIdHash;
        uint32 speciesId;
        uint16 generation;
        uint8 rarity;
        uint8 evolutionStage;
        bytes32 dnaHash;
    }

    event MonsterMinted(
        uint256 indexed tokenId,
        address indexed owner,
        bytes32 indexed gameMonsterIdHash,
        uint32 speciesId,
        uint16 generation,
        uint8 rarity,
        uint8 evolutionStage,
        bytes32 dnaHash
    );

    event MonsterEvolved(
        uint256 indexed tokenId,
        uint32 indexed previousSpeciesId,
        uint32 indexed newSpeciesId,
        uint8 previousStage,
        uint8 newStage
    );

    event BaseURIUpdated(string previousURI, string newURI);

    function mintMonster(address to, MintMonsterInput calldata monster)
        external
        returns (uint256 tokenId);

    function evolveMonster(
        uint256 tokenId,
        uint32 newSpeciesId,
        uint8 newEvolutionStage
    ) external;

    function getMonster(uint256 tokenId)
        external
        view
        returns (MonsterData memory);

    function getTokenIdByGameMonsterIdHash(bytes32 gameMonsterIdHash)
        external
        view
        returns (uint256);

    function isGameMonsterMinted(bytes32 gameMonsterIdHash)
        external
        view
        returns (bool);
}
