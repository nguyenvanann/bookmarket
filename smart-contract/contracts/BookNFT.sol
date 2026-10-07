// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BookNFT
 * @notice Mỗi bản sách là 1 ERC-721. Mọi giao dịch (mint / chuyển / bán)
 *         tạo một TxNode liên kết hash với node trước — chuỗi provenance on-chain.
 */
contract BookNFT is ERC721, Ownable, ReentrancyGuard {
    enum TxAction {
        Mint,
        Transfer,
        Sale,
        Faucet
    }

    struct BookInfo {
        string title;
        string author;
        string genre;
        string metadataURI;
        uint256 listedPrice; // giá bán sơ cấp (wei), 0 = chưa mở bán
        bool forSale;
        uint256 createdAt;
    }

    /**
     * nodeHash = keccak256(index, bookId, from, to, price, action, timestamp, prevNodeHash)
     */
    struct TxNode {
        uint256 index;
        uint256 bookId;
        address from;
        address to;
        uint256 price;
        TxAction action;
        uint256 timestamp;
        bytes32 prevNodeHash;
        bytes32 nodeHash;
    }

    uint256 private _nextBookId = 1;

    mapping(uint256 => BookInfo) private _books;
    mapping(uint256 => TxNode) private _nodes;
    mapping(uint256 => bytes32) public nodeHashByIndex;
    mapping(uint256 => uint256[]) private _bookNodeIndexes; // bookId => node indexes

    bytes32 public latestNodeHash;
    uint256 public latestNodeIndex;

    mapping(address => uint256[]) private _ownedBooks;
    mapping(uint256 => uint256) private _ownedBooksIndex;

    address public marketplace;
    address public treasury;

    event MarketplaceUpdated(address indexed marketplace);
    event TreasuryUpdated(address indexed treasury);
    event BookMinted(
        uint256 indexed bookId,
        address indexed owner,
        string title,
        string author,
        uint256 price
    );
    event BookListed(uint256 indexed bookId, uint256 price);
    event BookUnlisted(uint256 indexed bookId);
    event BookSold(
        uint256 indexed bookId,
        address indexed from,
        address indexed to,
        uint256 price
    );
    event TxNodeCreated(
        uint256 indexed index,
        uint256 indexed bookId,
        bytes32 prevNodeHash,
        bytes32 nodeHash,
        address from,
        address to,
        uint8 action,
        uint256 price
    );

    error ZeroAddress();
    error NotBookOwner(uint256 bookId);
    error CannotBuyOwnBook();
    error BookNotForSale(uint256 bookId);
    error IncorrectPayment(uint256 expected, uint256 sent);
    error OnlyMarketplace();
    error InvalidNodeIndex(uint256 index);
    error InvalidPrice();
    error EmptyBatch();
    error BatchTooLarge();
    error DuplicateInBatch(uint256 bookId);

    uint256 public constant MAX_BUY_BATCH = 20;

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert OnlyMarketplace();
        _;
    }

    constructor(address owner_, address treasury_)
        ERC721("BookMarket Novel", "BOOK")
        Ownable(owner_)
    {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        latestNodeHash = bytes32(0);
        latestNodeIndex = 0;
    }

    function setMarketplace(address marketplace_) external onlyOwner {
        if (marketplace_ == address(0)) revert ZeroAddress();
        marketplace = marketplace_;
        emit MarketplaceUpdated(marketplace_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Admin phát hành bản sách mới (mint NFT) — tạo TxNode Mint
    function mintBook(
        address to,
        string calldata title,
        string calldata author,
        string calldata genre,
        string calldata metadataURI,
        uint256 listedPrice
    ) external onlyOwner nonReentrant returns (uint256 bookId) {
        if (to == address(0)) revert ZeroAddress();
        bookId = _nextBookId++;
        _books[bookId] = BookInfo({
            title: title,
            author: author,
            genre: genre,
            metadataURI: metadataURI,
            listedPrice: listedPrice,
            forSale: listedPrice > 0,
            createdAt: block.timestamp
        });
        _safeMint(to, bookId);
        _appendNode(bookId, address(0), to, listedPrice, TxAction.Mint);
        emit BookMinted(bookId, to, title, author, listedPrice);
        if (listedPrice > 0) emit BookListed(bookId, listedPrice);
    }

    /// @notice Chủ sở hữu mở / đổi giá bán sơ cấp (ngoài marketplace)
    function listPrimary(uint256 bookId, uint256 price) external {
        if (ownerOf(bookId) != msg.sender) revert NotBookOwner(bookId);
        if (price == 0) revert InvalidPrice();
        BookInfo storage b = _books[bookId];
        b.listedPrice = price;
        b.forSale = true;
        emit BookListed(bookId, price);
    }

    function unlistPrimary(uint256 bookId) external {
        if (ownerOf(bookId) != msg.sender) revert NotBookOwner(bookId);
        BookInfo storage b = _books[bookId];
        b.forSale = false;
        emit BookUnlisted(bookId);
    }

    /// @notice Mua sách đang forSale trực tiếp từ chủ sở hữu (primary / P2P)
    function buyBook(uint256 bookId) external payable nonReentrant {
        BookInfo storage b = _books[bookId];
        if (!b.forSale || b.listedPrice == 0) revert BookNotForSale(bookId);
        if (msg.value != b.listedPrice) revert IncorrectPayment(b.listedPrice, msg.value);

        address seller = ownerOf(bookId);
        if (seller == msg.sender) revert CannotBuyOwnBook();

        uint256 price = b.listedPrice;
        b.forSale = false;
        b.listedPrice = 0;

        // Chuyển NFT trước, trả ETH sau (CEI) — tránh seller contract reenter buy
        _transfer(seller, msg.sender, bookId);
        _appendNode(bookId, seller, msg.sender, price, TxAction.Sale);

        (bool ok, ) = seller.call{value: price}("");
        require(ok, "seller payout failed");

        emit BookSold(bookId, seller, msg.sender, price);
    }

    /**
     * @notice Mua nhiều sách sơ cấp trong một giao dịch (giỏ hàng).
     * @dev Chỉ áp dụng listing primary (forSale), không gồm marketplace escrow.
     *      msg.value phải đúng tổng listedPrice của các bookId.
     */
    function buyBooks(uint256[] calldata bookIds) external payable nonReentrant {
        uint256 n = bookIds.length;
        if (n == 0) revert EmptyBatch();
        if (n > MAX_BUY_BATCH) revert BatchTooLarge();

        address[] memory sellers = new address[](n);
        uint256[] memory prices = new uint256[](n);
        uint256 total;

        for (uint256 i = 0; i < n; i++) {
            uint256 bookId = bookIds[i];
            for (uint256 j = 0; j < i; j++) {
                if (bookIds[j] == bookId) revert DuplicateInBatch(bookId);
            }
            BookInfo storage b = _books[bookId];
            if (!b.forSale || b.listedPrice == 0) revert BookNotForSale(bookId);
            address seller = ownerOf(bookId);
            if (seller == msg.sender) revert CannotBuyOwnBook();
            sellers[i] = seller;
            prices[i] = b.listedPrice;
            total += b.listedPrice;
        }

        if (msg.value != total) revert IncorrectPayment(total, msg.value);

        for (uint256 i = 0; i < n; i++) {
            uint256 bookId = bookIds[i];
            BookInfo storage b = _books[bookId];
            uint256 price = prices[i];
            address seller = sellers[i];
            b.forSale = false;
            b.listedPrice = 0;
            _transfer(seller, msg.sender, bookId);
            _appendNode(bookId, seller, msg.sender, price, TxAction.Sale);
            emit BookSold(bookId, seller, msg.sender, price);
        }

        for (uint256 i = 0; i < n; i++) {
            (bool ok, ) = sellers[i].call{value: prices[i]}("");
            require(ok, "seller payout failed");
        }
    }

    /// @notice Marketplace gọi trước khi escrow — tắt bán sơ cấp để tránh double-list
    function clearPrimaryListing(uint256 bookId) external onlyMarketplace {
        BookInfo storage b = _books[bookId];
        b.forSale = false;
        b.listedPrice = 0;
        emit BookUnlisted(bookId);
    }

    /// @notice Marketplace gọi sau khi bán thành công — chuyển NFT từ escrow + ghi TxNode (from = seller thật)
    function marketSettle(
        uint256 bookId,
        address seller,
        address to,
        uint256 price
    ) external onlyMarketplace nonReentrant {
        if (to == address(0) || seller == address(0)) revert ZeroAddress();
        address holder = ownerOf(bookId); // thường là địa chỉ marketplace (escrow)
        _transfer(holder, to, bookId);
        BookInfo storage b = _books[bookId];
        b.forSale = false;
        b.listedPrice = 0;
        _appendNode(bookId, seller, to, price, TxAction.Sale);
        emit BookSold(bookId, seller, to, price);
    }

    /// @notice Ghi Transfer node khi chuyển tay (không qua mua bán)
    function recordTransferNode(
        uint256 bookId,
        address from,
        address to
    ) external onlyMarketplace {
        _appendNode(bookId, from, to, 0, TxAction.Transfer);
    }

    /**
     * @notice Ghi TxNode Faucet sau khi cấp ETH lab (bookId = 0).
     *         Chỉ owner/deployer — nối tip chuỗi provenance ngay lập tức.
     */
    function recordFaucet(address to, uint256 amountWei) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amountWei == 0) revert InvalidPrice();
        _appendNode(0, msg.sender, to, amountWei, TxAction.Faucet);
    }

    function getBook(uint256 bookId) external view returns (BookInfo memory) {
        _requireOwned(bookId);
        return _books[bookId];
    }

    function getTxNode(uint256 index) external view returns (TxNode memory) {
        if (index == 0 || index > latestNodeIndex) revert InvalidNodeIndex(index);
        return _nodes[index];
    }

    function getBookNodeIndexes(uint256 bookId) external view returns (uint256[] memory) {
        return _bookNodeIndexes[bookId];
    }

    function booksOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownedBooks[owner];
    }

    function verifyChain(uint256 upToIndex) external view returns (bool) {
        if (upToIndex == 0 || upToIndex > latestNodeIndex) return false;
        bytes32 prev = bytes32(0);
        for (uint256 i = 1; i <= upToIndex; i++) {
            TxNode memory n = _nodes[i];
            bytes32 expected = _computeHash(
                n.index,
                n.bookId,
                n.from,
                n.to,
                n.price,
                n.action,
                n.timestamp,
                prev
            );
            if (n.nodeHash != expected || n.prevNodeHash != prev) return false;
            prev = n.nodeHash;
        }
        return true;
    }

    function _appendNode(
        uint256 bookId,
        address from,
        address to,
        uint256 price,
        TxAction action
    ) internal {
        uint256 index = ++latestNodeIndex;
        bytes32 prev = latestNodeHash;
        uint256 ts = block.timestamp;
        bytes32 hash = _computeHash(index, bookId, from, to, price, action, ts, prev);

        TxNode memory node = TxNode({
            index: index,
            bookId: bookId,
            from: from,
            to: to,
            price: price,
            action: action,
            timestamp: ts,
            prevNodeHash: prev,
            nodeHash: hash
        });
        _nodes[index] = node;
        nodeHashByIndex[index] = hash;
        _bookNodeIndexes[bookId].push(index);
        latestNodeHash = hash;

        emit TxNodeCreated(
            index,
            bookId,
            prev,
            hash,
            from,
            to,
            uint8(action),
            price
        );
    }

    function _computeHash(
        uint256 index,
        uint256 bookId,
        address from,
        address to,
        uint256 price,
        TxAction action,
        uint256 timestamp,
        bytes32 prevNodeHash
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    index,
                    bookId,
                    from,
                    to,
                    price,
                    action,
                    timestamp,
                    prevNodeHash
                )
            );
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address from)
    {
        from = super._update(to, tokenId, auth);
        if (from != address(0)) {
            _removeOwned(from, tokenId);
        }
        if (to != address(0)) {
            _addOwned(to, tokenId);
        }
        // Ghi Transfer node khi chuyển tay ngoài marketplace settle / mint
        // (mint & marketSettle đã gọi _appendNode riêng — tránh double)
        return from;
    }

    function _addOwned(address owner, uint256 bookId) private {
        _ownedBooksIndex[bookId] = _ownedBooks[owner].length;
        _ownedBooks[owner].push(bookId);
    }

    function _removeOwned(address owner, uint256 bookId) private {
        uint256 idx = _ownedBooksIndex[bookId];
        uint256 last = _ownedBooks[owner].length - 1;
        if (idx != last) {
            uint256 moved = _ownedBooks[owner][last];
            _ownedBooks[owner][idx] = moved;
            _ownedBooksIndex[moved] = idx;
        }
        _ownedBooks[owner].pop();
        delete _ownedBooksIndex[bookId];
    }
}
