// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Pausable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IMonsterNFT} from "./interfaces/IMonsterNFT.sol";

/// @title ChainMon Monster NFT
/// @notice ERC-721 asset identity for game monsters. One NFT per game monster.
/// @dev Asset Identity Contract — NO payments, NO marketplace, NO token.
///
/// Security boundary (Trusted Game Operator Model):
///  - mintMonster()  requires MINTER_ROLE  (game backend)
///  - evolveMonster() requires EVOLVER_ROLE (game backend validates level/item/route)
///  - The contract does NOT verify game state (level, inventory, Fire Stone,
///    capture validity) — that stays with the game backend.
///  - dnaHash, generation and gameMonsterIdHash are immutable after mint.
contract MonsterNFT is ERC721, ERC721Pausable, AccessControl {
    /// @notice Rarity canonical mapping (mirrors shared ONCHAIN_RARITY):
    ///         0 = Common · 1 = Rare · 2 = Epic · 3 = Legendary
    enum Rarity {
        Common,
        Rare,
        Epic,
        Legendary
    }

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant EVOLVER_ROLE = keccak256("EVOLVER_ROLE");

    /// @notice Helps backends confirm the ABI version (no proxy upgrades).
    string public constant CONTRACT_VERSION = "1.0.0";

    /// @notice Highest allowed evolution stage (0 = base, 1, 2).
    uint8 public constant MAX_EVOLUTION_STAGE = 2;

    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;

    mapping(uint256 tokenId => IMonsterNFT.MonsterData) private _monsterData;
    mapping(bytes32 gameMonsterIdHash => uint256 tokenId)
        private _tokenByGameMonsterIdHash;

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

    error GameMonsterAlreadyMinted();
    error InvalidGameMonsterId();
    error InvalidDNAHash();
    error InvalidSpecies();
    error InvalidGeneration();
    error InvalidRarity();
    error InvalidEvolutionStage();
    error TokenDoesNotExist();
    error InvalidAdmin();

    /// @param name_ collection name (e.g. "ChainMon Monsters")
    /// @param symbol_ collection symbol (e.g. "CMON")
    /// @param baseURI_ metadata base URI (tokenURI = baseURI + tokenId)
    /// @param admin address receiving DEFAULT_ADMIN/MINTER/EVOLVER roles
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address admin
    ) ERC721(name_, symbol_) {
        if (admin == address(0)) revert InvalidAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(EVOLVER_ROLE, admin);
        _baseTokenURI = baseURI_;
    }

    /// @notice Mint a monster NFT for a player (game backend only).
    /// @dev The contract does NOT verify game-level capture validity —
    ///      the MINTER_ROLE holder is trusted to submit valid monsters.
    /// @param to NFT recipient (player)
    /// @param monster the on-chain monster identity payload
    /// @return tokenId the newly minted token id (starts at 1)
    function mintMonster(address to, IMonsterNFT.MintMonsterInput calldata monster)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));
        if (monster.gameMonsterIdHash == bytes32(0)) revert InvalidGameMonsterId();
        if (_tokenByGameMonsterIdHash[monster.gameMonsterIdHash] != 0) {
            revert GameMonsterAlreadyMinted();
        }
        if (monster.speciesId == 0) revert InvalidSpecies();
        if (monster.generation == 0) revert InvalidGeneration();
        if (monster.rarity > uint8(Rarity.Legendary)) revert InvalidRarity();
        if (monster.evolutionStage > MAX_EVOLUTION_STAGE) {
            revert InvalidEvolutionStage();
        }
        if (monster.dnaHash == bytes32(0)) revert InvalidDNAHash();

        tokenId = _nextTokenId++;

        _monsterData[tokenId] = IMonsterNFT.MonsterData({
            speciesId: monster.speciesId,
            generation: monster.generation,
            rarity: monster.rarity,
            evolutionStage: monster.evolutionStage,
            dnaHash: monster.dnaHash,
            gameMonsterIdHash: monster.gameMonsterIdHash
        });
        _tokenByGameMonsterIdHash[monster.gameMonsterIdHash] = tokenId;

        _safeMint(to, tokenId);

        emit MonsterMinted(
            tokenId,
            to,
            monster.gameMonsterIdHash,
            monster.speciesId,
            monster.generation,
            monster.rarity,
            monster.evolutionStage,
            monster.dnaHash
        );
    }

    /// @notice Advance a monster's on-chain identity along its evolution.
    /// @dev Authorized EVOLVER_ROLE only: the game backend validates level,
    ///      evolution items and routes off-chain before calling.
    ///      Identity (tokenId/owner/generation/rarity/dnaHash/gameMonsterIdHash)
    ///      is preserved; only speciesId + evolutionStage change.
    /// @param tokenId the existing NFT (never re-minted on evolution)
    /// @param newSpeciesId the evolved species id
    /// @param newEvolutionStage must equal current stage + 1 (no skipping)
    function evolveMonster(
        uint256 tokenId,
        uint32 newSpeciesId,
        uint8 newEvolutionStage
    ) external onlyRole(EVOLVER_ROLE) whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (newSpeciesId == 0) revert InvalidSpecies();
        if (newEvolutionStage > MAX_EVOLUTION_STAGE) {
            revert InvalidEvolutionStage();
        }

        IMonsterNFT.MonsterData storage data = _monsterData[tokenId];
        if (newEvolutionStage != data.evolutionStage + 1) {
            revert InvalidEvolutionStage();
        }

        uint32 previousSpeciesId = data.speciesId;
        uint8 previousStage = data.evolutionStage;

        data.speciesId = newSpeciesId;
        data.evolutionStage = newEvolutionStage;

        emit MonsterEvolved(
            tokenId,
            previousSpeciesId,
            newSpeciesId,
            previousStage,
            newEvolutionStage
        );
    }

    /// @notice Full on-chain monster data.
    /// @dev Reverts for tokens that do not exist — never returns fake data.
    function getMonster(uint256 tokenId)
        external
        view
        returns (IMonsterNFT.MonsterData memory)
    {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        return _monsterData[tokenId];
    }

    /// @notice tokenId for a game monster id hash; 0 = not minted.
    function getTokenIdByGameMonsterIdHash(bytes32 gameMonsterIdHash)
        external
        view
        returns (uint256)
    {
        return _tokenByGameMonsterIdHash[gameMonsterIdHash];
    }

    function isGameMonsterMinted(bytes32 gameMonsterIdHash)
        external
        view
        returns (bool)
    {
        return _tokenByGameMonsterIdHash[gameMonsterIdHash] != 0;
    }

    /// @notice Update the metadata base URI (admin only).
    function setBaseURI(string calldata newBaseURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        emit BaseURIUpdated(_baseTokenURI, newBaseURI);
        _baseTokenURI = newBaseURI;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Pausable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId)
            || interfaceId == type(IMonsterNFT).interfaceId;
    }
}
