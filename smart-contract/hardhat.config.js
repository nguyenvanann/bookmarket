require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    // BookMarket geth private-net (RPC :8547, chainId 54321 — tách khỏi ticket 12345/:8545)
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8547",
      chainId: 54321,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
};
