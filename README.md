# 项目名称 dBet
# 作者 0xbbh gemini
# 时间 2025/6/18
# 开源许可协议 MIT

## 项目介绍
基于去中心化和激励机制的预测系统平台

## 功能特性（构想）
一、通过买卖双方下注对未来事件概率的预测，基于有效市场理论，价格会反应一切信息，通过资产和用户的利益关联，会驱使用户做最严谨理性的判断，同时最大限度过滤噪音，从而将价格（赔率）推向接近真实概率
二、

## 项目亮点（构想）
一、基于 MarketFactory 工厂合约来批量生成和管理预测市场合约 PredictionMarket, 使用最小权限原则，任何用户都可以创建预测市场，但结算市场的裁决人是唯一可信的地址如预言机（已实现）

二、基于链下API生成动态Metadata文件用于实时渲染 头寸NFT 
    ·NFT会随着当前赔率动态调整 NFT 元数据 （生成metadata接口不能正常工作）
    ·每个预测市场（也就是一个预测的问题）配套一个NFT合约，用户多次下注只会获取一个NFT（已实现）

三、可以通过将市场结果数据写入链下API，然后节省链上存储空间，链上只做结算，通过chainLink Function来读取链下API（API已实现， 预言机部分能发送请求，但是读不到结果）

测试的Curl代码
·写入市场结果的API
curl -X POST https://backend-5z8l.onrender.com/resolve-market
     -H "Content-Type: application/json"
     -H "x-api-key: KFCfucking-crazy-ThursdayVME50"
     -d '{"marketAddress":"0xEa2e023F1D93F2Ffc5AA5A54ac67F54f7074F591", "winningOptionIndex": 0}'
·读取市场结果的API
curl --location --request GET 'https://backend-5z8l.onrender.com/get-resolution/0xEa2e023F1D93F2Ffc5AA5A54ac67F54f7074F591' \
--header 'Content-Type: application/json' \
--header 'x-api-key: KFCfucking-crazy-ThursdayVME50' \
--data '{"marketAddress":"0xEa2e023F1D93F2Ffc5AA5A54ac67F54f7074F591", "winningOptionIndex": 0}'


四、每个 PredictionMarket 集成了一个 lottery 系统，任何投注都会收取百分之2的手续费进入彩票池中，在市场结算后会通过 chainLink预言机发送请求，获取 VRF 公开透明地来抽取 Luck Doge ，从而极大激励小额用户的参与 （彩票逻辑测试通过，但是预言机部分还是不行）


## 测试步骤

npm install     
安装依赖

npx hardhat run scripts/deploy.js --network sepolia
部署工厂合约，后续测试脚本基于这个工厂合约进行

npx hardhat run scripts/e2e-test.js --network sepolia
运行测试脚本，提示很清晰，先使用工厂合约创建市场（注意修改合约相关权限，不然无法操作合约）然后将市场合约手动添加到chainlink测试网的订阅中，实际的产品可以使用自动化操作，还有写入市场结果到链下服务器上，完成以上操作后，可以回车进行后续操作（测试脚本会在未完成以上步骤时阻塞直到回车确认完成）