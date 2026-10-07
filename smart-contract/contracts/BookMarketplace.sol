// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BookNFT} from "./BookNFT.sol";

/**
 * @title BookMarketplace
 * @notice Sàn bán lại sách: escrow NFT, mua bằng ETH, hoa hồng treasury.
 *         Khi bán thành công gọi BookNFT.marketSettle → tạo TxNode liên kết.
 */
contract BookMarketplace is Ownable, ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    BookNFT public immutable bookNFT;
    address public treasury;
    uint256 public feeBps; // 500 = 5%

    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed bookId, address indexed seller, uint256 price);
    event Cancelled(uint256 indexed bookId, address indexed seller);
    event Purchased(
        uint256 indexed bookId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 fee
    );
    event FeeUpdated(uint256 feeBps);
    event TreasuryUpdated(address treasury);

    error ZeroAddress();
    error NotOwner();
    error NotListed();
    error CannotBuyOwnListing();
    error IncorrectPayment(uint256 expected, uint256 sent);
    error InvalidFee();
    error InvalidPrice();

    constructor(address owner_, address bookNFT_, address treasury_, uint256 feeBps_)
        Ownable(owner_)
    {
        if (bookNFT_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (feeBps_ > 2000) revert InvalidFee();
        bookNFT = BookNFT(bookNFT_);
        treasury = treasury_;
        feeBps = feeBps_;
    }

    function setFeeBps(uint256 feeBps_) external onlyOwner {
        if (feeBps_ > 2000) revert InvalidFee();
        feeBps = feeBps_;
        emit FeeUpdated(feeBps_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function listBook(uint256 bookId, uint256 price) external nonReentrant {
        if (price == 0) revert InvalidPrice();
        if (bookNFT.ownerOf(bookId) != msg.sender) revert NotOwner();

        // Tắt bán sơ cấp (nếu có) rồi mới escrow NFT
        bookNFT.clearPrimaryListing(bookId);
        bookNFT.transferFrom(msg.sender, address(this), bookId);
        listings[bookId] = Listing({seller: msg.sender, price: price, active: true});
        emit Listed(bookId, msg.sender, price);
    }

    function cancelListing(uint256 bookId) external nonReentrant {
        Listing memory L = listings[bookId];
        if (!L.active) revert NotListed();
        if (L.seller != msg.sender && msg.sender != owner()) revert NotOwner();

        delete listings[bookId];
        bookNFT.transferFrom(address(this), L.seller, bookId);
        emit Cancelled(bookId, L.seller);
    }

    function buyListedBook(uint256 bookId) external payable nonReentrant {
        Listing memory L = listings[bookId];
        if (!L.active) revert NotListed();
        if (L.seller == msg.sender) revert CannotBuyOwnListing();
        if (msg.value != L.price) revert IncorrectPayment(L.price, msg.value);

        delete listings[bookId];

        uint256 fee = (L.price * feeBps) / 10_000;
        uint256 sellerAmount = L.price - fee;

        // Chuyển NFT từ escrow + ghi TxNode Sale (from = seller)
        bookNFT.marketSettle(bookId, L.seller, msg.sender, L.price);

        if (fee > 0) {
            (bool okFee, ) = treasury.call{value: fee}("");
            require(okFee, "fee failed");
        }
        (bool okSeller, ) = L.seller.call{value: sellerAmount}("");
        require(okSeller, "seller payout failed");

        emit Purchased(bookId, L.seller, msg.sender, L.price, fee);
    }

    function getListing(uint256 bookId) external view returns (Listing memory) {
        return listings[bookId];
    }
}
