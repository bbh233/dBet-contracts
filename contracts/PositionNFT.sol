// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol"; 
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title PositionNFT
 * @dev 这是代表用户在预测市场中头寸的动态NFT (dNFT)。
 * 它的URI可以被授权地址（市场合约）更新，以反映赔率和最终结果。
 */

contract PositionNFT is ERC721, Ownable { 

    // 相当于将 Counters 里面的方法绑定到 counter 结构体中
    using Counters for Counters.Counter;


    Counters.Counter private _tokenIdCounter;

    // 状态变量
    
    // 唯一有权铸造和更新此 NFT 系列的市场合约地址
    address public marketContractAddress;  

        // **核心修正**: 存儲後端 API 的基礎 URL
    string private baseMetadataURI;
    
    // tokenId => tokenURI 的映射
    mapping(uint256 => string) private _tokenURIs;

        // **核心修正**: 新增一個映射，記錄每個 tokenId 屬於哪個選項 (0 或 1)
    mapping(uint256 => uint256) public tokenOption;

    // 自定义错误，用于更清晰的权限控制
    /**
     * @dev 非授权合约错误
     */
    error NotMarketContract();

    /**
     * @dev 非授权合约错误
     */
    error OwnableUnauthorizedAccount(address);

    // 更新 Metadata 事件
    event URIUpdated(uint256 indexed tokenId, string newURI);

    // ===========  Modifiers =============
    /**
     * @dev 限制只有 marketContractAddress 才可以调用
     */

    modifier onlyMarketContract() {
        if (msg.sender != marketContractAddress) {
            revert NotMarketContract();
        }
        _;
    }

    // ===========  Constructor =============

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseMetadataURI
    ) ERC721(_name, _symbol)
      Ownable() {
        baseMetadataURI = _baseMetadataURI;
      } 

    /**
     * @dev 重写地址检查 用于自定义错误
     */
    function _checkOwner() internal view override {
        if(owner() != _msgSender()){
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
    * @dev 设置授权的市场合约地址。只能由合约所有者（部署者）调用一次。
    * @param _marketContractAddress 市场合约的地址
    */
    function setMarketContractAddress(address _marketContractAddress) external onlyOwner
    {
        require(marketContractAddress == address(0), "Market contract address can only be set once!");
        marketContractAddress = _marketContractAddress;
    }


    /**
     * @dev 铸造一个新的 dNFT 并分配给用户。
     * 只能由授权的市场合约调用。
     * @param _to  NFT接收者地址
     * @param  _optionIndex NFT接收者地址
     * @return  新铸造的NFT的 tokenId
     */
    function safeMint(address _to, uint256 _optionIndex)
        external
        onlyMarketContract
        returns (uint256)
    {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

               
        // **核心修正**: 在內部構建完整的 tokenURI
         // **核心修正**: 將 tokenURI 指向 PredictionMarket 合約，而不是自己
        // **核心修正**: 將 tokenURI 指向 PredictionMarket 合約，而不是自己
        string memory finalTokenURI = string(abi.encodePacked(
            baseMetadataURI, // "https://.../metadata/"
            addressToString(marketContractAddress), // <<< 指向 PredictionMarket
            "/",
            uintToString(tokenId)
        ));

        tokenOption[tokenId] = _optionIndex; // 記錄這個 token 屬於哪個選項

        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, finalTokenURI);

        emit URIUpdated(tokenId, finalTokenURI);
        return tokenId;
    }

    
    /**
    * @dev         更新一个现有的 dNFT Metadata
    * 这是实现"动态效果"的核心。只能由授权的市场合约调用
    * @param _tokenId   需要更新的 NFT的ID
    * @param _newURI    NFT元数据的新URI
    */
   function updateTokenURI(uint256 _tokenId, string memory _newURI)  external onlyMarketContract 
   {
        require(_exists(_tokenId), "ERC721Metadata: URI set for nonexistent token");
        _setTokenURI(_tokenId, _newURI);
        
        emit URIUpdated(_tokenId, _newURI);
   }

    // ===========  视图与内部函数 (View/Internal) =============
    /**
     * @dev 重写基类的 tokenURI 函数, 以从我们的自定义映射中返回 URI
     * 也就是返回 token 的 URI
     * @param _tokenId  NFT 的编号
     */
    
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(_tokenId), "ERC721Metadata: URI query for nonexistent token ");
        return _tokenURIs[_tokenId];
    }
    
    /**
     * @dev 内部函数, 用于设置一个 tokenId 的 URI
     */
     function _setTokenURI(uint256 _tokenId, string memory _uri) internal {
        _tokenURIs[_tokenId] = _uri;
     }

         function addressToString(address _addr) internal pure returns (string memory) {
        bytes32 _bytes = bytes32(uint256(uint160(_addr)));
        bytes memory HEX = "0123456789abcdef";
        bytes memory _string = new bytes(42);
        _string[0] = '0';
        _string[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            _string[2 + i * 2] = HEX[uint8(_bytes[i + 12] >> 4)];
            _string[3 + i * 2] = HEX[uint8(_bytes[i + 12] & 0x0f)];
        }
        return string(_string);
    }
    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) { return "0"; }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits -= 1; buffer[digits] = bytes1(uint8(48 + uint256(value % 10))); value /= 10; }
        return string(buffer);
    }
}