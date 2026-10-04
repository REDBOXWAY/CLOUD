/* Fixed receipt PDF bytes are saved with the transaction; no remote PDF service. */
(() => {
  'use strict';
  const money = value => Number(value).toFixed(2);
  function create(receipt) {
    const width = 640, margin = 32, lineHeight = 28, pages = [];
    let canvas, ctx, y;
    function newPage() {
      canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 1600;
      ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, 1600);
      ctx.fillStyle = '#000'; ctx.font = '22px "DejaVu Sans Mono", "Courier New", monospace'; y = 40;
    }
    function finish() {
      const cut = document.createElement('canvas'); cut.width = width; cut.height = Math.ceil(y + 30);
      cut.getContext('2d').drawImage(canvas, 0, 0);
      pages.push({height:cut.height, jpeg:atob(cut.toDataURL('image/jpeg', .95).split(',')[1])});
    }
    function space(height = lineHeight) { if (y + height > 1510) { finish(); newPage(); } }
    function text(value, size = 22, align = 'left', bold = false) {
      space(size + 10); ctx.font = `${bold ? 'bold ' : ''}${size}px "DejaVu Sans Mono", "Courier New", monospace`;
      ctx.textAlign = align; ctx.fillText(value, align === 'center' ? width / 2 : align === 'right' ? width - margin : margin, y); y += size + 10;
    }
    function pair(left, right, size = 22, bold = false) {
      space(size + 10);ctx.font = `${bold ? 'bold ' : ''}${size}px "DejaVu Sans Mono", "Courier New", monospace`;
      ctx.textAlign = 'left'; ctx.fillText(left, margin, y); ctx.textAlign = 'right'; ctx.fillText(right, width-margin,y); y += size + 10;
    }
    function rule() {space(22); ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(width-margin,y);ctx.stroke();ctx.setLineDash([]);y+=42;}
    function wrap(value) {
      ctx.font = '22px "DejaVu Sans Mono", "Courier New", monospace'; let line = '';
      for (const character of String(value)) {
        if (ctx.measureText(line + character).width > width - margin * 2) {text(line);line = '';}
        line += character;
      }
      if (line) text(line);
    }
    newPage();
    // Outline cloud, matching the approved receipt header.
    ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(294,72);ctx.bezierCurveTo(268,72,266,36,288,32);ctx.bezierCurveTo(294,2,336,2,343,32);ctx.bezierCurveTo(373,30,382,72,352,72);ctx.closePath();ctx.stroke();ctx.lineWidth=1;y=118;
    text('CLOUD DRIVE STORE', 36, 'center', true);text('ЧЕК ПОКУПКИ',23,'center');rule();
    text('Чек №',20);wrap(receipt.number);pair('Дата:',new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Baku'}).format(new Date(receipt.created_at)));
    pair('Время:',new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Baku',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(receipt.created_at)));
    text('Кассир:',20);wrap(receipt.cashier);rule();text('Наименование',22,'left',true);pair('Кол. × Цена','Сумма',20);rule();
    receipt.items.forEach((item,index)=>{space(110);wrap(`${index+1}. ${item.article}`);pair(`${item.quantity} × ${money(item.amount / item.quantity)}`,money(item.amount)+' AZN');y+=8;});
    rule();pair('ИТОГО:', money(receipt.total)+' AZN',34,true);rule();
    text('Спасибо за покупку!',27,'center',true);finish();
    // Minimal PDF with embedded JPEG pages: Cyrillic and manat stay identical on every device.
    const objects = [], pageIds = pages.map((_,i)=>3+i*3);
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pages.length} >>`);
    pages.forEach((page,i)=>{
      const id=pageIds[i], w=226.772, h=w*page.height/width;
      const stream=`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
      objects.push(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n${page.jpeg}\nendstream`);
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });
    let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
    const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset=>pdf+=String(offset).padStart(10,'0')+' 00000 n \n');
    pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return btoa(pdf);
  }
  window.ReceiptPDF = {create};
})();
