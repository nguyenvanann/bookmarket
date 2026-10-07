const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BookMarket linked TxNode", function () {
  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const BookNFT = await ethers.getContractFactory("BookNFT");
    const nft = await BookNFT.deploy(owner.address, owner.address);
    await nft.waitForDeployment();

    const Market = await ethers.getContractFactory("BookMarketplace");
    const market = await Market.deploy(owner.address, await nft.getAddress(), owner.address, 500);
    await market.waitForDeployment();
    await nft.setMarketplace(await market.getAddress());
    return { nft, market, owner, alice, bob };
  }

  it("mint tạo TxNode liên kết genesis", async function () {
    const { nft, alice } = await deploy();
    await nft.mintBook(alice.address, "Sách A", "Tác giả", "Novel", "uri", ethers.parseEther("0.01"));
    expect(await nft.latestNodeIndex()).to.equal(1n);
    const node = await nft.getTxNode(1);
    expect(node.bookId).to.equal(1n);
    expect(node.prevNodeHash).to.equal(ethers.ZeroHash);
    expect(node.nodeHash).to.equal(await nft.latestNodeHash());
    expect(await nft.verifyChain(1)).to.equal(true);
  });

  it("mua sách nối node với prevNodeHash", async function () {
    const { nft, alice, bob } = await deploy();
    await nft.mintBook(alice.address, "Sách B", "TG", "Novel", "uri", ethers.parseEther("0.02"));
    const tip1 = await nft.latestNodeHash();
    await nft.connect(bob).buyBook(1, { value: ethers.parseEther("0.02") });
    expect(await nft.ownerOf(1)).to.equal(bob.address);
    expect(await nft.latestNodeIndex()).to.equal(2n);
    const node2 = await nft.getTxNode(2);
    expect(node2.prevNodeHash).to.equal(tip1);
    expect(await nft.verifyChain(2)).to.equal(true);
  });

  it("marketplace bán lại tạo Sale node", async function () {
    const { nft, market, alice, bob } = await deploy();
    await nft.mintBook(alice.address, "Sách C", "TG", "Novel", "uri", 0);
    await nft.connect(alice).approve(await market.getAddress(), 1);
    await market.connect(alice).listBook(1, ethers.parseEther("0.05"));
    await market.connect(bob).buyListedBook(1, { value: ethers.parseEther("0.05") });
    expect(await nft.ownerOf(1)).to.equal(bob.address);
    expect(await nft.latestNodeIndex()).to.equal(2n);
    const sale = await nft.getTxNode(2);
    expect(sale.from).to.equal(alice.address);
    expect(sale.to).to.equal(bob.address);
  });

  it("list marketplace tắt bán sơ cấp", async function () {
    const { nft, market, alice } = await deploy();
    await nft.mintBook(alice.address, "Sách D", "TG", "Novel", "uri", ethers.parseEther("0.01"));
    expect((await nft.getBook(1)).forSale).to.equal(true);
    await nft.connect(alice).approve(await market.getAddress(), 1);
    await market.connect(alice).listBook(1, ethers.parseEther("0.02"));
    expect((await nft.getBook(1)).forSale).to.equal(false);
  });

  it("không tự mua sách của mình", async function () {
    const { nft, alice } = await deploy();
    await nft.mintBook(alice.address, "Sách E", "TG", "Novel", "uri", ethers.parseEther("0.01"));
    await expect(
      nft.connect(alice).buyBook(1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(nft, "CannotBuyOwnBook");
  });
});

