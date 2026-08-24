// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @dev TEST-ONLY malicious buyer: tries to re-enter the marketplace from
///      receive() during ETH settlement. ReentrancyGuard must block it.
contract MaliciousBuyer {
    address public immutable marketplace;

    constructor(address marketplace_) {
        marketplace = marketplace_;
    }

    /// @dev Approve the marketplace from this contract's own context.
    function approveNft(address nftContract, uint256 tokenId) external {
        IERC721(nftContract).approve(marketplace, tokenId);
    }

    /// @dev List a token owned by this contract.
    function list(uint256 tokenId, uint256 price) external {
        (bool ok, ) = marketplace.call(
            abi.encodeWithSignature("listMonster(uint256,uint256)", tokenId, price)
        );
        require(ok, "list failed");
    }

    receive() external payable {
        // Attempt a reentrant buy on the same token (will be blocked).
        (bool ok, ) = marketplace.call{value: msg.value}(
            abi.encodeWithSignature("buyMonster(uint256)", 1)
        );
        // Ignore the result — the marketplace reverts the whole tx either way.
        ok;
    }

    /// @dev Lets the test transfer the NFT into this contract (it acts as seller).
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
