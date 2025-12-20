import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { Eye, Download, Upload, FileText } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';
import cctvpointLogo from '../../cctvpointLogo.png';
import hikvisionLogo from '../../img/hikvision.png';
import dahuaLogo from '../../img/dahua.png';
import nemtekLogo from '../../img/nemtek.png';
import cudyLogo from '../../img/cudy.png';
import tiandyLogo from '../../img/tiandy.jpeg';
import { useToast } from "@/Context/ToastContext";

interface ContractPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
  user: any;
  contractData: {
    start_date?: string;
    end_date?: string;
    signatureDataUrl?: string | null;
  } | null;
}

export default function ContractPreviewDialog({ 
  open, 
  onClose, 
  onUpload, 
  user, 
  contractData 
}: ContractPreviewDialogProps) {
  const { showError } = useToast();
  const isViewingExisting = contractData && (contractData as any).customer_name;
  const displayUser = isViewingExisting ? {
    full_name: (contractData as any).customer_name,
    phone: (contractData as any).customer_phone || (contractData as any).phone || '____________________'
  } : user;
  
  // Debug: Log contract data to see what's available
  React.useEffect(() => {
    if (contractData && open) {
      console.log('Contract Preview Data:', {
        manager_signature_data_url: (contractData as any)?.manager_signature_data_url,
        manager_name: (contractData as any)?.manager_name,
        manager_position: (contractData as any)?.manager_position,
        status: (contractData as any)?.status,
        hasManagerSignature: !!(contractData as any)?.manager_signature_data_url,
        fullContract: contractData
      });
    }
  }, [contractData, open]);
  
  // Default to PDF view for existing contracts with signed PDF
  // Ensure URL is absolute - if relative, prepend API base URL
  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';
  let signedContractUrl = isViewingExisting ? (contractData as any).signed_contract_url : null;
  if (signedContractUrl && signedContractUrl.startsWith('/')) {
    // Relative path - make it absolute
    signedContractUrl = `${API_BASE_URL}${signedContractUrl}`;
  }
  const hasManagerSignature = !!(contractData as any)?.manager_signature_data_url;
  const [viewMode, setViewMode] = useState<'preview' | 'pdf'>(
    signedContractUrl && !hasManagerSignature ? 'pdf' : 'preview'
  );
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Generate merged PDF with logo and manager signature when viewing in PDF mode
  useEffect(() => {
    // Reset previous URL if it exists
    if (mergedPdfUrl) {
      URL.revokeObjectURL(mergedPdfUrl);
      setMergedPdfUrl(null);
    }
    
    const generateMergedPdf = async () => {
      if (
        isViewingExisting && 
        signedContractUrl && 
        viewMode === 'pdf' && 
        !loadingPdf
      ) {
        setLoadingPdf(true);
        try {
          const pdfResponse = await fetch(signedContractUrl);
          const pdfBytes = await pdfResponse.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pages = pdfDoc.getPages();
          const firstPage = pages[0];
          const { width, height } = firstPage.getSize();
          
          // Try to embed logo
          let logoImage = null;
          try {
            const logoResponse = await fetch(cctvpointLogo);
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
          
          // Add logo to header (left side)
          if (logoImage) {
            const logoDims = logoImage.scale(0.15);
            const logoHeight = Math.min(logoDims.height, 60);
            const logoX = 50; // Left margin
            const logoY = height - 50; // Top area
            
            firstPage.drawImage(logoImage, {
              x: logoX,
              y: logoY - logoHeight,
              width: logoDims.width * (logoHeight / logoDims.height),
              height: logoHeight,
            });
          }
          
          // Embed manager signature if available
          if (hasManagerSignature) {
            const managerSig = (contractData as any).manager_signature_data_url;
            const base64Data = managerSig.split(',')[1] || managerSig;
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            let signatureImage;
            try {
              signatureImage = await pdfDoc.embedPng(imageBytes);
            } catch {
              signatureImage = await pdfDoc.embedJpg(imageBytes);
            }
            
            // Position manager signature in CCTV POINT section (right side, bottom)
            // Approximate position based on contract layout
            const sigWidth = 140;
            const sigHeight = 40;
            const sigX = width * 0.55; // Right side area
            const sigY = height * 0.15; // Bottom signature area
            
            firstPage.drawImage(signatureImage, {
              x: sigX,
              y: sigY,
              width: sigWidth,
              height: sigHeight,
            });
          }
          
          const mergedPdfBytes = await pdfDoc.save();
          const blob = new Blob([mergedPdfBytes as BlobPart], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setMergedPdfUrl(url);
        } catch (error) {
          console.error('Error merging PDF:', error);
        } finally {
          setLoadingPdf(false);
        }
      }
    };
    
    generateMergedPdf();
    
    return () => {
      if (mergedPdfUrl) {
        URL.revokeObjectURL(mergedPdfUrl);
      }
    };
  }, [isViewingExisting, signedContractUrl, viewMode, hasManagerSignature, contractData]);

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Extract date parts for display in Swahili format
  const getDateParts = (dateString?: string) => {
    if (!dateString) return { day: '_______', month: '________', year: '________' };
    const date = new Date(dateString);
    const day = date.getDate().toString();
    const months = ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'];
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString();
    return { day, month, year };
  };
  
  const startDateParts = getDateParts(contractData?.start_date);
  const endDateParts = getDateParts(contractData?.end_date);

  const downloadTemplate = async () => {
    // Get customer signature - priority: customer_signature_data_url from DB, then signatureDataUrl from preview
    const customerSignature = (contractData as any)?.customer_signature_data_url || (contractData as any)?.signatureDataUrl;
    const managerSignature = (contractData as any)?.manager_signature_data_url;
    
    // Create a temporary div with the contract content
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = '210mm'; // A4 width
    tempDiv.style.padding = '20mm';
    tempDiv.style.fontFamily = 'Times New Roman, serif';
    tempDiv.style.fontSize = '12px';
    tempDiv.style.lineHeight = '1.6';
    tempDiv.style.color = '#000';
    tempDiv.style.background = 'white';
    tempDiv.style.position = 'relative';
    
    tempDiv.innerHTML = `
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 48px; color: rgba(0, 0, 0, 0.1); z-index: 1; pointer-events: none; white-space: nowrap;">CCTV POINT BZ TECH CO. LTD</div>
      
      <div style="position: relative; z-index: 2; background: white;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div style="flex-shrink: 0;">
            <img src="${cctvpointLogo}" alt="CCTV Point Logo" style="height: 80px; width: auto; object-fit: contain;" />
          </div>
          <div style="flex: 1; text-align: right; font-size: 11px; line-height: 1.3;">
            <div style="font-size: 20px; font-weight: bold; margin-bottom: 3px; text-transform: uppercase;">BZ TECH CO. LIMITED</div>
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; font-style: italic;">& CCTV POINT</div>
            <div>
              ADDRESS<br>
              ILOMBA Mbeya & Kabwe Mbeya<br>
              Phone: +255 759 875 769<br>
              Email: bztechco.ltd.tz@gmail.com
            </div>
          </div>
        </div>
        
        <div style="text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 12px 0; text-decoration: underline;">MKATABA WA SHUKRANI KWA WATEJA WETU</div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          Sisi kama CCTV POINT (BZ TECH COMPANY LTD) tumeona ni nyema kutengeneza makubaliano maalumu ya shukrani kati yetu na mteja wetu.
        </div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          Sisi CCTV POINT tuna wateja wa aina tatu (3) ambao ni:-
        </div>
        
        <ol style="margin: 5px 0; padding-left: 18px; font-size: 11px; line-height: 1.4;">
          <li style="margin-bottom: 3px;">Whole sales customers (wateja wa jumla).</li>
          <li style="margin-bottom: 3px;">End user customers (mteja wa mwisho).</li>
          <li style="margin-bottom: 3px;">Technician (fundi/engineer ambae ndie mteja wetu wa kila siku).</li>
        </ol>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          HIVYO, kwa aina hii ya wateja mkataba huu ni mahsusi kwa wateja wetu kundi la tatu ambao ni mtaalamu/fundi au engineer. Sisi tunaamini wewe ndio mteja wetu wa thamani wa kila siku.
        </div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          Ndio maana CCTV POINT (BZ TECH Co. LTD) tumeona katika kuendeleza ushirikiano na ustawi baina yetu kwa kuwa tunatambua na kuthamini mchango wako.
        </div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          MKATABA huu utakuwa ni baina ya BZ TECH COMPANY LIMITED (CCTV POINT) na <span style="font-weight: bold; text-decoration: underline;">${displayUser?.full_name || '____________________'}</span> (fundi/mtaalamu/engineer) anaepatikana mwenye nambari ya simu <span style="font-weight: bold; text-decoration: underline;">${displayUser?.phone || '____________________'}</span>.
        </div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          KWAMBA, mkataba huu wa shukrani utadumu kwa muda wa miezi sita (6) au vipindi viwili kwa mwaka.
        </div>
        
        
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          NA mkataba huu utavunjwa pale tu wakati utakapomalizika.
        </div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          Mkataba huu utahusisha bidhaa zote zitakazonunuliwa kutoka katika kampuni yetu kwa gharama ile ya kiufundi.
        </div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          KWAMBA, kwa fundi/mtaalamu/engineer kila atakapochukua bidhaa/mzigo atatakiwa kusaini fomu maalumu iliombatanishwa nyuma ya mkataba huu au kuja kusaini endapo bidhaa/mzigo utatumwa.
        </div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          MKATABA huu utakuwa na shukrani ya asilimia moja (1%) kwa kila bidhaa itakayonunuliwa na fundi.
        </div>
        
        <div style="text-align: justify; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
          Mkataba huu umesainiwa leo tarehe ${startDateParts.day} mwezi ${startDateParts.month} mwaka ${startDateParts.year} KATI ya CCTV POINT (BZ TECH Co. LIMITED) na <span style="font-weight: bold; text-decoration: underline;">${displayUser?.full_name || '____________________'}</span>.
        </div>
        
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-start; border-top: 2px solid #000; padding-top: 12px;">
          <div style="width: 45%;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 10px;">FUNDI/MTAALAMU/ENGINEER</div>
            <div style="margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 18px; font-size: 11px;">
              Jina: <span style="font-weight: bold; text-decoration: underline;">${displayUser?.full_name || '____________________'}</span>
            </div>
            <div style="margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 45px; font-size: 11px; position: relative;">
              <div style="margin-bottom: 2px;">Sahihi:</div>
              ${customerSignature ? `<img src="${customerSignature}" alt="Customer Signature" style="max-width: 160px; max-height: 40px; margin-top: 3px;" />` : '<div style="margin-top: 3px;">____________________</div>'}
            </div>
          </div>
          
          <div style="width: 45%;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 10px;">CCTV POINT (BZ TECH Co. LTD)</div>
            <div style="margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 18px; font-size: 11px;">
              Jina: ${(contractData as any)?.manager_name || 'BZ TECH COMPANY LIMITED'}
            </div>
            <div style="margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 18px; font-size: 11px;">
              Nafasi: ${(contractData as any)?.manager_position || 'Director / Manager'}
            </div>
            <div style="margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 45px; font-size: 11px; position: relative;">
              <div style="margin-bottom: 2px;">Sahihi:</div>
              ${managerSignature ? `<img src="${managerSignature}" alt="Manager Signature" style="max-width: 160px; max-height: 40px; margin-top: 3px;" />` : '<div style="margin-top: 3px;">____________________</div>'}
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <img src="${hikvisionLogo}" alt="HIKVISION" style="height: 20px; width: auto; object-fit: contain;" />
          <span style="color: #ccc;">|</span>
          <img src="${dahuaLogo}" alt="Dahua TECHNOLOGY" style="height: 20px; width: auto; object-fit: contain;" />
          <span style="color: #ccc;">|</span>
          <span style="margin: 0;">Halsens LET'S TRADE GLOBALLY</span>
          <span style="color: #ccc;">|</span>
          <img src="${nemtekLogo}" alt="NEMTEK" style="height: 20px; width: auto; object-fit: contain;" />
          <span style="color: #ccc;">|</span>
          <img src="${cudyLogo}" alt="cudy" style="height: 20px; width: auto; object-fit: contain;" />
          <span style="color: #ccc;">|</span>
          <img src="${tiandyLogo}" alt="Tiandy" style="height: 20px; width: auto; object-fit: contain;" />
        </div>
      </div>
    `;
    
    document.body.appendChild(tempDiv);
    
    try {
      // Convert to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Download the PDF
      // Use contract number for filename, fallback to generic name
      const contractNumber = (contractData as any)?.contract_number || 'Contract';
      pdf.save(`${contractNumber}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Error generating PDF. Please try again.');
    } finally {
      // Clean up
      document.body.removeChild(tempDiv);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="no-print px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              {isViewingExisting ? 'Contract Details' : 'Contract Preview'}
            </DialogTitle>
            {isViewingExisting && signedContractUrl && (
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'preview' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('preview')}
                >
                  HTML Preview
                </Button>
                <Button
                  variant={viewMode === 'pdf' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('pdf')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View PDF
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {isViewingExisting && signedContractUrl && viewMode === 'pdf' ? (
            loadingPdf ? (
              <div className="flex items-center justify-center h-[calc(95vh-120px)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                <p className="ml-4 text-slate-600">Processing PDF...</p>
              </div>
            ) : mergedPdfUrl ? (
              <div className="w-full h-[calc(95vh-120px)]">
                <iframe
                  src={mergedPdfUrl}
                  className="w-full h-full border-0 rounded-lg shadow-lg"
                  title="Contract PDF"
                />
              </div>
            ) : (
              <div className="w-full h-[calc(95vh-120px)]">
                <iframe
                  src={signedContractUrl}
                  className="w-full h-full border-0 rounded-lg shadow-lg"
                  title="Contract PDF"
                />
              </div>
            )
          ) : (
            // If manager has signed, show HTML preview (which has both signatures) instead of old PDF
            <div className="print-container max-w-4xl mx-auto bg-white shadow-2xl" style={{ minHeight: '29.7cm' }}>
            {/* Document Header */}
            <div className="flex items-center justify-center gap-5 py-4 px-12 border-b-2 border-slate-300">
              <div className="flex-shrink-0">
                <img src={cctvpointLogo} alt="CCTV Point Logo" className="h-20 w-auto object-contain" />
              </div>
              <div className="flex-1 text-right">
                <h1 className="text-xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'serif' }}>
                  BZ TECH CO. LIMITED
                </h1>
                <h2 className="text-lg font-semibold text-slate-800 mb-2" style={{ fontFamily: 'serif' }}>
                  & CCTV POINT
                </h2>
                <div className="text-xs text-slate-600 space-y-0.5" style={{ fontFamily: 'serif' }}>
                  <p className="font-semibold">ADDRESS</p>
                  <p>ILOMBA Mbeya & Kabwe Mbeya</p>
                  <p>Phone: +255 759 875 769</p>
                  <p>Email: bztechco.ltd.tz@gmail.com</p>
                </div>
              </div>
            </div>

            {/* Contract Title */}
            <div className="text-center py-3 px-12">
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide" style={{ fontFamily: 'serif' }}>
                MKATABA WA SHUKRANI KWA WATEJA WETU
              </h3>
            </div>

            {/* Contract Content */}
            <div className="px-12 py-3 space-y-3 text-slate-800 leading-tight" style={{ fontFamily: 'serif', fontSize: '12px' }}>
              <p className="text-justify">
                Sisi kama CCTV POINT (BZ TECH COMPANY LTD) tumeona ni nyema kutengeneza makubaliano maalumu ya shukrani kati yetu na mteja wetu.
              </p>

              <p className="text-justify">
                Sisi CCTV POINT tuna wateja wa aina tatu (3) ambao ni:-
              </p>
              <ol className="list-decimal list-inside ml-4 space-y-1 text-justify">
                <li>Whole sales customers (wateja wa jumla).</li>
                <li>End user customers (mteja wa mwisho).</li>
                <li>Technician (fundi/engineer ambae ndie mteja wetu wa kila siku).</li>
              </ol>

              <p className="text-justify">
                HIVYO, kwa aina hii ya wateja mkataba huu ni mahsusi kwa wateja wetu kundi la tatu ambao ni mtaalamu/fundi au engineer. Sisi tunaamini wewe ndio mteja wetu wa thamani wa kila siku.
              </p>

              <p className="text-justify">
                Ndio maana CCTV POINT (BZ TECH Co. LTD) tumeona katika kuendeleza ushirikiano na ustawi baina yetu kwa kuwa tunatambua na kuthamini mchango wako.
              </p>

              <p className="text-justify">
                MKATABA huu utakuwa ni baina ya BZ TECH COMPANY LIMITED (CCTV POINT) na <span className="font-bold text-slate-900 underline">{displayUser?.full_name || '____________________'}</span> (fundi/mtaalamu/engineer) anaepatikana mwenye nambari ya simu <span className="font-bold text-slate-900 underline">{displayUser?.phone || '____________________'}</span>.
              </p>

              <p className="text-justify">
                KWAMBA, mkataba huu wa shukrani utadumu kwa muda wa miezi sita (6) au vipindi viwili kwa mwaka.
              </p>

              <p className="text-justify">
                NA mkataba huu utavunjwa pale tu wakati utakapomalizika.
              </p>

              <p className="text-justify">
                Mkataba huu utahusisha bidhaa zote zitakazonunuliwa kutoka katika kampuni yetu kwa gharama ile ya kiufundi.
              </p>

              <p className="text-justify">
                KWAMBA, kwa fundi/mtaalamu/engineer kila atakapochukua bidhaa/mzigo atatakiwa kusaini fomu maalumu iliombatanishwa nyuma ya mkataba huu au kuja kusaini endapo bidhaa/mzigo utatumwa.
              </p>

              <p className="text-justify">
                MKATABA huu utakuwa na shukrani ya asilimia moja (1%) kwa kila bidhaa itakayonunuliwa na fundi.
              </p>

              <p className="text-justify">
                Mkataba huu umesainiwa leo tarehe <span className="font-bold">{startDateParts.day}</span> mwezi <span className="font-bold">{startDateParts.month}</span> mwaka <span className="font-bold">{startDateParts.year}</span> KATI ya CCTV POINT (BZ TECH Co. LIMITED) na <span className="font-bold text-slate-900 underline">{displayUser?.full_name || '____________________'}</span>.
              </p>
              
              <p className="text-justify">
                Mkataba huu utadumu kutoka tarehe <span className="font-bold">{startDateParts.day} {startDateParts.month} {startDateParts.year}</span> hadi tarehe <span className="font-bold">{endDateParts.day} {endDateParts.month} {endDateParts.year}</span>.
              </p>
            </div>

            {/* Signatures Section */}
            <div className="px-12 py-4 border-t-2 border-slate-300">
              <div className="grid grid-cols-2 gap-16">
                <div>
                  <h4 className="font-bold text-slate-900 text-base mb-4" style={{ fontFamily: 'serif' }}>
                    FUNDI/MTAALAMU/ENGINEER
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-sm"><span className="font-semibold">Jina:</span></p>
                      <div className="border-b border-slate-400 pb-1 h-5">
                        <span className="font-bold text-slate-900 text-sm">{displayUser?.full_name || '____________________'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-sm"><span className="font-semibold">Sahihi:</span></p>
                      <div className="border-b border-slate-400 pb-1 min-h-[50px] flex items-end pt-1">
                        {/* Priority: 1. customer_signature_data_url from DB, 2. signatureDataUrl from preview, 3. placeholder */}
                        {(contractData as any)?.customer_signature_data_url ? (
                          <img
                            src={(contractData as any).customer_signature_data_url}
                            alt="Customer Signature"
                            className="max-w-[180px] max-h-[45px] object-contain"
                            onError={(e) => {
                              console.error('Error loading customer signature:', e);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (contractData as any)?.signatureDataUrl ? (
                          <img
                            src={(contractData as any).signatureDataUrl}
                            alt="Customer Signature"
                            className="max-w-[180px] max-h-[45px] object-contain"
                          />
                        ) : signedContractUrl ? (
                          <p className="text-xs text-blue-600 italic">
                            Customer signature is in the uploaded PDF file.
                          </p>
                        ) : (
                          <span className="text-slate-500 text-sm">____________________</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-bold text-slate-900 text-base mb-4" style={{ fontFamily: 'serif' }}>
                    CCTV POINT (BZ TECH Co. LTD)
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-sm"><span className="font-semibold">Jina:</span></p>
                      <div className="border-b border-slate-400 pb-1 h-5">
                        <span className="font-bold text-slate-900 text-sm">
                          {(contractData as any)?.manager_name || 'BZ TECH COMPANY LIMITED'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-sm"><span className="font-semibold">Nafasi:</span></p>
                      <div className="border-b border-slate-400 pb-1 h-5">
                        <span className="font-bold text-slate-900 text-sm">
                          {(contractData as any)?.manager_position || 'Director / Manager'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-sm"><span className="font-semibold">Sahihi:</span></p>
                      <div className="border-b border-slate-400 pb-1 min-h-[50px] flex items-end pt-1">
                        {(contractData as any)?.manager_signature_data_url ? (
                          <img
                            src={(contractData as any).manager_signature_data_url}
                            alt="Manager Signature"
                            className="max-w-[180px] max-h-[45px] object-contain"
                            onError={(e) => {
                              console.error('Error loading manager signature:', e);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-slate-500 text-sm">____________________</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Company Logos Section */}
            <div className="px-12 py-3 border-t border-slate-200">
              <div className="flex flex-wrap justify-center items-center gap-3">
                <img src={hikvisionLogo} alt="HIKVISION" className="h-5 w-auto object-contain" />
                <span className="text-slate-300">|</span>
                <img src={dahuaLogo} alt="Dahua TECHNOLOGY" className="h-5 w-auto object-contain" />
                <span className="text-slate-300">|</span>
                <span className="text-[10px] text-slate-600 font-semibold">Halsens LET'S TRADE GLOBALLY</span>
                <span className="text-slate-300">|</span>
                <img src={nemtekLogo} alt="NEMTEK" className="h-5 w-auto object-contain" />
                <span className="text-slate-300">|</span>
                <img src={cudyLogo} alt="cudy" className="h-5 w-auto object-contain" />
                <span className="text-slate-300">|</span>
                <img src={tiandyLogo} alt="Tiandy" className="h-5 w-auto object-contain" />
              </div>
            </div>

            {/* Contract Details Section (for existing contracts) */}
            {contractData && (
              <div className="px-12 py-3 border-t border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-900 mb-2 text-sm" style={{ fontFamily: 'serif' }}>
                  Contract Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-700 mb-0.5">Contract Number:</p>
                    <p className="text-slate-900 font-mono text-xs">{(contractData as any).contract_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 mb-0.5">Start Date:</p>
                    <p className="text-slate-900 text-xs">{contractData.start_date}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 mb-0.5">End Date:</p>
                    <p className="text-slate-900 text-xs">{contractData.end_date}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 mb-0.5">Rebate Percentage:</p>
                    <p className="text-slate-900 text-xs">1%</p>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}
        </div>

        <DialogFooter className="no-print flex gap-3 px-6 py-4 border-t border-slate-200">
          {isViewingExisting ? (
            <>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Download className="w-4 h-4 mr-2" />
                Print Contract
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Download className="w-4 h-4 mr-2" />
                Print Preview
              </Button>
              <Button variant="outline" onClick={onClose}>
                Back to Upload
              </Button>
              <Button onClick={onUpload} className="bg-gradient-to-r from-blue-600 to-blue-700">
                <Upload className="w-4 h-4 mr-2" />
                Upload Signed Contract
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
