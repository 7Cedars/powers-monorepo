
import { bytesToHex } from "@noble/hashes/utils";

function numberToBytesBE(num: number, length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    buffer[i] = num & 0xff;
    num = num >> 8;
  }
  return buffer;
}

const versionString = "0.12.0";
const versionParts = versionString.split(".").map((x) => Number(x));

if (!versionParts || versionParts.length !== 3) {
  throw new Error("Invalid version format");
}

const versionBytes = new Uint8Array([
  ...numberToBytesBE(versionParts[0], 2),
  ...numberToBytesBE(versionParts[1], 2),
  ...numberToBytesBE(versionParts[2], 2),
]);

const versionBytes32 = `0x${bytesToHex(versionBytes).padEnd(64, "0")}`;
console.log(versionBytes32);
