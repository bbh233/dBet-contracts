// SPDX-License-Identifier: MIT
// This is an updated mock based on recent versions of @chainlink/contracts.
// It is compatible with Solidity ^0.8.19 and later versions of the library.
pragma solidity ^0.8.19;

import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

contract VRFCoordinatorV2Mock is VRFCoordinatorV2Interface {
    error InvalidSubscription();
    error InsufficientBalance();
    error InvalidConsumer();
    error MustBeSubOwner();
    error TooManyConsumers();
    error InvalidArguments();
    error ProvingKeyAlreadyRegistered(bytes32 keyHash);
    error NoSuchProvingKey(bytes32 keyHash);
    error GasLimitTooBig(uint32 gasLimit, uint32 maxGasLimit);
    error RequestIDNotPending();
    error NothingToCommit();

    struct Subscription {
        address owner;
        uint96 balance;
        address[] consumers;
        // FINAL FIX: Changed reqCount from uint96 to uint64 to match the interface.
        uint64 reqCount;
    }

    event SubscriptionCreated(uint64 indexed subId);
    event ConsumerAdded(uint64 indexed subId, address indexed consumer);
    event SubscriptionFunded(uint64 indexed subId, uint256 oldBalance, uint256 newBalance);

    uint256 public constant VERSION = 1;

    uint96 private _baseFee;
    uint96 private _gasPriceLink;
    uint256 private _reqCount;

    mapping(uint64 => Subscription) private _subscriptions;
    mapping(uint256 => bool) private _pendingRequests;
    mapping(bytes32 => address) private _provingKeys;

    constructor(uint96 baseFee, uint96 gasPriceLink) {
        _baseFee = baseFee;
        _gasPriceLink = gasPriceLink;
    }

    function requestRandomWords(
        bytes32,
        uint64 _subId,
        uint16,
        uint32,
        uint32
    ) external override returns (uint256 requestId) {
        if (_subscriptions[_subId].owner == address(0)) {
            revert InvalidSubscription();
        }
        bool isConsumer = false;
        for (uint256 i = 0; i < _subscriptions[_subId].consumers.length; i++) {
            if (_subscriptions[_subId].consumers[i] == msg.sender) {
                isConsumer = true;
                break;
            }
        }
        if (!isConsumer) {
            revert InvalidConsumer();
        }
        uint96 fee = _baseFee + _gasPriceLink;
        if (_subscriptions[_subId].balance < fee) {
            revert InsufficientBalance();
        }
        _subscriptions[_subId].balance -= fee;
        _subscriptions[_subId].reqCount++;
        
        _reqCount++;
        requestId = _reqCount;
        _pendingRequests[requestId] = true;
        
        return requestId;
    }

    function createSubscription() external returns (uint64 subId) {
        subId = uint64(uint160(msg.sender)) + uint64(block.timestamp);
        if (_subscriptions[subId].owner != address(0)) {
            subId = uint64(uint256(keccak256(abi.encodePacked(msg.sender, block.timestamp))));
        }
        _subscriptions[subId] = Subscription({
            owner: msg.sender,
            balance: 0,
            consumers: new address[](0),
            reqCount: 0
        });
        emit SubscriptionCreated(subId);
    }
    
    function addConsumer(uint64 subId, address consumer) external {
        if (_subscriptions[subId].owner != msg.sender) {
            revert MustBeSubOwner();
        }
        if (_subscriptions[subId].consumers.length >= 100) {
            revert TooManyConsumers();
        }
        _subscriptions[subId].consumers.push(consumer);
        emit ConsumerAdded(subId, consumer);
    }

    function fundSubscription(uint64 subId, uint96 amount) external {
        if (_subscriptions[subId].owner == address(0)) {
            revert InvalidSubscription();
        }
        _subscriptions[subId].balance += amount;
        emit SubscriptionFunded(subId, _subscriptions[subId].balance - amount, _subscriptions[subId].balance);
    }

    function fulfillRandomWordsWithOverride(
        uint256 _requestId,
        address _consumer,
        uint256[] memory _words
    ) public {
        if (!_pendingRequests[_requestId]) {
            revert RequestIDNotPending();
        }
        delete _pendingRequests[_requestId];
        VRFConsumerBaseV2 vrfConsumer = VRFConsumerBaseV2(_consumer);
        vrfConsumer.rawFulfillRandomWords(_requestId, _words);
    }
    
    // FINAL FIX: Updated function signature and return values to match the interface.
    function getSubscription(uint64 subId) external view override returns (uint96 balance, uint64 reqCount, address owner, address[] memory consumers) {
        if (_subscriptions[subId].owner == address(0)) {
            revert InvalidSubscription();
        }
        Subscription storage sub = _subscriptions[subId];
        return (sub.balance, sub.reqCount, sub.owner, sub.consumers);
    }

    function acceptSubscriptionOwnerTransfer(uint64) external pure {}
    function cancelSubscription(uint64, address) external pure {}
    function getRequestConfig() external pure returns (uint16, uint32, bytes32[] memory) { bytes32[] memory b; return (0,0,b); }
    function getFeeConfig() external pure returns (uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32) { return (0,0,0,0,0,0,0,0); }
    function pendingRequestExists(uint64) external pure returns (bool) { return false; }
    function removeConsumer(uint64, address) external pure {}
    function requestSubscriptionOwnerTransfer(uint64, address) external pure {}
}
