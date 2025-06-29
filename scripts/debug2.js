
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 'placeBet' 交易失敗原因深度偵錯腳本啟動...");

    // =========================================================
    //  配置區域：請填寫你在 e2e-test.js 中獲取的那個失敗的市場地址
    // =========================================================
    
    // 1. 填寫你的 e2e-test.js 腳本成功創建後，打印在終端里的那個 PredictionMarket 地址
    const predictionMarketAddress = "0xc970A39dbef841F6ca6bE931c3ccC9a95076648d";
    const [signer] = await ethers.getSigners();
    console.log(`偵錯將使用錢包: ${signer.address}`);

    // =========================================================
    //  偵錯流程開始
    // =========================================================

    console.log(`\n1. 正在連接到目標 PredictionMarket 合約於: ${predictionMarketAddress}`);
    
    // 我們需要 ABI 來與合約對話，Hardhat 會在編譯後自動生成
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    const marketContract = PredictionMarket.attach(predictionMarketAddress);

    // --- 核心偵錯邏輯：嘗試執行失敗的交易並捕獲詳細錯誤 ---
    console.log("\n🔬 正在嘗試執行 placeBet(0) 交易...");
    try {
        const placeBetTx = await marketContract.connect(signer).placeBet(0, {
            value: ethers.parseEther("0.01"),
            gasLimit: 500000 
        });
        console.log("⏳ 等待交易確認...");
        await placeBetTx.wait();
        console.log("✅ 奇怪... 這次交易竟然成功了！Tx Hash:", placeBetTx.hash);
        console.log("這可能意味著之前的失敗是網絡延遲問題（例如消費者授權未同步），現在已經解決。");

    } catch (error) {
        console.error("\n❌ 交易失敗，已捕獲到錯誤！正在解析原因...");

        // 檢查錯誤對象中是否包含 'data' 字段，它通常包含了 ABI-encoded 的 revert reason
        if (error.data) {
            try {
                // 使用合約的 ABI 來解析這個錯誤數據
                const decodedError = marketContract.interface.parseError(error.data);
                
                if (decodedError) {
                    console.log(`\n   ✅ 解碼後的 Revert 原因: ${decodedError.name}`);
                    console.log(`   ➡️  錯誤參數:`, decodedError.args);
                    console.log("\n   💡 請檢查你的 PositionNFT.sol 或 PredictionMarket.sol 合約中與此錯誤相關的 require 語句。");
                } else {
                    console.log("\n   🤔 無法使用 ABI 解碼 revert reason，但這裡有原始數據 (error.data):", error.data);
                    console.log("   💡 這通常意味著 revert 是在一個沒有提供自定義錯誤的底層庫（如OpenZeppelin）中發生的。");
                }
            } catch (decodeError) {
                console.error("\n   🔥 解析錯誤數據時發生了另一個錯誤:", decodeError.message);
                console.log("   原始錯誤數據 (error.data):", error.data);
            }
        } else {
            console.log("\n   🤔 錯誤對象中沒有包含可供解析的 'data' 字段。");
            console.log("   以下是完整的錯誤對象，請檢查 'reason' 或 'message' 字段:");
            console.log(error);
        }
    }
}

main().catch((error) => {
    console.error("腳本執行出錯:", error);
    process.exitCode = 1;
});
