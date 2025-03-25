import {
  WrapXNativeInstance,
  NFTData,
  NativeWrapOperation
} from "../generated/schema";
import { Bytes, dataSource, BigInt, Address } from "@graphprotocol/graph-ts";
import {
  Unwrap as UnwrapEvent,
  Wrap as WrapEvent,
  WrapXNative
} from "../generated/templates/WrapXNative/WrapXNative";

export function handleWrap(event: WrapEvent): void {
  const tokenId = event.params.tokenId;
  const to = event.params.to;
  const premium = event.params.premium;
  const fee = event.params.fee;
  
  // 创建或更新 NFT 数据
  const nftId = Bytes.fromUTF8(tokenId.toString());
  let nftData = NFTData.load(nftId);
  
  const instanceId = dataSource.address();
  let instance = WrapXNativeInstance.load(instanceId);
  
  if (nftData === null) {
    nftData = new NFTData(nftId);
    nftData.tokenId = tokenId;
    nftData.owner = to;
    nftData.name = instance ? instance.name + " #" + tokenId.toString() : "#" + tokenId.toString();
    nftData.tokenInstance = null;
    nftData.nativeInstance = instanceId;
    nftData.lastUpdatedAt = BigInt.fromI32(0);
    nftData.lastUpdatedAtBlock = BigInt.fromI32(0);
    nftData.lastUpdatedInTx = Bytes.fromHexString("0x");
    
    // 更新实例的当前供应量
    if (instance) {
      instance.currentSupply = instance.currentSupply.plus(BigInt.fromI32(1));
      instance.save();
    }
  }
  
  nftData.owner = to;
  nftData.lastUpdatedAt = event.block.timestamp;
  nftData.lastUpdatedAtBlock = event.block.number;
  nftData.lastUpdatedInTx = event.transaction.hash;
  nftData.save();
  
  // 创建包装操作记录
  const operationId = event.transaction.hash.concatI32(event.logIndex.toI32());
  
  const operation = new NativeWrapOperation(operationId);
  operation.nft = nftId;
  operation.wrapInstance = instanceId;
  operation.type = "Wrap";
  operation.to = to;
  operation.amount = premium.plus(fee); // 总金额 = 溢价 + 费用
  operation.fee = fee;
  operation.timestamp = event.block.timestamp;
  operation.blockNumber = event.block.number;
  operation.transactionHash = event.transaction.hash;
  operation.save();
  
  // 更新 WrapXNative 实例数据
  if (instance !== null) {
    const contract = WrapXNative.bind(instanceId);
    
    // 使用合约中实际存在的方法获取 TVL
    // 尝试几种可能的方法
    let tvlUpdated = false;
    
    // 尝试 balanceOf 方法 (如果合约有此方法)
    const balanceOfResult = contract.try_balanceOf(Address.fromString("0x0000000000000000000000000000000000000000"));
    if (!balanceOfResult.reverted) {
      instance.tvl = balanceOfResult.value;
      tvlUpdated = true;
    }
    
    // 如果上面的方法失败，尝试 totalSupply (如果合约有此方法)
    if (!tvlUpdated) {
      const totalSupplyResult = contract.try_totalSupply();
      if (!totalSupplyResult.reverted) {
        instance.tvl = totalSupplyResult.value;
        tvlUpdated = true;
      }
    }
    
    // 如果所有方法都失败，可以保持当前值或设置为0
    if (!tvlUpdated) {
      // 可以选择不更新 TVL 或设置为 0
      // instance.tvl = BigInt.fromI32(0);
    }
    
    instance.save();
  }
}

export function handleUnwrap(event: UnwrapEvent): void {
  const tokenId = event.params.tokenId;
  const to = event.params.to;
  const premium = event.params.premium;
  const fee = event.params.fee;
  
  // 创建或更新 NFT 数据
  const nftId = Bytes.fromUTF8(tokenId.toString());
  let nftData = NFTData.load(nftId);
  
  const instanceId = dataSource.address();
  let instance = WrapXNativeInstance.load(instanceId);
  
  if (nftData === null) {
    nftData = new NFTData(nftId);
    nftData.tokenId = tokenId;
    nftData.owner = to;
    nftData.name = instance ? instance.name + " #" + tokenId.toString() : "#" + tokenId.toString();
    nftData.tokenInstance = null;
    nftData.nativeInstance = instanceId;
    nftData.lastUpdatedAt = BigInt.fromI32(0);
    nftData.lastUpdatedAtBlock = BigInt.fromI32(0);
    nftData.lastUpdatedInTx = Bytes.fromHexString("0x");
  } else {
    // 更新实例的当前供应量
    if (instance) {
      instance.currentSupply = instance.currentSupply.minus(BigInt.fromI32(1));
      instance.save();
    }
  }
  
  nftData.owner = to;
  nftData.lastUpdatedAt = event.block.timestamp;
  nftData.lastUpdatedAtBlock = event.block.number;
  nftData.lastUpdatedInTx = event.transaction.hash;
  nftData.save();
  
  // 创建解包操作记录
  const operationId = event.transaction.hash.concatI32(event.logIndex.toI32());
  
  const operation = new NativeWrapOperation(operationId);
  operation.nft = nftId;
  operation.wrapInstance = instanceId;
  operation.type = "Unwrap";
  operation.to = to;
  operation.amount = premium.plus(fee); // 总金额 = 溢价 + 费用
  operation.fee = fee;
  operation.timestamp = event.block.timestamp;
  operation.blockNumber = event.block.number;
  operation.transactionHash = event.transaction.hash;
  operation.save();
  
  // 更新 WrapXNative 实例数据
  if (instance !== null) {
    const contract = WrapXNative.bind(instanceId);
    
    // 使用合约中实际存在的方法获取 TVL
    // 尝试几种可能的方法
    let tvlUpdated = false;
    
    // 尝试 balanceOf 方法 (如果合约有此方法)
    const balanceOfResult = contract.try_balanceOf(Address.fromString("0x0000000000000000000000000000000000000000"));
    if (!balanceOfResult.reverted) {
      instance.tvl = balanceOfResult.value;
      tvlUpdated = true;
    }
    
    // 如果上面的方法失败，尝试 totalSupply (如果合约有此方法)
    if (!tvlUpdated) {
      const totalSupplyResult = contract.try_totalSupply();
      if (!totalSupplyResult.reverted) {
        instance.tvl = totalSupplyResult.value;
        tvlUpdated = true;
      }
    }
    
    // 如果所有方法都失败，可以保持当前值或设置为0
    if (!tvlUpdated) {
      // 可以选择不更新 TVL 或设置为 0
      // instance.tvl = BigInt.fromI32(0);
    }
    
    instance.save();
  }
} 