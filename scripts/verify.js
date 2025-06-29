const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("正在準備驗證參數...");

    // =========================================================
    //  配置區域：請確保這裡的參數與你部署時使用的完全一致
    // =========================================================

    // 1. 填寫你已經部署到 Sepolia 上的 MarketFactory 合約地址
    // 核心修正：移除了地址字符串開頭多餘的空格
    const deployedMarketFactoryAddress = "0x316190b1540657032f920d8D49a15a72d92f81f7";

    // 2. 準備與部署時完全相同的構造函數參數
    const marketResolverAddress = "0x765eB367E93583e67ADb25C957fa6c3B522cD51d";
    const vrfCoordinatorAddress = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
    const vrfSubscriptionId = "68362467706620433208024921084871692694332746430371723992145806061865827992673";
    const vrfKeyHash = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";

    const functionsRouterAddress = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";
    const functionsDonId = "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000";
    const functionsSubscriptionId = 5023;

    const sourceCode = fs.readFileSync(
        path.resolve(__dirname, "../backend/resolution-script.js"),
        "utf8"
    );

    // 將所有參數按順序放入一個數組
    const constructorArguments = [
        marketResolverAddress,
        vrfCoordinatorAddress,
        vrfSubscriptionId,
        vrfKeyHash,
        functionsRouterAddress,
        functionsDonId,
        functionsSubscriptionId,
        sourceCode,
    ];

    console.log("正在開始驗證...");

    try {
        await run("verify:verify", {
            address: deployedMarketFactoryAddress,
            constructorArguments: constructorArguments,
        });
        console.log("🎉 合約驗證成功！");
    } catch (error) {
        if (error.message.toLowerCase().includes("already verified")) {
            console.log("✅ 合約已經被驗證過了！");
        } else {
            console.error("驗證失敗:", error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
