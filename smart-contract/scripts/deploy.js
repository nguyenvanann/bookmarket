const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEFAULT_DEPLOYER = "0xd18624683f144a400317Fc7ec8437a8deDeEE906";

async function getDeployer() {
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    const [signer] = await hre.ethers.getSigners();
    return signer;
  }

  const rpc = process.env.RPC_URL || "http://127.0.0.1:8547";
  const deployerAddress = process.env.DEPLOYER_ADDRESS || DEFAULT_DEPLOYER;
  const provider = new hre.ethers.JsonRpcProvider(rpc);
  const passwordPath = path.join(
    __dirname,
    "..",
    "..",
    "blockchain",
    "private-net",
    "password.txt"
  );
  const password = fs.existsSync(passwordPath)
    ? fs.readFileSync(passwordPath, "utf8").trim()
    : "password";

  try {
    await provider.send("personal_unlockAccount", [deployerAddress, password, 600]);
    console.log("Unlocked deployer on geth:", deployerAddress);
  } catch (err) {
    console.warn(
      "Unlock warning (cần personal API trên geth):",
      err.message
    );
  }

  return provider.getSigner(deployerAddress);
}

async function main() {
  const deployer = await getDeployer();
  const deployerAddress = await deployer.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  console.log("Deployer:", deployerAddress);
  console.log("Network chainId:", network.chainId.toString());
  console.log(
    "Balance:",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployerAddress)),
    "ETH"
  );

  const isLocal =
    network.chainId === 54321n ||
    network.chainId === 12345n ||
    network.chainId === 31337n;
  if (!isLocal) {
    throw new Error(`Chỉ hỗ trợ deploy local. chainId=${network.chainId}`);
  }

  const BookNFT = await hre.ethers.getContractFactory("BookNFT", deployer);
  const bookNFT = await BookNFT.deploy(deployerAddress, deployerAddress);
  await bookNFT.waitForDeployment();
  const bookAddress = await bookNFT.getAddress();
  console.log("BookNFT:", bookAddress);

  const BookMarketplace = await hre.ethers.getContractFactory(
    "BookMarketplace",
    deployer
  );
  const market = await BookMarketplace.deploy(
    deployerAddress,
    bookAddress,
    deployerAddress,
    500 // 5%
  );
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("BookMarketplace:", marketAddress);

  await (await bookNFT.setMarketplace(marketAddress)).wait();
  console.log("BookNFT.marketplace set");

  // Seed vài cuốn sách mẫu (admin mint → treasury/deployer sở hữu, mở bán)
  const samples = [
    ["Số Đỏ", "Vũ Trọng Phụng", "Tiểu thuyết", "ipfs://book/so-do", "0.02"],
    ["Chí Phèo", "Nam Cao", "Truyện ngắn", "ipfs://book/chi-pheo", "0.015"],
    ["Dế Mèn Phiêu Lưu Ký", "Tô Hoài", "Thiếu nhi", "ipfs://book/de-men", "0.01"],
  ];
  for (const [title, author, genre, uri, eth] of samples) {
    const tx = await bookNFT.mintBook(
      deployerAddress,
      title,
      author,
      genre,
      uri,
      hre.ethers.parseEther(eth)
    );
    await tx.wait();
    console.log(`Minted: ${title} @ ${eth} ETH`);
  }

  const out = {
    network: hre.network.name,
    chainId: network.chainId.toString(),
    deployer: deployerAddress,
    BookNFT: bookAddress,
    BookMarketplace: marketAddress,
    feeBps: 500,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log("Wrote", outFile);

  copyAbi("BookNFT");
  copyAbi("BookMarketplace");
  writeEnvHints(bookAddress, marketAddress);

  console.log("\n--- .env hints ---");
  console.log(`BOOK_NFT_ADDRESS=${bookAddress}`);
  console.log(`BOOK_MARKETPLACE_ADDRESS=${marketAddress}`);
}

function copyAbi(name) {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    `${name}.sol`,
    `${name}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    console.warn("Missing artifact", artifactPath);
    return;
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const targets = [
    path.join(__dirname, "..", "..", "backend", "src", "abi", `${name}.json`),
    path.join(
      __dirname,
      "..",
      "..",
      "frontend",
      "src",
      "services",
      "abi",
      `${name}.json`
    ),
  ];
  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, JSON.stringify(artifact.abi, null, 2));
    console.log("Copied ABI ->", t);
  }
}

function upsertEnvFile(filePath, updates, defaults = "") {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : defaults;
  if (!content.trim()) content = defaults;
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) content = content.replace(re, line);
    else content = content.trimEnd() + `\n${line}\n`;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeEnvHints(bookAddress, marketAddress) {
  const updates = {
    BOOK_NFT_ADDRESS: bookAddress,
    BOOK_MARKETPLACE_ADDRESS: marketAddress,
    VITE_BOOK_NFT_ADDRESS: bookAddress,
    VITE_BOOK_MARKETPLACE_ADDRESS: marketAddress,
  };
  upsertEnvFile(
    path.join(__dirname, "..", "..", "backend", ".env"),
    {
      BOOK_NFT_ADDRESS: bookAddress,
      BOOK_MARKETPLACE_ADDRESS: marketAddress,
      CHAIN_ID: "54321",
      RPC_URL: "http://127.0.0.1:8547",
      RPC_URL_2: "http://127.0.0.1:8548",
    },
    [
      "PORT=5002",
      "MONGODB_URI=mongodb://127.0.0.1:27017/bookmarket",
      "JWT_SECRET=bookmarket-dev-secret",
      "JWT_EXPIRES_IN=7d",
      "CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175",
      "CHAIN_ID=54321",
      "RPC_URL=http://127.0.0.1:8547",
      "RPC_URL_2=http://127.0.0.1:8548",
      "DEPLOYER_ADDRESS=0xd18624683f144a400317Fc7ec8437a8deDeEE906",
      "GETH_PASSWORD=password",
      "",
    ].join("\n")
  );
  upsertEnvFile(
    path.join(__dirname, "..", "..", "frontend", ".env"),
    {
      VITE_BOOK_NFT_ADDRESS: bookAddress,
      VITE_BOOK_MARKETPLACE_ADDRESS: marketAddress,
      VITE_CHAIN_ID: "54321",
      VITE_RPC_URL: "http://127.0.0.1:8547",
      VITE_NETWORK_NAME: "BookMarket Private",
    },
    [
      "VITE_API_BASE_URL=http://localhost:5002/api",
      "VITE_NETWORK_NAME=BookMarket Private",
      "VITE_CHAIN_ID=54321",
      "VITE_RPC_URL=http://127.0.0.1:8547",
      "",
    ].join("\n")
  );
  console.log("Updated backend/.env and frontend/.env");
  void updates;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
