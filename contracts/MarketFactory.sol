// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PredictionMarket.sol";
import "./PositionNFT.sol";


/**
 * @title MarketFactory
 * @dev 用于创建和追踪所有 PredictionMarket 实例的工厂合约
 */
contract MarketFactory {
    // 状态变量
    address public immutable marketOwner; // 所有被创建市场的裁决者地址
    address[] public allMarkets;    // 存储所有被部署的市场合约地址
    /// Chainlink VRF v2 参数 , 在工厂部署时一次性设定 并 将作为模板传递给每个新市场
    address private immutable i_vrfCoordinatorV2;   // Sepolia VRF 合约地址 
    uint256 private immutable i_subscriptionId;      // 你的订阅ID
    bytes32 private immutable i_keyHash;            // Gas 层级
    /// Chainlink Functions 参数 , 在工厂部署时一次性设定 并 将作为模板传递给每个新市场
    address private immutable i_functionsRouter;
    bytes32 private immutable i_donId;
    uint64 private immutable i_subscriptionId_functions;
    string private sourceCode;      // 存储 Functions 的JS脚本源码
    string private baseMetadataURI; // 新增

    // 事件
    event MarketCreated(
        address indexed marketAddress,      // 新创建的市场合约地址
        address indexed creator,            // 调用创建函数的用户地址
        string question                     // 市场的预测问题
    );
    
    /** 
     * @dev 用于初始化 工厂合约  
     */
    constructor(
        address _marketOwner,
        address _vrfCoordinatorV2,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        address _functionsRouter,
        bytes32 _donId,
        uint64 _subscriptionIdFunctions,
        string memory _sourceCode,
        string memory _baseMetadataURI 
        ) {
            require(_marketOwner != address(0), "Owner address cannot be zero");
            marketOwner = _marketOwner; // 指定裁决人地址
            i_vrfCoordinatorV2 = _vrfCoordinatorV2; // 指定Sepolia Chainlink VRF 合约地址
            i_subscriptionId = _subscriptionId;     // 指定你的订阅 ID(支付费用的订阅账户)
            i_keyHash = _keyHash;                   // 指定你使用的Gas价格层级(决定Gas费用的参数)

            // ``` 初始化Functions配置 ```
            i_functionsRouter = _functionsRouter;
            i_donId = _donId;
            i_subscriptionId_functions = _subscriptionIdFunctions;
            sourceCode = _sourceCode;
            baseMetadataURI = _baseMetadataURI;
    }

    /**
     * @dev 任何人都可以调用此函数来创建一个新的预测市场
     * @param _question 预测的问题
     * @param _optionNames 选项名称数组(例如 ["Yes", "No"])
     * @param _nftName NFT的名称
     * @param _nftSymbol NFT的代号
     * @return newMarketAddress 新创建的市场合约地址
     */
    function createMarket(
        string memory _question,
        bytes32[] memory _optionNames,
        string memory _nftName,
        string memory _nftSymbol
    ) external returns(address) {
        // 1. 为这个新市场部署一个全新的 PositionNFT 合约
        // 新NFT合约的所属者是本工厂合约，以便后续设置 marketContractAddress
        PositionNFT newNftContract = new PositionNFT(_nftName, _nftSymbol, baseMetadataURI);

        // 2. 为这个新市场部署一个全新的 PredictionMarket 合约
        // 将所有必要的配置传入其构造函数
        PredictionMarket newMarket = new PredictionMarket(
            _question,
            _optionNames,
            address(newNftContract),
            marketOwner, // 将裁决权赋予预设的 marketOwner
            i_vrfCoordinatorV2,
            i_subscriptionId,
            i_keyHash,
            i_functionsRouter,
            i_donId,
            i_subscriptionId_functions,
            sourceCode
        );

        // 3. 关键步骤: 授权新的 PredictionMarket 合约去操作它的 NFT 合约
        // 因为本工厂是 newNFTContract 的 owner, 所以有权调用此函数
        newNftContract.setMarketContractAddress(address(newMarket));

        // 4. 将新市场地址记录下来
        address newMarketAddress = address(newMarket);
        allMarkets.push(newMarketAddress);

        // 5. 触发事件，方便前端索引
        emit MarketCreated(newMarketAddress, msg.sender, _question);

        return newMarketAddress;
    }

    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }
}