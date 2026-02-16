
// Mocking the dependencies to avoid complex setup
function numberToBytesBE(num, length) {
    const buffer = new Uint8Array(length);
    let tempNum = BigInt(num);
    for (let i = length - 1; i >= 0; i--) {
        buffer[i] = Number(tempNum & 0xffn);
        tempNum = tempNum >> 8n;
    }
    return buffer;
}

// Simple bytesToHex implementation
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function calculateVersion(version) {
    const versionParts = version.split(".").map((x) => Number(x));
    
    if (!versionParts || versionParts.length !== 3) {
      throw new Error("Invalid version format");
    }

    // From the file:
    // const versionBytes = new Uint8Array([
    //   ...numberToBytesBE(versionParts[0], 2),
    //   ...numberToBytesBE(versionParts[1], 2),
    //   ...numberToBytesBE(versionParts[2], 2),
    // ])
    
    const p0 = numberToBytesBE(versionParts[0], 2);
    const p1 = numberToBytesBE(versionParts[1], 2);
    const p2 = numberToBytesBE(versionParts[2], 2);
    
    const versionBytes = new Uint8Array(6);
    versionBytes.set(p0, 0);
    versionBytes.set(p1, 2);
    versionBytes.set(p2, 4);

    // const versionBytes32 = `0x${bytesToHex(versionBytes).padEnd(64, "0")}`
    const hex = bytesToHex(versionBytes);
    const versionBytes32 = `0x${hex.padEnd(64, "0")}`;
    
    return versionBytes32;
}

const result = calculateVersion("0.12.0");
console.log(result);
