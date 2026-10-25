import qrcode from 'qrcode-generator';

export function invitationCode(value: string) {
  const qr = qrcode(0, 'M');
  qr.addData(value, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      const start = col;
      while (col + 1 < count && qr.isDark(row, col + 1)) col++;
      const width = col - start + 1;
      path += `M${start + quiet} ${row + quiet}h${width}v1h-${width}z`;
    }
  }
  return { size: count + quiet * 2, path };
}
