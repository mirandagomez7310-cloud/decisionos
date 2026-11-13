const MAX_SIZE = 200 * 1024 * 1024
const MAX_U32 = 0xffffffff

// Recorre el directorio central igual que fflate.unzip, que es quien descomprime en
// read-excel-file/universal y reserva exactamente el tamaño declarado de cada entrada:
// misma búsqueda del registro final, mismo recuento y mismos saltos entre entradas.
export function zipUncompressedSize(buffer: Buffer): number {
  const invalid = (): never => {
    throw new Error('El archivo .xlsx es demasiado grande al descomprimir')
  }
  let end = buffer.length - 22
  if (end < 0) return invalid()
  while (buffer.readUInt32LE(end) !== 0x06054b50) {
    if (!end || buffer.length - end > 65558) return invalid()
    end--
  }
  // ZIP64 cambia recuento y desplazamientos; un .xlsx de 25 MiB no lo necesita.
  if (end >= 20 && buffer.readUInt32LE(end - 20) === 0x07064b50)
    return invalid()
  const count = buffer.readUInt16LE(end + 8)
  let offset = buffer.readUInt32LE(end + 16)
  let total = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length) return invalid()
    const compressed = buffer.readUInt32LE(offset + 20)
    const size = buffer.readUInt32LE(offset + 24)
    const local = buffer.readUInt32LE(offset + 42)
    if (compressed === MAX_U32 || size === MAX_U32 || local === MAX_U32)
      return invalid()
    total += size
    if (total > MAX_SIZE) return invalid()
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32)
  }
  return total
}
