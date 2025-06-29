// scripts/getConstructorArgs.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("正在準備用於驗證的構造函數參數...");

    // =========================================================
    //  配置區域：請確保這裡的參數與你創建市場時使用的完全一致
    // =========================================================

    // 1. 填寫你從 Etherscan 事件日誌中找到的 PredictionMarket 地址
    const predictionMarketAddress = "0x6843Eef93CDD4396046E817407e9c45918958AcD";

    // 2. 獲取 PredictionMarket 的合約工廠實例，以便訪問其 ABI
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");

    // 3. 準備與部署 MarketFactory 時完全相同的基礎設施參數
    const marketResolverAddress = "0x765eB367E93583e67ADb25C957fa6c3B522cD51d";
    const vrfCoordinatorAddress = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
    const vrfSubscriptionId = "68362467706620433208024921084871692694332746430371723992145806061865827992673";
    const vrfKeyHash = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";

    const functionsRouterAddress = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";
    const functionsDonId = "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000";
    const functionsSubscriptionId = 5023;

    const sourceCode = fs.readFileSync(path.resolve(__dirname, "../backend/resolution-script.js"), "utf8");

    // 4. 準備與你創建市場時完全相同的市場特定參數
    const question = "Will BTC break $150k in 2025?"; // 替換為你真實的問題
    const optionNames = [
        "0x5965730000000000000000000000000000000000000000000000000000000000",
        "0x4e6f000000000000000000000000000000000000000000000000000000000000"
    ];

    // 5. 找到關聯的 PositionNFT 合約地址。
    //    a. 找到你創建市場的那筆交易 (調用 createMarket 的交易)。
    //    b. 在 Etherscan 的“Internal Txns”標籤頁，你會看到兩個被創建的新合約地址。
    //    c. 你已經從事件日誌中知道了 PredictionMarket 的地址，那麼【另一個】地址就是這個市場關聯的 PositionNFT 地址。請將其填寫在這裡。
    const positionNFTAddress = "0x03e388943ffbfbb45e68f63ce1c7144e167896b5";


    // --- 核心邏輯：ABI 編碼 ---

    // 定義構造函數的參數類型
    const constructorArgTypes = [
        "string", "bytes32[]", "address", "address", "address", 
        "uint256", "bytes32", "address", "bytes32", "uint64", "string"
    ];

    // 按順序提供參數的值
    const constructorArgValues = [
        question, optionNames, positionNFTAddress, marketResolverAddress, vrfCoordinatorAddress,
        vrfSubscriptionId, vrfKeyHash, functionsRouterAddress, functionsDonId,
        functionsSubscriptionId, sourceCode
    ];

    // 使用 ethers.js 的 AbiCoder 進行編碼
    const abiCoder = new ethers.AbiCoder();
    const encodedArgs = abiCoder.encode(constructorArgTypes, constructorArgValues);

    console.log("\n✅ ABI 編碼完成！");
    console.log("====================================================================");
    console.log("請將以下這串【不包含 '0x' 前綴】的十六進制數據，");
    console.log("完整地複製並粘貼到 Etherscan 驗證頁面的構造函數參數文本框中：");
    console.log("--------------------------------------------------------------------");
    // 打印出不含 '0x' 前綴的結果
    console.log(encodedArgs.substring(2)); 
    console.log("====================================================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
