import React, { useRef } from 'react';
import { format } from 'date-fns';
import { Button } from '@/Components/ui/button';
import { Printer } from 'lucide-react';
import cctvpointLogo from '../../cctvpointLogo.png';

interface ContractPreviewProps {
  customer: any;
  startDate: string;
  endDate: string;
  contractNumber?: string;
}

export default function ContractPreview({ customer, startDate, endDate, contractNumber }: ContractPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = () => {
    // This is a simple print implementation. 
    // Ideally you would use window.print() with print-specific styles
    // or use a library like react-to-print.
    // For now we just focus on the display component.
  };

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400">
        Please select a customer to view the contract preview
      </div>
    );
  }

  const currentDate = new Date();
  const formattedDate = format(currentDate, 'MMMM d, yyyy');
  const userName = customer.full_name ? customer.full_name.toUpperCase() : "____________________";
  const userPhone = customer.phone ? customer.phone : "____________________";
  const contractNum = contractNumber || "PENDING";

  return (
    <div className="w-full bg-slate-100 p-4 md:p-8 overflow-y-auto max-h-[80vh] flex flex-col items-center">
      {/* A4 Paper-like container */}
      <div 
        ref={previewRef}
        className="bg-white shadow-2xl w-full max-w-[210mm] min-h-[297mm] p-[20mm] md:p-[25mm] text-black text-sm relative"
        style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
      >
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-5 mb-4">
            <div className="flex-shrink-0">
              <img src={cctvpointLogo} alt="CCTV Point Logo" className="h-20 w-auto object-contain" />
            </div>
            <div className="flex-1 text-right">
              <h1 className="text-xl font-bold mb-1">BZ TECH CO. LIMITED & CCTV POINT</h1>
              <div className="text-xs space-y-1">
                <p>ADDRESS: ILOMBA Mbeya & Kabwe Mbeya</p>
                <p>Phone: +255 759 875 769 | Email: bztechco.ltd.tz@gmail.com</p>
              </div>
            </div>
          </div>
          <div className="border-b-2 border-black my-4 w-full"></div>
          <h2 className="text-lg font-bold underline text-center">MKATABA WA SHUKRANI KWA WATEJA WETU</h2>
        </div>

        {/* Content */}
        <div className="space-y-4 text-justify leading-relaxed">
          <p>
            Sisi kama CCTV POINT (BZ TECH COMPANY LTD) tumeona ni vyema kutengeneza makubaliano maalumu ya shukrani kati yetu na mteja wetu.
          </p>

          <div>
            <p className="mb-2">Sisi CCTV POINT tuna wateja wa aina tatu (3) ambao ni:</p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Whole sales customers (wateja wa jumla).</li>
              <li>End user customers (mteja wa mwisho).</li>
              <li>Technician (fundi/engineer ambaye ndiye mteja wetu wa kila siku).</li>
            </ol>
          </div>

          <p>
            HIVYO, kwa aina hii ya wateja mkataba huu ni mahsusi kwa wateja wetu kundi la tatu ambao ni mtaalamu/fundi au engineer. Sisi tunaamini wewe ndio mteja wetu wa thamani wa kila siku.
          </p>

          <p>
            Ndio maana CCTV POINT (BZ TECH Co. LTD) tumeona katika kuendeleza ushirikiano na ustawi baina yetu kwa kuwa tunatambua na kuthamini mchango wako.
          </p>

          <p className="font-medium">
            MKATABA huu utakuwa ni baina ya BZ TECH COMPANY LIMITED (CCTV POINT) na <strong>{userName}</strong> (fundi/mtaalamu/engineer) anaepatikana mwenye nambari ya simu <strong>{userPhone}</strong>.
          </p>

          <p>
            KWAMBA, mkataba huu wa shukrani utadumu kwa muda wa miezi sita (6) au vipindi viwili kwa mwaka.
            {startDate && endDate && (
              <span className="block mt-1 text-slate-600 italic text-xs">
                (Kuanzia {format(new Date(startDate), 'dd/MM/yyyy')} hadi {format(new Date(endDate), 'dd/MM/yyyy')})
              </span>
            )}
          </p>

          <p>
            NA mkataba huu utavunjwa pale tu wakati utakapomalizika.
          </p>

          <p>
            Mkataba huu utahusisha bidhaa zote zitakazonunuliwa kutoka katika kampuni yetu kwa gharama ile ya kiufundi.
          </p>

          <p>
            KWAMBA, kwa fundi/mtaalamu/engineer kila atakapochukua bidhaa/mzigo atatakiwa kusaini fomu maalumu iliombatanishwa nyuma ya mkataba huu au kuja kusaini endapo bidhaa/mzigo utatumwa.
          </p>

          <p>
            MKATABA huu utakuwa na shukrani ya asilimia moja (1%) kwa kila bidhaa itakayonunuliwa na fundi.
          </p>

          <p>
            Mkataba huu umesainiwa leo tarehe <span className="underline decoration-dotted">{format(currentDate, 'dd')}</span> mwezi <span className="underline decoration-dotted">{format(currentDate, 'MMMM')}</span> mwaka <span className="underline decoration-dotted">{format(currentDate, 'yyyy')}</span> KATI ya CCTV POINT (BZ TECH Co. LIMITED) na <strong>{userName}</strong>.
          </p>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-12 pt-8">
            <div>
              <p className="font-bold mb-4">FUNDI/MTAALAMU/ENGINEER</p>
              <div className="space-y-4">
                <p>Jina: <strong>{userName}</strong></p>
                <p>Sahihi: ____________________</p>
              </div>
            </div>
            
            <div>
              <p className="font-bold mb-4">CCTV POINT (BZ TECH Co. LTD)</p>
              <div className="space-y-4">
                <p>Jina: ____________________</p>
                <p>Nafasi: ____________________</p>
                <p>Sahihi: ____________________</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-center text-slate-400">
             Contract ID: {contractNum}
          </div>
        </div>
      </div>
    </div>
  );
}

