// require("@nomicfoundation/hardhat-toolbox");
// require("hardhat-contract-sizer");
// require("dotenv").config(); // 引入dotenv

// /** @type import('hardhat/config').HardhatUserConfig */
// module.exports = {
//   solidity: {
//     version : "0.8.28",
//     settings: {
//       optimizer: {
//         enabled: true,
//         runs: 200 // 对于工厂合约建议用较低值 (200-500)
//       }
//     }
//   },
//   paths: {
//     sources: "./contracts", // 你的合约目录 
//     tests: "./test",
//     scripts: "./scripts",
//   }
// };
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28", // 確保版本號與你的合約一致
    settings: {
      optimizer: {
        enabled: true, // 啟用優化器
        // "runs" 參數指的是你預期一個函數在其生命週期內會被調用多少次。
        // 一個較低的值會側重於優化部署成本（減小體積）。
        // 一個較高的值會側重於優化後續的函數調用成本。
        // 對於部署成本高的工廠合約，200是一個非常好的選擇。
        runs: 200, 
      },
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
    // === 新增的部分 ===
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,  // 直接从 .env 读取 
  },
};