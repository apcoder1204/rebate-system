import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface ContractData {
  customerName: string;
  customerPhone: string;
  startDate: string;
  endDate: string;
  signatureDataUrl?: string; // Customer signature - Base64 image data URL
  managerSignatureDataUrl?: string; // Manager signature - Base64 image data URL
  managerName?: string;
  managerPosition?: string;
}

export async function generateContractPDF(data: ContractData): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Add a page
  let page = pdfDoc.addPage([595, 842]); // A4 size in points (72 DPI)
  const { width, height } = page.getSize();
  
  // Helper function to format dates
  const formatDate = (dateString: string) => {
    if (!dateString) return '_______';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Get date parts for Swahili format
  const getDateParts = (dateString: string) => {
    if (!dateString) return { day: '_______', month: '________', year: '________' };
    const date = new Date(dateString);
    const day = date.getDate().toString();
    const months = ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'];
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString();
    return { day, month, year };
  };
  
  // Get date parts before using them in content
  const startDateParts = getDateParts(data.startDate);
  const endDateParts = getDateParts(data.endDate);
  const startDateFormatted = formatDate(data.startDate);
  const endDateFormatted = formatDate(data.endDate);
  
  // Helper to wrap text with mixed bold/regular
  const drawMixedText = (text: string, x: number, y: number, size: number, maxWidth: number): number => {
    let currentY = y;
    
    // Split text into segments - identify bold parts
    const boldParts = [
      data.customerName,
      data.customerPhone,
      startDateParts.day,
      startDateParts.month,
      startDateParts.year,
      startDateFormatted,
      endDateFormatted
    ].filter(Boolean);
    
    // Build segments array
    let segments: { text: string; bold: boolean }[] = [];
    let remaining = text;
    let lastIndex = 0;
    
    // Find all bold parts and create segments
    const matches: Array<{ start: number; end: number; text: string }> = [];
    boldParts.forEach(part => {
      let index = remaining.indexOf(part);
      while (index !== -1) {
        matches.push({ start: index, end: index + part.length, text: part });
        index = remaining.indexOf(part, index + 1);
      }
    });
    
    // Sort by position
    matches.sort((a, b) => a.start - b.start);
    
    // Build segments
    let pos = 0;
    matches.forEach(match => {
      if (match.start > pos) {
        segments.push({ text: remaining.substring(pos, match.start), bold: false });
      }
      segments.push({ text: match.text, bold: true });
      pos = match.end;
    });
    
    if (pos < remaining.length) {
      segments.push({ text: remaining.substring(pos), bold: false });
    }
    
    if (segments.length === 0) {
      segments = [{ text, bold: false }];
    }
    
    // Draw segments with word wrapping
    let line: { text: string; bold: boolean }[] = [];
    let lineWidth = 0;
    
    segments.forEach(segment => {
      const words = segment.text.split(' ');
      words.forEach((word, idx) => {
        const wordWithSpace = word + (idx < words.length - 1 ? ' ' : '');
        const font = segment.bold ? helveticaBoldFont : helveticaFont;
        const wordWidth = font.widthOfTextAtSize(wordWithSpace, size);
        
        if (lineWidth + wordWidth > maxWidth && line.length > 0) {
          // Draw current line
          let xPos = x;
          line.forEach(seg => {
            const segFont = seg.bold ? helveticaBoldFont : helveticaFont;
            const segWidth = segFont.widthOfTextAtSize(seg.text, size);
            page.drawText(seg.text, {
              x: xPos,
              y: currentY,
              size: size,
              font: segFont,
              color: rgb(0, 0, 0),
            });
            xPos += segWidth;
          });
          currentY -= lineHeight;
          line = [{ text: wordWithSpace, bold: segment.bold }];
          lineWidth = wordWidth;
        } else {
          if (line.length > 0 && line[line.length - 1].bold === segment.bold) {
            line[line.length - 1].text += wordWithSpace;
          } else {
            line.push({ text: wordWithSpace, bold: segment.bold });
          }
          lineWidth += wordWidth;
        }
      });
    });
    
    // Draw remaining line
    if (line.length > 0) {
      let xPos = x;
      line.forEach(seg => {
        const segFont = seg.bold ? helveticaBoldFont : helveticaFont;
        const segWidth = segFont.widthOfTextAtSize(seg.text, size);
        page.drawText(seg.text, {
          x: xPos,
          y: currentY,
          size: size,
          font: segFont,
          color: rgb(0, 0, 0),
        });
        xPos += segWidth;
      });
      currentY -= lineHeight;
    }
    
    return currentY;
  };
  
  const lineHeight = 14;
  const marginX = 50;
  const maxWidth = width - 2 * marginX;
  
  // Header Section with Logo
  // Try to embed logo (left side)
  let logoImage = null;
  try {
    // Try to fetch the logo from the public path
    const logoUrl = '/cctvpointLogo.png';
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      try {
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch {
        logoImage = await pdfDoc.embedJpg(logoBytes);
      }
    }
  } catch (error) {
    console.warn('Could not load logo for PDF:', error);
  }
  
  // Logo on the left
  const logoX = marginX;
  const logoY = height - 50;
  if (logoImage) {
    const logoDims = logoImage.scale(0.15); // Scale logo appropriately
    const logoHeight = Math.min(logoDims.height, 60);
    page.drawImage(logoImage, {
      x: logoX,
      y: logoY - logoHeight,
      width: logoDims.width * (logoHeight / logoDims.height),
      height: logoHeight,
    });
  }
  
  // Address on the right
  const addressX = width / 2 + 20;
  page.drawText('BZ TECH CO. LIMITED', {
    x: addressX,
    y: height - 50,
    size: 18,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  page.drawText('& CCTV POINT', {
    x: addressX,
    y: height - 70,
    size: 14,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  page.drawText('ADDRESS', {
    x: addressX,
    y: height - 90,
    size: 9,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  page.drawText('ILOMBA Mbeya & Kabwe Mbeya', {
    x: addressX,
    y: height - 105,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  page.drawText('Phone: +255 759 875 769', {
    x: addressX,
    y: height - 118,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  page.drawText('Email: bztechco.ltd.tz@gmail.com', {
    x: addressX,
    y: height - 131,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  // Draw horizontal line
  page.drawLine({
    start: { x: 50, y: height - 145 },
    end: { x: width - 50, y: height - 145 },
    thickness: 2,
    color: rgb(0, 0, 0),
  });
  
  // Title
  page.drawText('MKATABA WA SHUKRANI KWA WATEJA WETU', {
    x: 60,
    y: height - 165,
    size: 12,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  let yPosition = height - 190;
  
  // Contract content
  const content = [
    'Sisi kama CCTV POINT (BZ TECH COMPANY LTD) tumeona ni nyema kutengeneza makubaliano maalumu ya shukrani kati yetu na mteja wetu.',
    '',
    'Sisi CCTV POINT tuna wateja wa aina tatu (3) ambao ni:-',
    '1. Whole sales customers (wateja wa jumla).',
    '2. End user customers (mteja wa mwisho).',
    '3. Technician (fundi/engineer ambae ndie mteja wetu wa kila siku).',
    '',
    'HIVYO, kwa aina hii ya wateja mkataba huu ni mahsusi kwa wateja wetu kundi la tatu ambao ni mtaalamu/fundi au engineer. Sisi tunaamini wewe ndio mteja wetu wa thamani wa kila siku.',
    '',
    'Ndio maana CCTV POINT (BZ TECH Co. LTD) tumeona katika kuendeleza ushirikiano na ustawi baina yetu kwa kuwa tunatambua na kuthamini mchango wako.',
    '',
    `MKATABA huu utakuwa ni baina ya BZ TECH COMPANY LIMITED (CCTV POINT) na ${data.customerName} (fundi/mtaalamu/engineer) anaepatikana mwenye nambari ya simu ${data.customerPhone}.`,
    '',
    'KWAMBA, mkataba huu wa shukrani utadumu kwa muda wa miezi sita (6) au vipindi viwili kwa mwaka.',
    '',
    'NA mkataba huu utavunjwa pale tu wakati utakapomalizika.',
    '',
    'Mkataba huu utahusisha bidhaa zote zitakazonunuliwa kutoka katika kampuni yetu kwa gharama ile ya kiufundi.',
    '',
    'KWAMBA, kwa fundi/mtaalamu/engineer kila atakapochukua bidhaa/mzigo atatakiwa kusaini fomu maalumu iliombatanishwa nyuma ya mkataba huu au kuja kusaini endapo bidhaa/mzigo utatumwa.',
    '',
    'MKATABA huu utakuwa na shukrani ya asilimia moja (1%) kwa kila bidhaa itakayonunuliwa na fundi.',
    '',
    `Mkataba huu umesainiwa leo tarehe ${startDateParts.day} mwezi ${startDateParts.month} mwaka ${startDateParts.year} KATI ya CCTV POINT (BZ TECH Co. LIMITED) na ${data.customerName}.`,
    '',
    `Mkataba huu utadumu kutoka tarehe ${startDateFormatted} hadi tarehe ${endDateFormatted}.`,
  ];
  
  // Draw content with bold formatting
  content.forEach((line) => {
    if (line === '') {
      yPosition -= lineHeight / 3;
      return;
    }
    yPosition = drawMixedText(line, marginX, yPosition, 10, maxWidth);
  });
  
  // Check if we need a new page for signatures
  if (yPosition < 280) {
    page = pdfDoc.addPage([595, 842]);
    yPosition = height - 50;
  }
  
  // Signatures section
  yPosition -= 20;
  page.drawLine({
    start: { x: marginX, y: yPosition },
    end: { x: width - marginX, y: yPosition },
    thickness: 2,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 20;
  
  // Store the header Y position for alignment
  const headerY = yPosition;
  
  // Left side - Customer signature
  page.drawText('FUNDI/MTAALAMU/ENGINEER', {
    x: marginX,
    y: headerY,
    size: 11,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 18;
  page.drawText('Jina:', {
    x: marginX,
    y: yPosition,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 15;
  page.drawText(data.customerName, {
    x: marginX,
    y: yPosition,
    size: 9,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  page.drawLine({
    start: { x: marginX, y: yPosition - 4 },
    end: { x: marginX + 200, y: yPosition - 4 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 20;
  page.drawText('Simu:', {
    x: marginX,
    y: yPosition,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 15;
  page.drawText(data.customerPhone, {
    x: marginX,
    y: yPosition,
    size: 9,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  page.drawLine({
    start: { x: marginX, y: yPosition - 4 },
    end: { x: marginX + 200, y: yPosition - 4 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 20;
  // Draw "Sahihi:" label first to ensure it's visible
  page.drawText('Sahihi:', {
    x: marginX,
    y: yPosition,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  let customerBottomY = yPosition - 4;
  
  // Embed signature image if provided
  if (data.signatureDataUrl) {
    try {
      const base64Data = data.signatureDataUrl.split(',')[1] || data.signatureDataUrl;
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      let signatureImage;
      try {
        signatureImage = await pdfDoc.embedPng(imageBytes);
      } catch {
        signatureImage = await pdfDoc.embedJpg(imageBytes);
      }
      
      const signatureDims = signatureImage.scale(0.2);
      const sigHeight = Math.min(signatureDims.height, 40);
      const sigY = yPosition - 40; // Position signature below the "Sahihi:" label
      
      page.drawImage(signatureImage, {
        x: marginX,
        y: sigY,
        width: Math.min(signatureDims.width, 140),
        height: sigHeight,
      });
      
      customerBottomY = sigY;
    } catch (error) {
      console.error('Error embedding signature:', error);
      page.drawLine({
        start: { x: marginX, y: yPosition - 4 },
        end: { x: marginX + 200, y: yPosition - 4 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
    }
  } else {
    page.drawLine({
      start: { x: marginX, y: yPosition - 4 },
      end: { x: marginX + 200, y: yPosition - 4 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }
  
  // Right side - Company signature (aligned at same Y as left header)
  let rightY = headerY;
  page.drawText('CCTV POINT (BZ TECH Co. LTD)', {
    x: width / 2 + 20,
    y: rightY,
    size: 11,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  rightY -= 18;
  page.drawText('Jina:', {
    x: width / 2 + 20,
    y: rightY,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  rightY -= 15;
  page.drawText('BZ TECH COMPANY LIMITED', {
    x: width / 2 + 20,
    y: rightY,
    size: 9,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  rightY -= 18;
  page.drawLine({
    start: { x: width / 2 + 20, y: rightY },
    end: { x: width / 2 + 220, y: rightY },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  rightY -= 18;
  page.drawText('Nafasi:', {
    x: width / 2 + 20,
    y: rightY,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  rightY -= 15;
  page.drawText(data.managerPosition || 'Director / Manager', {
    x: width / 2 + 20,
    y: rightY,
    size: 9,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  });
  
  rightY -= 18;
  page.drawLine({
    start: { x: width / 2 + 20, y: rightY },
    end: { x: width / 2 + 220, y: rightY },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  rightY -= 18;
  page.drawText('Sahihi:', {
    x: width / 2 + 20,
    y: rightY,
    size: 9,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  let managerBottomY = rightY - 4;
  
  // Embed manager signature image if provided
  if (data.managerSignatureDataUrl) {
    try {
      const base64Data = data.managerSignatureDataUrl.split(',')[1] || data.managerSignatureDataUrl;
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      let signatureImage;
      try {
        signatureImage = await pdfDoc.embedPng(imageBytes);
      } catch {
        signatureImage = await pdfDoc.embedJpg(imageBytes);
      }
      
      const signatureDims = signatureImage.scale(0.2);
      const sigHeight = Math.min(signatureDims.height, 40);
      const sigY = rightY - 40; // Position signature below the "Sahihi:" label
      
      page.drawImage(signatureImage, {
        x: width / 2 + 20,
        y: sigY,
        width: Math.min(signatureDims.width, 140),
        height: sigHeight,
      });
      
      managerBottomY = sigY;
    } catch (error) {
      console.error('Error embedding manager signature:', error);
      page.drawLine({
        start: { x: width / 2 + 20, y: rightY - 4 },
        end: { x: width / 2 + 220, y: rightY - 4 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
    }
  } else {
    page.drawLine({
      start: { x: width / 2 + 20, y: rightY - 4 },
      end: { x: width / 2 + 220, y: rightY - 4 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }
  
  const companyBottomY = managerBottomY;
  const lowestY = Math.min(customerBottomY, companyBottomY);
  
  // Footer
  let footerY = lowestY - 30;
  
  if (footerY < 80) {
    page = pdfDoc.addPage([595, 842]);
    footerY = height - 70;
  }
  
  page.drawLine({
    start: { x: marginX, y: footerY + 15 },
    end: { x: width - marginX, y: footerY + 15 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  
  // Embed and draw brand logos
  const logoHeight = 12;
  const logoSpacing = 8;
  let currentX = marginX;
  
  try {
    // HIKVISION
    try {
      const hikvisionResponse = await fetch('/img/hikvision.png');
      if (hikvisionResponse.ok) {
        const hikvisionBytes = await hikvisionResponse.arrayBuffer();
        let hikvisionImage;
        try {
          hikvisionImage = await pdfDoc.embedPng(hikvisionBytes);
        } catch {
          hikvisionImage = await pdfDoc.embedJpg(hikvisionBytes);
        }
        const hikvisionDims = hikvisionImage.scale(logoHeight / hikvisionImage.height);
        page.drawImage(hikvisionImage, {
          x: currentX,
          y: footerY - 2,
          width: hikvisionDims.width,
          height: logoHeight,
        });
        currentX += hikvisionDims.width + logoSpacing;
      }
    } catch (e) {
      console.warn('Could not load HIKVISION logo:', e);
    }
    
    // Separator
    page.drawText('|', {
      x: currentX,
      y: footerY + 2,
      size: 7,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    currentX += 8;
    
    // Dahua
    try {
      const dahuaResponse = await fetch('/img/dahua.png');
      if (dahuaResponse.ok) {
        const dahuaBytes = await dahuaResponse.arrayBuffer();
        let dahuaImage;
        try {
          dahuaImage = await pdfDoc.embedPng(dahuaBytes);
        } catch {
          dahuaImage = await pdfDoc.embedJpg(dahuaBytes);
        }
        const dahuaDims = dahuaImage.scale(logoHeight / dahuaImage.height);
        page.drawImage(dahuaImage, {
          x: currentX,
          y: footerY - 2,
          width: dahuaDims.width,
          height: logoHeight,
        });
        currentX += dahuaDims.width + logoSpacing;
      }
    } catch (e) {
      console.warn('Could not load Dahua logo:', e);
    }
    
    // Separator
    page.drawText('|', {
      x: currentX,
      y: footerY + 2,
      size: 7,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    currentX += 8;
    
    // Halsens (text only - no image available)
    page.drawText('Halsens LET\'S TRADE GLOBALLY', {
      x: currentX,
      y: footerY + 2,
      size: 7,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });
    currentX += 120;
    
    // Separator
    page.drawText('|', {
      x: currentX,
      y: footerY + 2,
      size: 7,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    currentX += 8;
    
    // NEMTEK
    try {
      const nemtekResponse = await fetch('/img/nemtek.png');
      if (nemtekResponse.ok) {
        const nemtekBytes = await nemtekResponse.arrayBuffer();
        let nemtekImage;
        try {
          nemtekImage = await pdfDoc.embedPng(nemtekBytes);
        } catch {
          nemtekImage = await pdfDoc.embedJpg(nemtekBytes);
        }
        const nemtekDims = nemtekImage.scale(logoHeight / nemtekImage.height);
        page.drawImage(nemtekImage, {
          x: currentX,
          y: footerY - 2,
          width: nemtekDims.width,
          height: logoHeight,
        });
        currentX += nemtekDims.width + logoSpacing;
      }
    } catch (e) {
      console.warn('Could not load NEMTEK logo:', e);
    }
    
    // Separator
    page.drawText('|', {
      x: currentX,
      y: footerY + 2,
      size: 7,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    currentX += 8;
    
    // Cudy
    try {
      const cudyResponse = await fetch('/img/cudy.png');
      if (cudyResponse.ok) {
        const cudyBytes = await cudyResponse.arrayBuffer();
        let cudyImage;
        try {
          cudyImage = await pdfDoc.embedPng(cudyBytes);
        } catch {
          cudyImage = await pdfDoc.embedJpg(cudyBytes);
        }
        const cudyDims = cudyImage.scale(logoHeight / cudyImage.height);
        page.drawImage(cudyImage, {
          x: currentX,
          y: footerY - 2,
          width: cudyDims.width,
          height: logoHeight,
        });
        currentX += cudyDims.width + logoSpacing;
      }
    } catch (e) {
      console.warn('Could not load Cudy logo:', e);
    }
    
    // Separator
    page.drawText('|', {
      x: currentX,
      y: footerY + 2,
      size: 7,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    currentX += 8;
    
    // Tiandy
    try {
      const tiandyResponse = await fetch('/img/tiandy.jpeg');
      if (tiandyResponse.ok) {
        const tiandyBytes = await tiandyResponse.arrayBuffer();
        let tiandyImage;
        try {
          tiandyImage = await pdfDoc.embedPng(tiandyBytes);
        } catch {
          tiandyImage = await pdfDoc.embedJpg(tiandyBytes);
        }
        const tiandyDims = tiandyImage.scale(logoHeight / tiandyImage.height);
        page.drawImage(tiandyImage, {
          x: currentX,
          y: footerY - 2,
          width: tiandyDims.width,
          height: logoHeight,
        });
      }
    } catch (e) {
      console.warn('Could not load Tiandy logo:', e);
    }
  } catch (error) {
    // Fallback to text if images fail to load
    console.warn('Error loading brand logos, falling back to text:', error);
    page.drawText('HIKVISION | @lhua TECHNOLOGY | Halsens LET\'S TRADE GLOBALLY | NEMTEK Electric Fencing Products | cudy | Tiandy', {
      x: marginX,
      y: footerY,
      size: 7,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
      maxWidth: width - 2 * marginX,
    });
  }
  
  // Serialize the PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
