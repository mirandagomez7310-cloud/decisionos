const MAX_SIZE = 200 * 1024 * 1024

export function zipUncompressedSize(buffer: Buffer): number {
  const invalid = () => {
    throw new Error('El archivo .xlsx es demasiado grande al descomprimir')
  }
  let end = buffer.length - 22
  for (; end >= Math.max(0, buffer.length - 22 - 65535); end--) {
    if (
      buffer.readUInt32LE(end) === 0x06054b50 &&
      end + 22 + buffer.readUInt16LE(end + 20) === buffer.length
    )
      break
  }
  if (end < 0 || end < buffer.length - 22 - 65535) return invalid()
  const count = buffer.readUInt16LE(end + 10)
  const size = buffer.readUInt32LE(end + 12)
  let offset = buffer.readUInt32LE(end + 16)
  if (
    buffer.readUInt16LE(end + 4) !== 0 ||
    buffer.readUInt16LE(end + 6) !== 0 ||
    buffer.readUInt16LE(end + 8) !== count ||
    count === 65535 ||
    offset + size !== end
  )
    return invalid()
  let total = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
      return invalid()
    total += buffer.readUInt32LE(offset + 24)
    if (total > MAX_SIZE || buffer.readUInt16LE(offset + 34) !== 0)
      return invalid()
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32)
    if (offset > end) return invalid()
  }
  if (offset !== end) return invalid()
  return total
}
