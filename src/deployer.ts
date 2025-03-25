import {
  WrapXTokenInstance,
  WrapXNativeInstance
} from "../generated/schema";
import { Bytes, BigInt, log, Address } from "@graphprotocol/graph-ts";
import {
  WrapXDeployed as WrapXDeployedEvent
} from "../generated/WrapXDeployer/WrapXDeployer";
import { WrapXToken as WrapXTokenTemplate, WrapXNative as WrapXNativeTemplate } from "../generated/templates";
import { WrapXDeployment } from "../generated/schema";

export function handleWrapXDeployed(event: WrapXDeployedEvent): void {
  log.info("Handling WrapXDeployed event at block {}, tx hash: {}", [
    event.block.number.toString(),
    event.transaction.hash.toHexString()
  ]);
  
  // 创建部署记录
  const deploymentId = event.transaction.hash.concatI32(event.logIndex.toI32());
  log.debug("Created deployment ID: {}", [deploymentId.toHexString()]);
  
  const deployment = new WrapXDeployment(deploymentId);
  
  // 从事件参数中获取数据
  const instance = event.params.wrapX;
  log.info("Deployed instance address: {}", [instance.toHexString()]);
  
  const name = event.params.name;
  log.info("Instance name: {}", [name]);
  
  const basePremium = event.params.basePremium;
  log.info("Base premium: {}", [basePremium.toString()]);
  
  const maxSupply = event.params.maxSupply;
  log.info("Max supply: {}", [maxSupply.toString()]);
  
  const tokenAddress = event.params.tokenAddress;
  log.info("Token address: {}", [tokenAddress.toHexString()]);
  
  // 确定包装类型
  const wrapType = tokenAddress.equals(Address.zero()) ? "Native" : "Token";
  log.info("Wrap type: {}", [wrapType]);
  
  // 设置部署记录的属性
  deployment.instance = instance;
  deployment.name = name;
  deployment.basePremium = basePremium;
  deployment.maxSupply = maxSupply;
  deployment.tokenAddress = tokenAddress;
  deployment.wrapType = wrapType;
  deployment.blockNumber = event.block.number;
  deployment.timestamp = event.block.timestamp;
  deployment.transactionHash = event.transaction.hash;
  deployment.save();
  
  log.info("Deployment record saved successfully", []);
  
  // 根据包装类型创建相应的实例
  if (wrapType == "Token") {
    log.info("Creating WrapXToken instance", []);
    
    // 创建WrapXToken实例
    const tokenInstance = new WrapXTokenInstance(instance);
    tokenInstance.address = instance;
    tokenInstance.name = name;
    tokenInstance.basePremium = basePremium;
    tokenInstance.maxSupply = maxSupply;
    tokenInstance.tokenAddress = tokenAddress;
    tokenInstance.currentSupply = BigInt.fromI32(0);
    tokenInstance.tvl = BigInt.fromI32(0);
    tokenInstance.createdAt = event.block.timestamp;
    tokenInstance.createdAtBlock = event.block.number;
    tokenInstance.createdInTx = event.transaction.hash;
    tokenInstance.save();
    
    log.info("WrapXToken instance saved successfully", []);
    
    // 创建模板实例以跟踪此合约
    WrapXTokenTemplate.create(instance);
    log.info("WrapXToken template created for address: {}", [instance.toHexString()]);
  } else {
    log.info("Creating WrapXNative instance", []);
    
    // 创建WrapXNative实例
    const nativeInstance = new WrapXNativeInstance(instance);
    nativeInstance.address = instance;
    nativeInstance.name = name;
    nativeInstance.basePremium = basePremium;
    nativeInstance.maxSupply = maxSupply;
    nativeInstance.currentSupply = BigInt.fromI32(0);
    nativeInstance.tvl = BigInt.fromI32(0);
    nativeInstance.createdAt = event.block.timestamp;
    nativeInstance.createdAtBlock = event.block.number;
    nativeInstance.createdInTx = event.transaction.hash;
    nativeInstance.save();
    
    log.info("WrapXNative instance saved successfully", []);
    
    // 创建模板实例以跟踪此合约
    WrapXNativeTemplate.create(instance);
    log.info("WrapXNative template created for address: {}", [instance.toHexString()]);
  }
  
  log.info("Finished handling WrapXDeployed event", []);
} 