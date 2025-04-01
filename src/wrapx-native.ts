import { WrapXNativeInstance, NFTData, NativeWrapOperation } from "../generated/schema";
import { Bytes, dataSource, BigInt, Address, log } from "@graphprotocol/graph-ts";
import { Unwrap as UnwrapEvent, Wrap as WrapEvent, WrapXNative } from "../generated/templates/WrapXNative/WrapXNative";
import { Mint as MintEvent } from "../generated/templates/WrapXNative/WrapXNative";
import { createNftId, getDefaultNftName, tryDecodeBytes } from "./utils";

export function handleWrap(event: WrapEvent): void {
  const tokenId = event.params.tokenId;
  const to = event.params.to;
  const premium = event.params.premium;
  const fee = event.params.fee;

  // 获取当前合约地址
  const contractAddress = dataSource.address();

  // 加载对应的 WrapXNativeInstance
  let instance = WrapXNativeInstance.load(contractAddress);
  if (instance === null) {
    log.warning("WrapXNativeInstance not found for address: {}", [contractAddress.toHexString()]);
    return; // 如果找不到实例，则不处理此事件
  }

  // 创建唯一的 NFT ID
  const nftId = createNftId(contractAddress, tokenId);
  let nftData = NFTData.load(nftId);

  // 创建 NFT 数据（如果不存在）- 通常这应该由 handleMint 完成
  // 如果已经通过 Mint 事件创建，这里将跳过
  if (nftData === null) {
    log.warning("NFT data not found in Wrap event, creating new: {}", [nftId.toHexString()]);
    nftData = new NFTData(nftId);
    nftData.tokenId = tokenId;
    nftData.owner = to;
    nftData.name = getDefaultNftName(instance.name, tokenId);
    nftData.tokenInstance = null;
    nftData.nativeInstance = contractAddress;
    nftData.lastUpdatedAt = BigInt.fromI32(0);
    nftData.lastUpdatedAtBlock = BigInt.fromI32(0);
    nftData.lastUpdatedInTx = Bytes.fromHexString("0x");

    // 只有在 NFT 数据不存在时才更新供应量
    // 因为它应该已经在 handleMint 中更新过了
    instance.currentSupply = instance.currentSupply.plus(BigInt.fromI32(1));
    instance.save();
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
  operation.wrapInstance = contractAddress;
  operation.type = "Wrap";
  operation.to = to;
  operation.amount = premium.plus(fee); // 总金额 = 溢价 + 费用
  operation.fee = fee;
  operation.timestamp = event.block.timestamp;
  operation.blockNumber = event.block.number;
  operation.transactionHash = event.transaction.hash;
  operation.save();

  // 更新 TVL
  updateInstanceTVL(contractAddress, instance);
}

// 提取 TVL 更新逻辑为单独的函数
function updateInstanceTVL(contractAddress: Bytes, instance: WrapXNativeInstance): void {
  const contract = WrapXNative.bind(Address.fromBytes(contractAddress));
  
  let tvlUpdated = false;
  
  const balanceOfResult = contract.try_balanceOf(Address.fromString("0x0000000000000000000000000000000000000000"));
  if (!balanceOfResult.reverted) {
    instance.tvl = balanceOfResult.value;
    tvlUpdated = true;
  }
  
  if (!tvlUpdated) {
    const totalSupplyResult = contract.try_totalSupply();
    if (!totalSupplyResult.reverted) {
      instance.tvl = totalSupplyResult.value;
      tvlUpdated = true;
    }
  }
  
  instance.save();
}

export function handleUnwrap(event: UnwrapEvent): void {
  const tokenId = event.params.tokenId;
  const to = event.params.to;
  const premium = event.params.premium;
  const fee = event.params.fee;

  // 获取当前合约地址
  const contractAddress = dataSource.address();

  // 加载对应的 WrapXNativeInstance
  let instance = WrapXNativeInstance.load(contractAddress);
  if (instance === null) {
    log.warning("WrapXNativeInstance not found for address: {}", [contractAddress.toHexString()]);
    return; // 如果找不到实例，则不处理此事件
  }

  // 创建唯一的 NFT ID
  const nftId = createNftId(contractAddress, tokenId);
  let nftData = NFTData.load(nftId);

  if (nftData === null) {
    log.warning("NFT data not found for unwrap operation: {}", [nftId.toHexString()]);
    return; // 如果找不到 NFT 数据，可能是异常情况
  }

  // 更新实例的当前供应量
  instance.currentSupply = instance.currentSupply.minus(BigInt.fromI32(1));

  nftData.owner = to;
  nftData.lastUpdatedAt = event.block.timestamp;
  nftData.lastUpdatedAtBlock = event.block.number;
  nftData.lastUpdatedInTx = event.transaction.hash;
  nftData.save();

  // 创建解包操作记录
  const operationId = event.transaction.hash.concatI32(event.logIndex.toI32());

  const operation = new NativeWrapOperation(operationId);
  operation.nft = nftId;
  operation.wrapInstance = contractAddress;
  operation.type = "Unwrap";
  operation.to = to;
  operation.amount = premium.plus(fee); // 总金额 = 溢价 + 费用
  operation.fee = fee;
  operation.timestamp = event.block.timestamp;
  operation.blockNumber = event.block.number;
  operation.transactionHash = event.transaction.hash;
  operation.save();

  // 更新 TVL
  updateInstanceTVL(contractAddress, instance);
}

export function handleMint(event: MintEvent): void {
  // 从事件中获取数据
  const to = event.params.to;
  const tokenId = event.params.tokenId;
  const name = event.params.name;

  // 获取当前合约地址
  const contractAddress = dataSource.address();

  // 加载对应的 WrapXNativeInstance
  let instance = WrapXNativeInstance.load(contractAddress);
  if (instance === null) {
    log.warning("WrapXNativeInstance not found for address in Mint event: {}", [contractAddress.toHexString()]);
    return;
  }

  // 创建唯一的 NFT ID
  const nftId = createNftId(contractAddress, tokenId);

  // 检查 NFT 数据是否已存在
  let nftData = NFTData.load(nftId);
  if (nftData === null) {
    nftData = new NFTData(nftId);
    nftData.tokenId = tokenId;
    nftData.tokenInstance = null;
    nftData.nativeInstance = contractAddress;
    nftData.lastUpdatedAt = BigInt.fromI32(0);
    nftData.lastUpdatedAtBlock = BigInt.fromI32(0);
    nftData.lastUpdatedInTx = Bytes.fromHexString("0x");

    // 使用事件中的名称，如果不可解析则使用默认名称
    let decodedName = tryDecodeBytes(name, getDefaultNftName(instance.name, tokenId));
    nftData.name = decodedName;
    log.info("NFT name from Mint event: {}", [decodedName]);
    
    // 添加更新供应量的逻辑
    instance.currentSupply = instance.currentSupply.plus(BigInt.fromI32(1));
    instance.save();
  }

  // 更新所有者和时间戳
  nftData.owner = to;
  nftData.lastUpdatedAt = event.block.timestamp;
  nftData.lastUpdatedAtBlock = event.block.number;
  nftData.lastUpdatedInTx = event.transaction.hash;
  nftData.save();

  log.info("Handled Mint event for token ID {}, name: {}", [tokenId.toString(), nftData.name]);
}
