const { expect } = require("chai");
const { ethers } = require("hardhat");

// descript 是测试用例(套件)的容器，用于组织测试套件
// 可以理解为装东西的，就是装测试用例
// 通常分为内外层结构，方便高效地组织测试用例
// 外层是装载整个测试主题的所有测试用例，或者说是对要测试主题的一个描述
// 内层用于分功能场景对测试用例进行逻辑分组，知道具体分组是负责什么模块的测试的
describe("PositionNFT", function () {
    // 为测试用例准备一些全局变量
    let PositionNFT;
    let positionNFT;
    let owner;
    let marketContract;
    let otherAccount;
    const nftName = "dBet Postion";
    const nftSymbol = "DBP";

    // 'beboreEach' 是一个钩子函数, 在每个 "it" 测试用例运行前都会执行一次
    // 这能确保每个测试都在一个干净、 独立的环境中运行
    // async 声明这个函数有需要等待的操作
    // 这里的等待是假装在等，就是后台会执行一些其他操作，你可以同时进行一些操作                                
    // await是阻塞当前函数的执行，不影响其他函数
    this.beforeEach(async function () {
        // 获取签名者账户，ethers 会提供多个测试账户
        [owner, marketContract, otherAccount] = await ethers.getSigners();

        // 获取 PositionNFT的工厂实例
        PositionNFT = await ethers.getContractFactory("PositionNFT");
        
        // 部署合约实例 ，并传入构造函数所需的参数
        positionNFT = await PositionNFT.deploy(nftName, nftSymbol);
       
        // 上面是返回合约地址，但合约不一定已部署完成 这里是等待合约部署完成
        await positionNFT.waitForDeployment();
    });

    // --- 部署测试 ---
    // describe("Deployment", function () {
    //     it("应该设置正确的名称、代号和拥有者", async function() {
    //         // 使用expect 断言来验证合约状态
    //         expect(await positionNFT.name()).to.equal(nftName);
    //         expect(await positionNFT.symbol()).to.equal(nftSymbol);
    //         expect(await positionNFT.owner()).to.equal(owner.address);
    //     });
    // });

    describe("Deployment", function () {
        it("应该设置正确的名称、代号和拥有者", async function () {
            // 使用 expect 断言来验证合约状态
            expect(await positionNFT.name()).to.equal(nftName);
            expect(await positionNFT.symbol()).to.equal(nftSymbol);
            expect(await positionNFT.owner()).to.equal(owner.address);
        });
    });

    // --- 权限和访问控制测试 ---
    describe("Access Control", function() {
        it("应该允许 owner 设置 marketAddress", async function () {
            await positionNFT.connect(owner).setMarketContractAddress(marketContract.address);
            expect(await positionNFT.marketContractAddress()).to.equal(marketContract.address);
        });

        it("应该阻止非 owner 设置 marketContractAddress", async function () {
            // 我们期望这个交易会被回滚，并带有 'OwnableUnauthorizedAccount' 错误
            // 我断言通过other账户调用setMarketContractAddress()函数时合约会主动抛出一个自定义错误OwnableUnauthorizedAccount，且这个错误会附带参数
            await expect(
                positionNFT.connect(otherAccount).setMarketContractAddress(marketContract.address)
            ).to.be.revertedWithCustomError(positionNFT, 'OwnableUnauthorizedAccount'                
            ).withArgs(otherAccount.address);
        });

        it("应该阻止第二次设置 marketContractAddress", async function () {
            // 期望交易被回滚，并带有我们自定义的 require 错误信息
            await positionNFT.connect(owner).setMarketContractAddress(marketContract.address);
            await expect(positionNFT.connect(owner).setMarketContractAddress(marketContract.address)
        ).to.be.revertedWith("Market contract address can only be set once!");            
        });
    });

    // --- 核心功能测试 ---
    describe("Minting and URI Management", function () {
        const initiaURI = "ipfs://initial";

        // 在这组测试前，先设置好 marketContractAddress
        // 外层初始化公共资源 内层覆盖特点设置
        this.beforeEach(async function () {
            await positionNFT.connect(owner).setMarketContractAddress(marketContract.address);
        });

        it(" 应该阻止非 marketContract 地址进行铸造", async function () {
            // 使用一个非 marketContract 的账户 (比如owner 或者 otherAccount) 调用
            await expect(
                positionNFT.connect(otherAccount).safeMint(otherAccount.address, initiaURI
                )).to.be.revertedWithCustomError(positionNFT, "NotMarketContract"); 
        });

        it("应该只允许 marketContract 地址铸造并设置正确的 URI", async function() {
            // 使用 marketContract 账户调用
            const mintTx = await positionNFT.connect(marketContract).safeMint(otherAccount.address, initiaURI);
            // 确保上链更改状态，在hardhat中可能因为确认过快而不需要这个
            mintTx.wait();

            // 验证 tokenId 0 被铸造给了 otherAcount
            expect(await positionNFT.ownerOf(0)).to.equal(otherAccount.address);
            // 验证 tokenId 0 的元数据地址
            expect(await positionNFT.tokenURI(0)).to.equal(initiaURI);

            // 验证交易事件
            await expect(mintTx)
                .to.emit(positionNFT, "Transfer")
                .withArgs(ethers.ZeroAddress, otherAccount.address, 0);
        });

        it("应该阻止非 marketContract 地址更新 URI", async function(){
            // 先铸造一个 token
            await positionNFT.connect(marketContract).safeMint(otherAccount.address, initiaURI);

            const newURI = "ipfs://updated";
            await expect(
                positionNFT.connect(otherAccount).updateTokenURI(0, newURI)
            ).to.be.revertedWithCustomError(positionNFT, "NotMarketContract");
        });

        it("应当只允许 marketContract 地址更新 URI", async function() {
            //  先铸造
            await positionNFT.connect(marketContract).safeMint(otherAccount.address, initiaURI);

            const newURI = "ipfs://updated";
            const updateTx = await positionNFT.connect(marketContract).updateTokenURI(0, newURI);
            updateTx.wait();

            // 验证 URI 是否已更新
            expect(await positionNFT.tokenURI(0)).to.equal(newURI);

            // 验证是否触发了 URIUpdated 事件
            await expect(updateTx)
                .to.emit(positionNFT, "URIUpdated")
                .withArgs(0, newURI);
        });

        it("查询不存在的tokenId 应该失败", async function () {
            await expect (
                positionNFT.tokenURI(999)
        ).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token ");
        });
    });

});