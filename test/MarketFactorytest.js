const {expect} = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// 测试套件: MarketFactory
describe("MarketFactory", function () {
    // 全局变量
    let MarketFactory, marketFactory;
    let vrfCoordinatorMock;
    // 用于后续连接到被创建的合约
    let PredictionMarket;

    // 工厂铸造者 裁决者 市场创建者 用户A 用户B
    let owner, resolver, creator, userA, userB;
    const question = "Will price of ETH reach $5000 by end of year?";

    // 我们需要把字符串选项转换为 bytes32 格式
    // solidity 处理固定长度的数据类型 如bytes32 比处理动态长度的字符串(string便宜的多)
    // 这里传递参数需要满足类型匹配，所以进行转换
    const optionNames = [ethers.encodeBytes32String("Yes"), ethers.encodeBytes32String("No")];

    const nftName = "Test NFT";
    const nftSymbol = "TNFT";
    // sepolia测试网的Key Hash
    const keyHash = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";

    // 在每个测试用例前执行
    this.beforeEach(async function() {
        // 获取测试账户
        [owner, resolver, creator, userA, userB] = await ethers.getSigners();

        // // 获取抽象工厂对象 指定后续 MarketFactory 由 owner 部署 等同于 getContractFactory("MarketFactory").connect(owner)
        // MarketFactory = await ethers.getContractFactory("MarketFactory", owner);
        // // 在部署 MarketFactory 实例时，我们指定 'resolver' 账户作为所有市场的裁决者 
        // marketFactory = await MarketFactory.deploy(resolver.address);
        // marketFactory.waitForDeployment();

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


        // 获取 PredictionMarket 的工厂实例，以便后续附加到地址上
        PredictionMarket = await ethers.getContractFactory("PredictionMarket", owner);
    });


    // --- 工厂部署与市场创建测试 ---
    describe("Factoryh and Market Creation", function() {
        it("工厂应该设置正确的裁决者地址", async function () {
            expect(await marketFactory.marketOwner()).to.equal(resolver.address);
        });

        it("任何人都可以成功创建一个市场", async function() {
            // 模拟 'creator' 账户来调用 createMarket
            const createTx = await marketFactory.connect(creator).createMarket(
                question,
                optionNames,
                nftName,
                nftSymbol
            );

            await expect(createTx).to.emit(marketFactory, "MarketCreated").withArgs(anyValue, creator.address, question);

            // 验证新市场是否被添加到 allMarkets 数组中
            const allMarkets = await marketFactory.getAllMarkets();
            expect(allMarkets.length).to.equal(1);

            // // 模拟 'userA' 账户来调用 createMarket
            // const userATx = await marketFactory.connect(userA).createMarket(
            //     question,
            //     optionNames,
            //     nftName,
            //     nftSymbol
            // );

            // // 模拟 'userB' 账户来调用 createMarket
            // const userBTx = await marketFactory.connect(userB).createMarket(
            //     question,
            //     optionNames,
            //     nftName,
            //     nftSymbol
            // )
        });

        it("被创建的市场应该有正确的裁决者 (owner)", async function() {

            // 创建市场
            await marketFactory.connect(creator).createMarket(
                question,
                optionNames,
                nftName,
                nftSymbol
            );

            // 获取新创建市场地址
            const marketAddress = (await marketFactory.getAllMarkets())[0]

            // 将 PredictionMarket 的 ABI 附加到这个新地址上， 以便与之交互
            const marketContract = PredictionMarket.attach(marketAddress);

            // 验证这个市场的拥有者是我们预设的 'resolver'
            expect(await marketContract.marketResolverAddress()).to.equal(resolver.address);
        });
    });


    // --- 完整的市场生命周期测试 ---
    describe("Full Market Lifecycle", function () {
        // let marketContract;
        // let marketAddress;

        // 在这组测试前, 先创建一个市场实例
        this.beforeEach(async function () {
            const createTx = await marketFactory.connect(creator).createMarket(
                question,
                optionNames,
                nftName,
                nftSymbol
            );
            
            
            // 从事件中获取新市场的地址 (更精确的方式)
            // wait 等待上链成功 且 返回一个收据
            const recepit = await createTx.wait();
            marketAddress = recepit.logs.find(log => log.eventName === "MarketCreated").args[0];
            
            // 连接到这个新创建的市场合约
            marketContract = PredictionMarket.attach(marketAddress);

        });

        it("用户应该可以成功下注", async function () {


            // 将 ETH 单位 从 ether => wei
            const betAmount = ethers.parseEther("1.0");

            // 模拟 userA 下注到选项 0 ("Yes")
            expect(await marketContract.connect(userA).placeBet(0, {value : betAmount})
        ).to.emit(marketAddress, "BetPlaced")
         .withArgs(userA.address, 0, betAmount - ethers.parseEther("0.02"), betAmount - ethers.parseEther("0.02"));

            // 验证合约状态
            const option = (await marketContract.connect(userA).options(0));
            expect(option.totalPool).to.equal(betAmount - ethers.parseEther("0.02"));
            expect(await marketContract.connect(userA).totalPool()).to.equal(betAmount - ethers.parseEther("0.02"));
            expect(await marketContract.connect(userA).shares(userA.address, 0)).to.equal(betAmount - ethers.parseEther("0.02"));

        });


        it("裁决者应该可以报告结果，非裁决者则不能", async function() {
            // 模拟非裁决者 (如创建者 creator) 尝试报告结果,应该失败
            await expect(
                marketContract.connect(creator).reportResult(0)
            ).to.be.revertedWithCustomError(marketContract, 'OwnableUnauthorizedAccount');

            // 模拟正确的裁决者 'resolver' 报告结果, 应该成功
            await expect(marketContract.connect(resolver).reportResult(0))
                .to.emit(marketContract, "MarketResolved")
                .withArgs(0);
            
            expect(await marketContract.isResolved()).to.be.true;
            expect(await marketContract.winningOptionIndex()).to.equal(0);
        });

        it("胜利者应该可以按照比例领取奖金", async function () {
            const betAmountA = ethers.parseEther("2.0");    // userA 投 2ETH 到 YES (选项0)
            const betAmountB = ethers.parseEther("1.0");    // userB 投 1ETH 到 NO (选项1)

            // 下注
            await marketContract.connect(userA).placeBet(0, { value: betAmountA});
            await marketContract.connect(userB).placeBet(1, { value: betAmountB});

            const lotteryPrizePool = marketContract.lotteryPrizePool();

            // 总资金池 = 3ETH - 0.06
            expect(await marketContract.totalPool()).to.equal(ethers.parseEther("3.0"));

            // 裁决结果: 选项 0 ("YES") 获胜
            await marketContract.connect(resolver).reportResult(0);

            // 获胜者 userA 领取奖金
            const claimTx = await marketContract.connect(userA).claimWinnings();

            // 验证 userA 的余额变化
            // 它应该赢得全部 3ETH 奖金

            await expect(claimTx).to.changeEtherBalance(userA, ethers.parseEther("3.0"));

            // 失败者 userB 尝试领取奖金，应该失败
            await expect(
                marketContract.connect(userB).claimWinnings()
            ).to.be.revertedWith("You have no shares in the winning option");
            
        });
    });
})