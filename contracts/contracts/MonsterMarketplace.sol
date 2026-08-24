// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title ChainMon Monster Marketplace
/// @notice Fixed-price native-ETH marketplace for MonsterNFT.
/// @dev Trading contract — separate from the asset contract (MonsterNFT).
///
/// Design guarantees:
///  - NON-CUSTODIAL: NFTs stay in the seller wallet while listed; the
///    marketplace never escrows NFTs or ETH.
///  - 0% platform fee: buyers pay exactly the listing price, sellers
///    receive 100% of it.
///  - Native ETH only, exact payment (msg.value == price).
///  - ReentrancyGuard because buyMonster performs an external ETH call.
///  - Cancel remains available while paused (emergency rule).
contract MonsterMarketplace is AccessControl, Pausable, ReentrancyGuard {
    /// @notice Helps backends confirm the ABI version (no proxy upgrades).
    string public constant CONTRACT_VERSION = "1.0.0";

    /// @notice The MonsterNFT asset contract this marketplace trades.
    IERC721 public immutable monsterNFT;

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    /// @notice tokenId is the listing key — one active listing per NFT.
    mapping(uint256 => Listing) private _listings;

    event MonsterListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event MonsterSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );

    error InvalidPrice();
    error NotMonsterOwner();
    error MarketplaceNotApproved();
    error AlreadyListed();
    error ListingNotActive();
    error NotListingSeller();
    error CannotBuyOwnMonster();
    error IncorrectPayment();
    error SellerNoLongerOwner();
    error PaymentFailed();
    error InvalidMonsterNFT();
    error InvalidAdmin();

    /// @param monsterNftAddress the MonsterNFT asset contract address
    /// @param admin address receiving DEFAULT_ADMIN_ROLE (pause/unpause)
    constructor(address monsterNftAddress, address admin) {
        if (monsterNftAddress == address(0)) revert InvalidMonsterNFT();
        if (admin == address(0)) revert InvalidAdmin();
        monsterNFT = IERC721(monsterNftAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Whether the marketplace may transfer `tokenId` for `owner`.
    /// @dev Accepts either per-token approval or a blanket operator approval.
    function isApprovedForMarketplace(address owner, uint256 tokenId)
        public
        view
        returns (bool)
    {
        return
            monsterNFT.getApproved(tokenId) == address(this) ||
            monsterNFT.isApprovedForAll(owner, address(this));
    }

    /// @notice List a monster at a fixed price (wei).
    /// @dev The seller must own the NFT and approve the marketplace first.
    ///      Non-custodial: the NFT stays in the seller's wallet.
    /// @param tokenId MonsterNFT token id (the listing key)
    /// @param price listing price in wei (> 0)
    function listMonster(uint256 tokenId, uint256 price)
        external
        whenNotPaused
    {
        if (price == 0) revert InvalidPrice();
        if (monsterNFT.ownerOf(tokenId) != msg.sender) revert NotMonsterOwner();
        if (_listings[tokenId].active) revert AlreadyListed();
        if (!isApprovedForMarketplace(msg.sender, tokenId)) {
            revert MarketplaceNotApproved();
        }

        _listings[tokenId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            active: true
        });
        emit MonsterListed(tokenId, msg.sender, price);
    }

    /// @notice Cancel an active listing (seller only).
    /// @dev Remains available while the marketplace is paused so sellers can
    ///      always withdraw their listings during an emergency.
    /// @param tokenId the listed MonsterNFT token id
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = _listings[tokenId];
        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotListingSeller();

        listing.active = false;
        emit ListingCancelled(tokenId, msg.sender);
    }

    /// @notice Buy a listed monster with exact ETH.
    /// @dev Checks → Effects → Interactions:
    ///      1. validate listing / payment / current owner / approval
    ///      2. deactivate the listing
    ///      3. transfer the NFT seller → buyer, then pay the seller 100%
    ///      Any failure reverts the whole transaction. Reentrancy guarded.
    /// @param tokenId the listed MonsterNFT token id
    function buyMonster(uint256 tokenId)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        Listing memory listing = _listings[tokenId];
        if (!listing.active) revert ListingNotActive();
        if (msg.sender == listing.seller) revert CannotBuyOwnMonster();
        if (msg.value != listing.price) revert IncorrectPayment();
        // Re-validate at buy time: the seller may have transferred the NFT
        // or revoked the approval after listing (non-custodial).
        if (monsterNFT.ownerOf(tokenId) != listing.seller) {
            revert SellerNoLongerOwner();
        }
        if (!isApprovedForMarketplace(listing.seller, tokenId)) {
            revert MarketplaceNotApproved();
        }

        // Effects first.
        _listings[tokenId].active = false;

        // Interactions: NFT transfer, then ETH settlement to the seller.
        monsterNFT.safeTransferFrom(listing.seller, msg.sender, tokenId);
        (bool success, ) = payable(listing.seller).call{value: listing.price}("");
        if (!success) revert PaymentFailed();

        emit MonsterSold(tokenId, listing.seller, msg.sender, listing.price);
    }

    /// @notice Full listing data; inactive when not listed / sold / cancelled.
    function getListing(uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return _listings[tokenId];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
