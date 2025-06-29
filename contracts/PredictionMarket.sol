// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 引入 functions 相关的合约接口
// 引入 Functions 相關的合約接口
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";


// 引入我们原有的合约
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PositionNFT.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
// import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";


interface IVRFCoordinatorV2_5 {
    function requestRandomWords(
        bytes32 keyHash,
        uint256 subId, // <<< Correct type is uint256
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);
}

// 接口來獲取 PositionNFT 的 totalSupply
interface IPositionNFT {
    function totalSupply() external view returns (uint256);
}


/**
 * @title PredictionMarket
 * @dev 管理单个预测事件的核心合约
 */
contract PredictionMarket is Ownable, VRFConsumerBaseV2, FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    // ===========  状态变量 ==========

    struct Option {
        bytes32 name;       // 选项名称 例如 Yes or No
        uint256 totalPool;  // 该选项的总资金池
    }

    // 市场关联的 dNFT 合约实例
    PositionNFT public immutable positionNFT;

    // 市场预测的问题
    string public question;

    // 市场的选项
    Option[] public options;

    // 市场的总资金池
    uint256 public totalPool;
    
    // 市场是否已经结算
    bool public isResolved;

    // 获胜选项的索引
    uint256 public winningOptionIndex;

    // 裁决者的地址
    address public immutable marketResolverAddress;

    // 映射: 用户地址 => 选项索引 => 用户在该选项下的份额
    mapping(address => mapping(uint256 => uint256)) public shares;
    

    // ============ Lottery 状态变量  (集成) ============
    uint256 public constant LOTTERY_FEE_BPS = 200;  // 200 BPS = 2%;
    uint256 public lotteryPrizePool;                // 此市场专属彩票的奖池总额
    address[] private lotteryParticipants;          // 存储独立的参与者地址
    mapping(address => uint256) private participantLotteryShares;   // 每个参与者的彩票份额
    address public lastLotteryWinner;               // Lucky dog

    // ============ Chainlink VRF 状态变量 (集成) ============
    IVRFCoordinatorV2_5 private immutable i_vrfCoordinator;
    uint256 private immutable i_subscriptionId;
    bytes32 private immutable i_keyHash;                    
    uint32 private constant CALLBACK_GAS_LIMIT = 100000;            // 回调函数限定的GAS上限
    uint16 private constant REQUEST_CONFIRMATIONS = 3;              // 等待多少个区块确认后再生成随机数
    uint32 private constant NUM_WORDS = 1;                          // 请求的随机数数量

    // ============ Chainlink Functions 变量 (集成)============
    // address private immutable i_functionsRouter;
    bytes32 private immutable i_donId;
    uint64 private immutable i_subscriptionId_functions;
    string private sourceCode;      // 存储 Functions 的JS脚本源码
    

    // ============ 事件 =============

    /**
     * @dev 用于记录下注
     * @param user 下注用户
     * @param optionIndex 下注选项的索引
     * @param amount 下注的数额
     * @param shares 用户在该选项下注获得的份额 
     * amount => shares 相当于筹码的转换
     */
    event BetPlaced(
        address indexed user,
        uint256 indexed optionIndex,
        uint256 amount,
        uint256 shares
    );

    /**
     * @dev 用于记录市场结束
     * @param winningOptionIndex 胜利选项的索引 
     * @param lastRequestId Function 请求ID
     */
    event MarketResolved(uint256 indexed winningOptionIndex, uint256 lastRequestId);

    /**
     * @dev 用于记录奖励领取
     * @param user 用户
     * @param amount 份额
     */
    event WinningsClaimed(address indexed user, uint256 amount);


    /** 
     * @dev 选出 Lucky dog
     * @param winner Lucky dog
     * @param prizeAmount 中彩金额
     */
    event LotteryWinnerPicked(address indexed winner, uint256 prizeAmount);



    /**
     * @dev 还不知道这个是干什么的
     */

    event RequestedLotteryWinner(uint256 indexed requestId);

    /**
     * @dev 发送 Functions 请求
     */
    
    event FunctionsRequestSent(bytes32 indexed id);
    
    /**
     * @dev 接收 Functions 响应
     */
    event FunctionsResponseReceived(bytes32 indexed id, uint256 response);

    // =============== 自定义错误 ================
    
    error NotMarketResolver();

    // error OwnableUnauthorizedAccount();


    // =============== Modifier ================

    /**
     * @dev 限制只有 Resover 才可以调用
     */

    modifier onlyResolver() {
        if(msg.sender != marketResolverAddress) {
            revert PositionNFT.OwnableUnauthorizedAccount(msg.sender);
        }
        _;
    }

    // =============== constructor ==================

    /**
     * @dev 用于初始化一个预测市场
     * @param _question 预测的问题
     * @param _optionNames 选项名称的数组 (bytes32 格式)
     * @param _positionNFTAddress 关联的 PostionNFT 合约地址
     * @param _marketResolverAddress 市场裁决人的地址
     * @param _vrfCoordinatorV2  Sepolia Chainlink VRF 合约地址
     * @param _subscriptionId    支付费用的订阅账户
     * @param _keyHash           使用的GAS价格层级
     * @param _functionsRouter   Sepolia Chainlink Functions 合约地址
     * @param _donId            指定使用哪个Chainlink的去中心化预言机网络(不同网络可能有不同费用或性能)
     * @param _subscriptionIdFunctions  // 支付费用的订阅账户
     * @param _sourceCode               // JS脚本源码sourceCode

     */
    constructor(
        string memory _question,
        bytes32[] memory _optionNames,
        address _positionNFTAddress,
        address _marketResolverAddress,
        address _vrfCoordinatorV2,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        address _functionsRouter,
        bytes32 _donId,
        uint64 _subscriptionIdFunctions,
        string memory _sourceCode

    ) Ownable() VRFConsumerBaseV2(_vrfCoordinatorV2) FunctionsClient(_functionsRouter){
        // ``` 初始化市场和VRF配置 ```
        require(_optionNames.length == 2, "Market must have exactly two option for MVP");
        question = _question;
        positionNFT = PositionNFT(_positionNFTAddress);
        marketResolverAddress = _marketResolverAddress;

        i_vrfCoordinator = IVRFCoordinatorV2_5(_vrfCoordinatorV2);
        i_subscriptionId = _subscriptionId;
        i_keyHash = _keyHash;

        // ``` 初始化Functions配置 ```
        // i_functionsRouter = _functionsRouter;
        i_donId = _donId;
        i_subscriptionId_functions = _subscriptionIdFunctions;
        sourceCode = _sourceCode;



        for(uint256 i = 0; i < _optionNames.length; i++) {
            // 指定字段初始化结构体对象
            options.push(Option({name: _optionNames[i], totalPool: 0}));
        }
    }

    // =============  外部写入函数 =============

    /** 
     * @dev 用于处理下注
     * @param _optionIndex 用户下注的选项索引 (0 或 1) 
     */
    function placeBet(uint256 _optionIndex) external payable {
        require(!isResolved, "Market is already resolved");
        require(_optionIndex < options.length && _optionIndex >= 0, "Invalid option index");
        require(msg.value > 0, "Bet amount must be greater than 0");

        // 用户支付的总金额 单位是 wei
        uint256 amount = msg.value;

        // 计算彩票费用和实际下注额
        uint256 lotteryFee = (amount * LOTTERY_FEE_BPS) / 10000;
        // 剩余的资金才是实际下注额
        uint256 netBetAmount = amount - lotteryFee;

        // 更新彩票池
        if(lotteryFee > 0) {
            // 彩票池增加
            lotteryPrizePool += lotteryFee;
            // 添加下注用户到彩票用户中
            if(participantLotteryShares[msg.sender] == 0) {
                lotteryParticipants.push(msg.sender);
            }
            // 更新用户彩票份额
            participantLotteryShares[msg.sender] += lotteryFee;
        }

        // MVP 模型: 1wei = 1shar.
        // 在真实模型中，这里的份额计算会更加复杂
        uint256 sharesPurchased = netBetAmount;

        // 更新状态
        // options[_optionIndex].totalPool += amount;
        options[_optionIndex].totalPool += netBetAmount;
        // totalPool += amount;
        totalPool += netBetAmount;
        //bool isFirstBetOnOption = (shares[msg.sender][_optionIndex] == 0);
        shares[msg.sender][_optionIndex] += sharesPurchased;

        // 如果这是用户第一次对该选项下注，为他铸造一张 dNFT
        // 注意: 我们为每个用户在每个选项上只铸造一张NFT，后续下注只增加份额
        // 只有第一次用户已下注的金额会等于下注金额
        if (shares[msg.sender][_optionIndex] == sharesPurchased) {
            // 这里我们可以硬编码一个初始的URI，或者从一个辅助合约获取
            // 简单起见,我们暂时留空，因为动态URI主要由后端处理

            positionNFT.safeMint(msg.sender, _optionIndex);
        }

        emit BetPlaced(msg.sender, _optionIndex, amount, sharesPurchased);
    }

      /**
     * @dev 由裁決者調用，通過 Chainlink Functions 非同步地報告市場結果。
     */
    // FIX: 移除了不匹配的 @param 註釋
    // function reportResult(uint256 _winningOptionIndex) external onlyResolver {
    function reportResult() external onlyResolver {
        require(!isResolved, "Market is already resolved");
        // require(_winningOptionIndex < options.length && _winningOptionIndex >= 0, "Invalid winning option index");

        // isResolved = true;
        // winningOptionIndex = _winningOptionIndex;

        // // 最终的链上更新逻辑可以在这里触发
        // // 但为了节省 GAS, 更优的做法是后端在解析元数据的时候直接提供最终状态
        // // emit 事件是通知链下系统结果的最佳方式

        // emit MarketResolved(_winningOptionIndex);

        // // 市场结算后, 立即开始抽奖
        // if (lotteryParticipants.length > 0 && lotteryPrizePool > 0) {
        //     // 向chainlink发出请求，索要一个随机数
        //     uint256 requestId = i_vrfCoordinator.requestRandomWords(i_keyHash, i_subscriptionId, REQUEST_CONFIRMATIONS, CALLBACK_GAS_LIMIT, NUM_WORDS);
        //     emit RequestedLotteryWinner(requestId);
        // }


        // 准备 Functions 请求
        FunctionsRequest.Request memory req;
        
        // 使用內聯源碼初始化請求
        req.initializeRequestForInlineJavaScript(sourceCode);
       
        // 将本合约的地址作为参数传递给 JS 脚本
        string[] memory args = new string[](1);
        args[0] = addressToString(address(this));
        req.setArgs(args);

        // 发送请求 并获取请求ID
        bytes32 requestId = _sendRequest(req.encodeCBOR(), i_subscriptionId_functions, 300000, i_donId);
        emit FunctionsRequestSent(requestId);
    }

    /**
     * @dev 报告市场结果。 在MVP中，只有合约所有者可以调用
     * 在生产环境中，这应该由一个去中心化的预言机(如 chainlink) 调用。
     * 在这里改为只有裁决人才可以裁定结果 将创建市场的权限和裁定市场结果的权限进行分离
     */
     function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override{
        
        if(err.length > 0) {
            // 如果 Functions 执行出错，这里可以添加处理逻辑
            revert("Functions request failed");
        }
        // 解码返回的结果
        uint256 _winningOptionIndex = abi.decode(response, (uint256));

        // 更新合约状态
        isResolved = true;
        winningOptionIndex = _winningOptionIndex;

        // 最终的链上更新逻辑可以在这里触发
        // 但为了节省 GAS, 更优的做法是后端在解析元数据的时候直接提供最终状态
        // emit 事件是通知链下系统结果的最佳方式

        // 触发事件
        emit MarketResolved(_winningOptionIndex, uint256(requestId));

        // 市场结算后, 立即开始抽奖
        if (lotteryParticipants.length > 0 && lotteryPrizePool > 0) {
            // 向chainlink发出请求，索要一个随机数
            uint256 vrfRequestId = i_vrfCoordinator.requestRandomWords(i_keyHash, i_subscriptionId, REQUEST_CONFIRMATIONS, CALLBACK_GAS_LIMIT, NUM_WORDS);
            emit RequestedLotteryWinner(vrfRequestId);
        }

     }

    /** 
     * @dev 用户领取奖金 
     */

    function claimWinnings() external {
        require(isResolved, "Market is not yet resolved");

        uint256 userShares = shares[msg.sender][winningOptionIndex];
        require(userShares > 0, "You have no shares in the winning option");

        uint256 totalWinningShares = options[winningOptionIndex].totalPool;
        uint payout = (totalPool * userShares) / totalWinningShares;

        // 将用户的份额清零，防止重复领取
        shares[msg.sender][winningOptionIndex] = 0;

        require(payout > 0, "Payout amount is zero");

        (bool sent, ) = msg.sender.call{value:payout}("");
        require(sent, "Failed to send Ether");

        emit WinningsClaimed(msg.sender, payout);
    }


    /**
     * @dev Chainlink VRF 回调函数 
     * 当Chainlink送回随机数时，会自动调用这个函数
     */

    function fulfillRandomWords(uint256, uint256[] memory _randomWords) internal override {
        if (lotteryParticipants.length == 0) {
            return;
        }

        // 总彩票数就是奖池金额
        uint256 totalShares = lotteryPrizePool;
        // 生成一张0到(总票数-1)之间的"中奖彩票号码"
        uint256 winningTicket = _randomWords[0] % totalShares;

        // 累计份额
        uint256 cumulativeShares = 0;
        // Lucky dog
        address winner;

        for (uint256 i = 0; i < lotteryParticipants.length; i++){
            address participant = lotteryParticipants[i];
            uint256 participantShares = participantLotteryShares[participant];
            cumulativeShares += participantShares;
            // 检查"中奖号码"是否落在当前这个人的"彩票区间"内
            // 如果是，这就是 Lucky dog！
            if (winningTicket <= cumulativeShares) {
                winner = participant;
                // 找到赢家，立即跳出循环，节省GAS
                break;
            }
        }

        if (winner != address(0)) {
            // 更新状态
            lastLotteryWinner = winner;
            uint256 prize = lotteryPrizePool;
            lotteryPrizePool = 0;
            (bool success, ) = winner.call{value: prize}("");
            if (success) {
                // 
                emit LotteryWinnerPicked(winner, prize);
            }
        }
    }

    // =============== 辅助函数 =================
    // 将地址转换成字符串，以便作为参数传给JS脚本
    function addressToString(address _addr) internal pure returns (string memory) {
        bytes32 _bytes = bytes32(uint256(uint160(_addr)));
        
        // 2. 定义十六进制字符表(0 - f)
        bytes memory HEX = "0123456789abcdef";
        
        // 3. 初始化输出字符串的内存空间 (42字节)
        bytes memory _string = new bytes(42);
        // 第一位固定为0
        _string[0] = '0';
        // 第二位固定为x
        _string[1] = 'x';

        for (uint i = 0; i < 20; i++){
            // 每一轮翻译两个字母，而0位 和 1位 已经被翻译了，所以从第2开始
            // * 2 是为了跳过前面两个字母的位置从新位置开始存放
            // bytes32 前12位是填充，所以从12开始
            // 原先是一个字节保存两个十六进制数，现在把它高四位低四位拆分，用两个字节表示
            // 一字节表示8位二进制，也可以表示为2位十六进制，合在一起是数字，拆开来就是两个字符
            _string[2 + i * 2] = HEX[uint8(_bytes[i + 12] >> 4)];
            _string[3 + i * 2] = HEX[uint8(_bytes[i + 12] & 0x0f)];
        }
        return string(_string);
    }

    function uintToString(uint256 value) internal pure returns (string memory) {
    if (value == 0) {
        return "0";
    }
    uint256 temp = value;
    uint256 digits;
    while (temp != 0) {
        digits++;
        temp /= 10;
    }
    bytes memory buffer = new bytes(digits);
    while (value != 0) {
        digits -= 1;
        buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
        value /= 10;
    }
    return string(buffer);
}
}
