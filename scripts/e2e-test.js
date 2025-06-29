const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// 創建一個函數，用於等待用戶手動確認
function waitForUserInput(text) {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    console.log("🚀 端到端（E2E）測試腳本啟動...");

    // =========================================================
    //  配置區域：請填寫你的真實數據
    // =========================================================
    // 這是你已經成功部署並驗證的 MarketFactory 合約地址
    const deployedMarketFactoryAddress = "0xec14a2eECD3800156c084b53CB136863BcBe5A8A";
    
    // 我們將使用 .env 文件中配置的第一個（也是唯一一個）錢包來扮演所有角色
    const signers = await ethers.getSigners();
    if (signers.length === 0) {
        console.error("錯誤：在 hardhat.config.js 中沒有配置任何私鑰！");
        return;
    }
    const signer = signers[0]; 
    console.log(`測試將使用以下錢包地址執行所有交易: ${signer.address}`);

    // 創建市場時需要用到的參數
    const question = "Will this Final E2E test succeed?";
    const optionNames = [
        ethers.encodeBytes32String("Yes"),
        ethers.encodeBytes32String("No")
    ];
    const nftName = "Final E2E Test NFT";
    const nftSymbol = "FET";
    
    // Functions JS 腳本源碼
    const sourceCode = fs.readFileSync(
        path.resolve(__dirname, "../backend/resolution-script.js"),
        "utf8"
    );

    // 後端 API 的基礎 URL (請確保以 / 結尾)
    const baseMetadataURI = "https://5z8l.onrender.com/metadata/";


    // =========================================================
    //  第一階段：連接到已部署的工廠並創建新市場
    // =========================================================
    console.log(`\n🔗 正在連接到已部署的 MarketFactory 於: ${deployedMarketFactoryAddress}`);
    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const marketFactory = MarketFactory.attach(deployedMarketFactoryAddress);

    console.log("🏭 正在調用 createMarket 創建新市場...");
    // 核心修正：調用 createMarket 時，傳入所有必需的參數
    const createMarketTx = await marketFactory.connect(signer).createMarket(
        question,
        optionNames,
        nftName,
        nftSymbol
        // 注意：根據我們之前的最終修正，sourceCode 和 baseMetadataURI
        // 是在 MarketFactory 部署時就已設定，createMarket 不再需要它們。
        // 如果你的 MarketFactory 版本是需要這些參數的，請取消下面兩行的註釋。
        // sourceCode,
        // baseMetadataURI
    );
    console.log(`⏳ 等待交易確認... Tx Hash: ${createMarketTx.hash}`);
    const receipt = await createMarketTx.wait();

    // 從事件日誌中解析出新市場的地址
    const event = receipt.logs.find(log => log.eventName === 'MarketCreated');
    const newMarketAddress = event.args.marketAddress;
    console.log(`✅ 市場創建成功！PredictionMarket 地址: ${newMarketAddress}`);

    // =========================================================
    //  第二階段：【手動操作】授權與提交API結果
    // =========================================================
    console.log("\n⏸️【需要你手動操作】請按以下步驟操作：");
    console.log(`1. 複製 PredictionMarket 地址: ${newMarketAddress}`);
    console.log("2. 訪問 Chainlink VRF 和 Functions 訂閱頁面，將此地址添加為“授權消費者”。");
    console.log("3. 使用 Postman 或 curl，調用你後端的 POST /resolve-market 接口，提交此市場的裁決結果。");
    console.log(`   示例 Body: {"marketAddress": "${newMarketAddress}", "winningOptionIndex": 0}`);
    
    await waitForUserInput("\n✅ 當你完成以上所有手動操作後，請按 Enter 鍵繼續...");
    
    console.log("\n▶️ 檢測到你的確認，腳本將繼續執行...");


    // =========================================================
    //  第三階段：下注並裁決市場
    // =========================================================
    console.log("\n💰 正在連接到新的 PredictionMarket 合約...");
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    const marketContract = PredictionMarket.attach(newMarketAddress);
    
    console.log("💸 正在下注 0.01 ETH 到選項 'Yes' (索引 0)...");
    // 核心修正：添加一個手動的 gasLimit，繞過自動估算
    const placeBetTx = await marketContract.connect(signer).placeBet(0, { 
        value: ethers.parseEther("0.01"),
        gasLimit: 5000000 // 提供一個非常充足的Gas上限
    });
    await placeBetTx.wait();
    console.log(`✅ 下注成功！Tx Hash: ${placeBetTx.hash}`);
    
    console.log("\n⚖️ 正在調用 reportResult 觸發 Chainlink Functions...");
    const reportResultTx = await marketContract.connect(signer).reportResult();
    console.log(`⏳ 等待交易確認... Tx Hash: ${reportResultTx.hash}`);
    await reportResultTx.wait();
    console.log("✅ reportResult 交易已發送！Chainlink Functions 已被觸發。");
    
    // =========================================================
    //  第四階段：觀察最終結果
    // =========================================================
    console.log("\n🎉 核心流程已完成！");
    console.log("接下來，請去 Etherscan 和 Chainlink UI 上觀察魔法的發生：");
    console.log(`1. 在 ${newMarketAddress} 的合約頁面，你會先看到 'FunctionsRequestSent' 事件。`);
    console.log("2. 幾分鐘後，你會看到一筆來自 Chainlink 的內部交易，觸發 'MarketResolved' 和 'RequestedLotteryWinner' 事件。");
    console.log("3. 再過幾分鐘，第二筆內部交易將到來，觸發 'LotteryWinnerPicked' 事件。");
    console.log("4. 最後，去 OpenSea 測試網查看你的 NFT，它應該已經更新為“勝利”狀態！");

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
