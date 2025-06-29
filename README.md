# 项目名称：dBet
# 作者：0xbbh gemini
# 时间：2025/6/18
# 开源许可协议：MIT

## 项目介绍
基于去中心化和激励机制的预测系统平台。

## 功能特性（构想）
1. **预测未来事件的概率**  
   通过买卖双方下注对未来事件概率的预测，基于有效市场理论，价格会反应一切信息。通过资产和用户的利益关联，驱使用户做出最严谨理性的判断，同时最大限度地过滤噪音，将价格（赔率）推向接近真实概率。

2. **（待补充功能）**

## 项目亮点（构想）

1. **MarketFactory 工厂合约**  
   基于 MarketFactory 工厂合约来批量生成和管理预测市场合约 PredictionMarket，使用最小权限原则，任何用户都可以创建预测市场，但结算市场的裁决人是唯一可信的地址，如预言机（已实现）。

2. **动态 Metadata 渲染头寸 NFT**  
   基于链下 API 生成动态 Metadata 文件用于实时渲染头寸 NFT。  
   - NFT 会随着当前赔率动态调整 NFT 元数据。（生成 metadata 接口不能正常工作）
   - 每个预测市场（也就是一个预测的问题）配套一个 NFT 合约，用户多次下注只会获取一个 NFT（已实现）。

3. **链下 API 和存储优化**  
   通过将市场结果数据写入链下 API，节省链上存储空间，链上只做结算。通过 ChainLink Function 来读取链下 API。（API 已实现，预言机部分能发送请求，但是读不到结果）

   **测试的 Curl 代码：**

   - 写入市场结果的 API
     ```bash
     curl -X POST https://backend-5z8l.onrender.com/resolve-market \
         -H "Content-Type: application/json" \
         -H "x-api-key: KFCfucking-crazy-ThursdayVME50" \
         -d '{"marketAddress":"0xEa2e023F1D93F2Ffc5AA5A54ac67F54f7074F591", "winningOptionIndex": 0}'
     ```

   - 读取市场结果的 API
     ```bash
     curl --location --request GET 'https://backend-5z8l.onrender.com/get-resolution/0xEa2e023F1D93F2Ffc5AA5A54ac67F54f7074F591' \
         --header 'Content-Type: application/json' \
         --header 'x-api-key: KFCfucking-crazy-ThursdayVME50' \
         --data '{"marketAddress":"0xEa2e023F1D93F2Ffc5AA5A54ac67F54f7074F591", "winningOptionIndex": 0}'
     ```

4. **Lottery 系统**  
   每个 PredictionMarket 集成了一个 lottery 系统，任何投注都会收取百分之 2 的手续费进入彩票池中。  
   在市场结算后会通过 ChainLink 预言机发送请求，获取 VRF 公开透明地来抽取 Luck Doge，从而极大激励小额用户的参与。  
   （彩票逻辑测试通过，但预言机部分仍然存在问题）

## 测试步骤

1. 安装依赖：
   ```bash
   npm install
