const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("正在準備部署參數...");

    // --- 部署參數配置 ---
    const marketResolverAddress = "0x765eB367E93583e67ADb25C957fa6c3B522cD51d"; // 你的錢包地址將作為裁決者
    const vrfCoordinatorAddress = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B"; // Sepolia VRF Coordinator
    const vrfSubscriptionId = "68362467706620433208024921084871692694332746430371723992145806061865827992673"; // 替換為你的VRF訂閱ID
    const vrfKeyHash = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae"; // Sepolia Key Hash

    const functionsRouterAddress = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0"; // Sepolia Functions Router
    const functionsDonId = "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000"; // Sepolia DON ID (bytes32)
    const functionsSubscriptionId = 5023; // 替換為你的Functions訂閱ID
    const baseMetadataURI = "https://5z8l.onrender.com/metadata/";
    
   
    const sourceCode = fs.readFileSync(
        path.resolve(__dirname, "../backend/resolution-script.js"),
        "utf8"
    );

 console.log("正在部署 MarketFactory 合約...");

    // 獲取 MarketFactory 的合約工廠實例
    const MarketFactory = await ethers.getContractFactory("MarketFactory");

    // **核心修正**: 調用 deploy 函數時，傳入的參數列表
    // 與我們最終版 MarketFactory.sol 的構造函數完全匹配。
    const marketFactory = await MarketFactory.deploy(
        marketResolverAddress,
        vrfCoordinatorAddress,
        vrfSubscriptionId,
        vrfKeyHash,
        functionsRouterAddress,
        functionsDonId,
        functionsSubscriptionId,
        sourceCode,
        baseMetadataURI
    );

    // 等待部署交易被礦工打包確認
    await marketFactory.waitForDeployment();

    console.log(`🎉 MarketFactory 成功部署到地址: ${await marketFactory.getAddress()}`);
}

// 標準的 Hardhat 腳本執行模式
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

