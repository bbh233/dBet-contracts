const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 授權關係鏈上偵錯腳本啟動...");

    // =========================================================
    //  配置區域：請填寫你在 e2e-test.js 中獲取的真實地址
    // =========================================================
    
    // 1. 填寫你的 e2e-test.js 腳本成功創建後，打印在終端里的那個 PredictionMarket 地址
    const predictionMarketAddress = "0x8d638a23a2cbdd71b94c644aa0986145f8920e11";

    // =========================================================
    //  偵錯流程開始
    // =========================================================

    console.log(`\n1. 正在連接到目標 PredictionMarket 合約於: ${predictionMarketAddress}`);
    
    // 我們需要 ABI 來與合約對話，Hardhat 會在編譯後自動生成
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    const marketContract = PredictionMarket.attach(predictionMarketAddress);

    let positionNFTAddress;
    try {
        console.log("2. 正在從 PredictionMarket 中讀取關聯的 PositionNFT 地址...");
        positionNFTAddress = await marketContract.positionNFT();
        console.log(`   ✅ 成功讀取！PositionNFT 地址為: ${positionNFTAddress}`);
    } catch (error) {
        console.error("   ❌ 讀取 PositionNFT 地址失敗！請檢查 PredictionMarket 地址是否正確。", error);
        return;
    }
    
    console.log(`\n3. 正在連接到目標 PositionNFT 合約於: ${positionNFTAddress}`);
    const PositionNFT = await ethers.getContractFactory("PositionNFT");
    const nftContract = PositionNFT.attach(positionNFTAddress);

    let authorizedAddress;
    try {
        console.log("4. 正在從 PositionNFT 中讀取已授權的 marketContractAddress...");
        authorizedAddress = await nftContract.marketContractAddress();
        console.log(`   ✅ 成功讀取！已授權的地址為: ${authorizedAddress}`);
    } catch (error) {
        console.error("   ❌ 讀取授權地址失敗！請檢查 PositionNFT 地址是否正確。", error);
        return;
    }

    // =========================================================
    //  最終診斷
    // =========================================================

    console.log("\n\n===== 最終診斷報告 =====");
    console.log(`期望的授權地址 (PredictionMarket): ${predictionMarketAddress}`);
    console.log(`實際存儲的授權地址 (PositionNFT):   ${authorizedAddress}`);

    if (predictionMarketAddress.toLowerCase() === authorizedAddress.toLowerCase()) {
        console.log("\n✅ 結論：授權鏈路正確！");
        console.log("核心授權邏輯沒有問題。placeBet 失敗的原因可能在於其他地方，例如 Gas 不足、或者你添加消費者到 Chainlink 訂閱的交易尚未被完全確認。請稍等幾分鐘後再試一次 e2e 測試。");
    } else {
        console.log("\n❌ 結論：找到 Bug！授權鏈路錯誤！");
        console.log("PositionNFT 合約中存儲的授權地址與實際的市場合約地址不匹配。這意味著 MarketFactory 合約的 setMarketContractAddress 調用存在問題。請檢查你的 MarketFactory.sol 代碼。");
    }
    console.log("==========================\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});