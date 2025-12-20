import React, { useState } from "react";
import { Contract, ContractType } from "@/entities/Contract";
import { UploadFile } from "@/integrations/Core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Upload, FileText, Eye, PenTool, AlertCircle } from "lucide-react";
import ContractPreviewDialog from "./ContractPreviewDialog";
import SignaturePad from "./SignaturePad";
import { generateContractPDF } from "@/utils/contractPdfGenerator";
import { useToast } from "@/Context/ToastContext";

type UploadContractDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: { id: string; full_name?: string; phone?: string } | null;
};

export default function UploadContractDialog({ open, onClose, onSuccess, user }: UploadContractDialogProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [formData, setFormData] = useState({
    customer_id: user?.id || "",
    start_date: "",
    end_date: "",
  });
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(true); // Always show preview first
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [hasExistingContract, setHasExistingContract] = useState(false);
  const [checkingContract, setCheckingContract] = useState(false);

  // Check for existing contract when dialog opens
  React.useEffect(() => {
    const checkExistingContract = async () => {
      if (!open || !user?.id) return;
      
      setCheckingContract(true);
      try {
        const existingContracts = await Contract.filter({ customer_id: user.id });
        setHasExistingContract(existingContracts.length > 0);
      } catch (error) {
        console.error("Error checking existing contracts:", error);
        setHasExistingContract(false);
      } finally {
        setCheckingContract(false);
      }
    };

    checkExistingContract();
  }, [open, user?.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Auto-calculate end date (6 months from start date)
  React.useEffect(() => {
    if (formData.start_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 6);
      
      // Format as YYYY-MM-DD
      const formattedEndDate = endDate.toISOString().split('T')[0];
      setFormData(prev => ({
        ...prev,
        end_date: formattedEndDate
      }));
    }
  }, [formData.start_date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for existing contract before submission
    if (hasExistingContract) {
      showWarning("You already have a contract. You can only have one contract at a time. Please manage your existing contract from the My Contracts page.");
      return;
    }

    // Double-check before creating
    try {
      const existingContracts = await Contract.filter({ customer_id: formData.customer_id });
      if (existingContracts.length > 0) {
        showWarning("You already have a contract. You can only have one contract at a time. Please manage your existing contract from the My Contracts page.");
        onSuccess(); // Refresh the contracts list
        handleClose();
        return;
      }
    } catch (error) {
      console.error("Error checking contracts:", error);
    }
    
    if (!formData.customer_id || !formData.start_date || !formData.end_date) {
      showWarning("Please fill in all required fields");
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      showWarning("End date must be after start date");
      return;
    }

    if (!agreedToTerms) {
      showWarning("Please agree to the terms and conditions first.");
      return;
    }

    if (!signatureDataUrl) {
      showWarning("Please provide your signature first.");
      return;
    }

    setUploading(true);
    try {
      // Generate PDF with signature embedded
      const pdfBytes = await generateContractPDF({
        customerName: user?.full_name || 'Unknown',
        customerPhone: user?.phone || 'Not provided',
        startDate: formData.start_date,
        endDate: formData.end_date,
        signatureDataUrl: signatureDataUrl,
      });

      // Convert PDF bytes to File
      const pdfFile = new File([new Uint8Array(pdfBytes)], `contract-${Date.now()}.pdf`, {
        type: 'application/pdf',
      });

      // Upload the PDF
      const uploadResult = await UploadFile(pdfFile);

      // Create contract with pending_approval status when customer signs
      const contract = await Contract.create({
        customer_id: formData.customer_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        rebate_percentage: 1,
        status: 'pending_approval',
        signed_contract_url: uploadResult.url,
        customer_signature_data_url: signatureDataUrl,
      });

      // Reset form
      setSignatureDataUrl(null);
      setShowSignaturePad(false);
      setAgreedToTerms(false);
      setFormData({
        customer_id: user?.id || "",
        start_date: "",
        end_date: "",
      });

      showSuccess("Contract is successfully signed. Waiting for the approval from administration office.", 6000);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error creating contract:", error);
      showError("Failed to create contract. Please try again.");
    }
    setUploading(false);
  };

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
    setShowSignaturePad(false);
  };

  const handleSignatureCancel = () => {
    setShowSignaturePad(false);
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
  };

  const handleClose = () => {
    // Reset form state when closing
    setSignatureDataUrl(null);
    setShowSignaturePad(false);
    setAgreedToTerms(false);
    setShowPreview(true);
    setFormData({
      customer_id: user?.id || "",
      start_date: "",
      end_date: "",
    });
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Upload Contract
            </DialogTitle>
          </DialogHeader>
          
          {checkingContract ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : hasExistingContract ? (
            <div className="mt-6 p-6 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Contract Already Exists</h3>
                  <p className="text-sm text-red-700">
                    You already have a contract uploaded. You can only have one contract at a time. 
                    Please manage your existing contract from the My Contracts page.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              {/* Contract Preview Button - User clicks to view contract */}
              <div className="mb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  className="w-full"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Contract
                </Button>
              </div>

              {/* Terms and Conditions Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    if (!e.target.checked) {
                      setShowSignaturePad(false);
                      setSignatureDataUrl(null);
                    }
                  }}
                  className="mt-1 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="agreeTerms" className="text-sm text-slate-700 cursor-pointer">
                  I have read and agree to the terms and conditions of this contract. I understand that this contract will last for exactly 6 months from the start date.
                </label>
              </div>

              {/* Date Fields - Only shown after agreeing to terms */}
              {agreedToTerms && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="end_date">End Date *</Label>
                    <Input
                      id="end_date"
                      name="end_date"
                      type="date"
                      value={formData.end_date}
                      disabled
                      className="mt-1 bg-slate-100"
                    />
                    <p className="text-xs text-slate-500 mt-1">Automatically set to 6 months from start date</p>
                  </div>
                </div>
              )}

              {/* Signature Section - Only shown after dates are set */}
              {agreedToTerms && formData.start_date && formData.end_date && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Your Signature *
                  </label>
                  
                  {!showSignaturePad && !signatureDataUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowSignaturePad(true)}
                      className="w-full"
                    >
                      <PenTool className="w-4 h-4 mr-2" />
                      Sign with Digital Signature Pad
                    </Button>
                  )}
                  
                  {showSignaturePad && (
                    <SignaturePad
                      onSave={handleSignatureSave}
                      onCancel={handleSignatureCancel}
                    />
                  )}
                  
                  {signatureDataUrl && !showSignaturePad && (
                    <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-16 border border-slate-300 rounded bg-white p-2">
                            <img
                              src={signatureDataUrl}
                              alt="Signature"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-700">
                              ✓ Signature captured
                            </p>
                            <p className="text-xs text-slate-600">
                              Your signature will be embedded in the contract
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowSignaturePad(true);
                            setSignatureDataUrl(null);
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!checkingContract && (
            <DialogFooter className="pt-6 border-t border-slate-100 mt-6">
              <Button variant="outline" onClick={handleClose}>
                {hasExistingContract ? "Close" : "Cancel"}
              </Button>
              {!hasExistingContract && (
                <Button 
                  onClick={handleSubmit} 
                  disabled={uploading}
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                >
                  {uploading ? "Creating..." : "Create Contract"}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ContractPreviewDialog
        open={showPreview}
        onClose={handleClosePreview}
        onUpload={() => {
          handleClosePreview();
          handleSubmit(new Event('submit') as any);
        }}
        user={user}
        contractData={{
          start_date: formData.start_date,
          end_date: formData.end_date,
          signatureDataUrl: signatureDataUrl,
        }}
      />
    </>
  );
}
