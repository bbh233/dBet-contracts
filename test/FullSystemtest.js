const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("dBet Full System with VRF Mock", function () {
    // 全局变量
    let marketFactory;
    let vrfCoordinatorMock;
    let resolver, creator, userA, userB;
    let marketContract;

    const question = "Final Test?";
    const optionNames = [ethers.encodeBytes32String("Yes"), ethers.encodeBytes32String("No")];
    const nftName = "Final NFT";
    const nftSymbol = "FNFT";
    // sepolia测试网的Key Hash
    const keyHash = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";

        this.beforeEach(async function () {
        // 1. 获取测试账户
        [resolver, creator, userA, userB] = await ethers.getSigners();

        // 2. 部署 VRF 模拟合约 (VRFCoordinatorV2Mock)
        const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");

        // baseFee 和 gasPriceLink 是模拟 VRF 调用费用的参数
        vrfCoordinatorMock = await VRFCoordinatorV2Mock.deploy(
            ethers.parseUnits("0.25", "ether"),     //  baseFee
            ethers.parseUnits("1", "gwei")          //  gasPriceLink
        )

        // 3. 在 Mock 上创建一个 VRF 订阅
        const tx = await vrfCoordinatorMock.createSubscription();
        const receipt = await tx.wait();
        // 获取交易事件的一个参数 subId
        const subscriptionId = receipt.logs[0].args.subId;

        // 4.部署我们的 MarketFactory 合约
        const MarketFactory = await ethers.getContractFactory("MarketFactory");
        marketFactory = await MarketFactory.deploy(
            resolver.address,
            await vrfCoordinatorMock.getAddress(),
            subscriptionId,
            keyHash
        );

        // 5.使用工厂创建一个合约
        const createMarketTx = await marketFactory.connect(creator).createMarket(
            question,
            optionNames,
            nftName,
            nftSymbol
        );
        const marketReceipt = await createMarketTx.wait();
        const marketAddress = marketReceipt.logs.find(log => log.eventName === 'MarketCreated').args.marketAddress;

        // 6.连接到新创建的市场合约
        const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
        marketContract = PredictionMarket.attach(marketAddress);

        // 7.为订阅充值 (模拟Link代币)
        await vrfCoordinatorMock.fundSubscription(subscriptionId, ethers.parseEther("10"));

        // 8.将我们的市场合约添加为该订阅的合法消费者
        await vrfCoordinatorMock.addConsumer(subscriptionId, marketAddress);
    });

    it("应该完成下注、结算和彩票抽奖的完整流程", async function () {
        // --- 阶段1: 用户下注 ---
        // userA 下注 2 ETH, userB 下注 1 ETH
        // 2% 手续费， 即 A 贡献 0.04ETH到彩票池， B 贡献 0.02ETH
        await marketContract.connect(userA).placeBet(0, { value: ethers.parseEther("2.0")});
        await marketContract.connect(userB).placeBet(1, { value: ethers.parseEther("1.0")});

        // 验证彩票池总额
        expect(await marketContract.lotteryPrizePool()).to.equal(ethers.parseEther("0.06"));

        // --- 阶段2: 市场结算 & 触发 VRF 请求 ---
        // resolver 报告选项0 ("Yes") 获胜， 此操作会自动触发彩票抽奖请求
        const resolveTx = await marketContract.connect(resolver).reportResult(0);

        // 从事件中捕获 VRF 请求ID
        const resolveReceipt = await resolveTx.wait();
        const requestId = resolveReceipt.logs.find(log => log.eventName === 'RequestedLotteryWinner').args.requestId;
        expect(requestId).to.be.gt(0);  // requestId应该大于0, 这一步是为了告诉我们请求是成功的

      // --- 阶段3: 模拟VRF回调 & 验证中奖者 ---
        const lotteryPrize = await marketContract.lotteryPrizePool();
        // 我们想要返回的“随机数”。我们可以选择任何数字来测试逻辑。
        // 选择 1 来确保落在 userA 的份额区间内。
        const mockRandomWords = [1];

        // 手动调用Mock合约的 fulfillRandomWordsWithOverride 函数，
        // 传入我们指定的随机数，来模拟Chainlink将结果送回。
        const fulfillTx = vrfCoordinatorMock.fulfillRandomWordsWithOverride(
            requestId,
            await marketContract.getAddress(),
            mockRandomWords
        );

        

        // 验证中奖者的余额变化
        await expect(fulfillTx)
        .to.changeEtherBalance(userA, lotteryPrize);
        // changeEtherBalance在模拟回调这种复杂的交互时可能不直接工作
        // 但我们可以通过事件来确认逻辑
        
        await expect(fulfillTx).to.emit(marketContract, "LotteryWinnerPicked");

        // 验证中奖者是否是我们预期的 userA
        const winner = await marketContract.lastLotteryWinner();
        expect(winner).to.equal(userA.address);

        // 验证彩票池是否已清空
        expect(await marketContract.lotteryPrizePool()).to.equal(0);
    });

})