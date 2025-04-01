import { Bytes, BigInt, Address, log } from "@graphprotocol/graph-ts";

export function createNftId(contractAddress: Bytes, tokenId: BigInt): Bytes {
  return contractAddress.concat(Bytes.fromUTF8("-")).concat(Bytes.fromUTF8(tokenId.toString()));
}

export function getDefaultNftName(instanceName: string, tokenId: BigInt): string {
  return instanceName + " #" + tokenId.toString();
}

export function bytesToHex(bytes: Bytes): string {
  let hex = "0x";
  for (let i = 0; i < bytes.length; i++) {
    let byte = bytes[i];
    let hexCode = byte.toString(16);
    // 确保每个字节都是两位十六进制数
    if (hexCode.length == 1) {
      hexCode = "0" + hexCode;
    }
    hex += hexCode;
  }
  return hex;
}

export function tryDecodeBytes(bytes: Bytes, defaultValue: string): string {
  // 如果bytes长度为0，直接返回默认值
  if (bytes.length == 0) {
    return defaultValue;
  }
  
  // 检查bytes是否可能是有效的UTF-8文本
  // 一个简单的启发式检查：查看前几个字节是否都是可打印ASCII字符
  let isProbablyText = true;
  for (let i = 0; i < Math.min(bytes.length, 8); i++) {
    let byte = bytes[i];
    // 检查是否是可打印ASCII范围(32-126)
    if (byte < 32 || byte > 126) {
      isProbablyText = false;
      break;
    }
  }
  
  if (isProbablyText) {
    // 可能是文本，尝试转换
    let result = bytes.toString();
    
    // 检查结果是否包含大量替换字符()，这通常表示解码失败
    let replacementCharCount = 0;
    for (let i = 0; i < result.length; i++) {
      if (result.charAt(i) == '') {
        replacementCharCount++;
      }
    }
    
    // 如果替换字符太多，可能不是有效的UTF-8文本
    if (replacementCharCount > result.length / 4) {
      log.info("Too many replacement characters in decoded string, using hex representation", []);
      return bytesToHex(bytes);
    }
    
    return result;
  } else {
    // 可能不是文本，转换为十六进制表示
    log.info("Data does not look like text, using hex representation", []);
    return bytesToHex(bytes);
  }
} 