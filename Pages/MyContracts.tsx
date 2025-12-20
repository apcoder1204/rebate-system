import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Contract } from "@/entities/Contract";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Eye, PenTool } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { ContractCard } from "@/Components/contracts";
import ContractPreviewDialog from "@/Components/contracts/ContractPreviewDialog";
import SignaturePad from "@/Components/contracts/SignaturePad";
import { generateContractPDF } from "@/utils/contractPdfGenerator";
import { UploadFile } from "@/integrations/Core";
import { useToast } from "@/Context/ToastContext";

export default function MyContracts() {
  const [user, setUser] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  
  // Form state
  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      if (currentUser.role === 'admin') {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setUser(currentUser);
      const userContracts = await Contract.filter({ customer_id: currentUser.id }, '-created_date');
      setContracts(userContracts);
    } catch (error) {
      console.error("Error loading contracts:", error);
      navigate(createPageUrl("Home"));
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-calculate end date (6 months from start date)
  useEffect(() => {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
    setShowSignaturePad(false);
  };

  const handleSignatureCancel = () => {
    setShowSignaturePad(false);
  };

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      showWarning("Please agree to the terms and conditions first.");
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      showWarning("Please select a start date.");
      return;
    }

    if (!signatureDataUrl) {
      showWarning("Please provide your signature first.");
      return;
    }

    setSubmitting(true);
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
      await Contract.create({
        customer_id: user?.id || "",
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
        start_date: "",
        end_date: "",
      });

      // Show success message
      showSuccess("Contract is successfully signed. Waiting for the approval from administration office.", 6000);

      // Reload contracts
      loadData();
    } catch (error) {
      console.error("Error creating contract:", error);
      showError("Failed to create contract. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">My Contracts</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage your rebate contracts</p>
        </div>

        {/* Contract Form - Always shown when no contract exists */}
        {contracts.length === 0 && (
          <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <div className="space-y-6">
                {/* Contract Preview Button */}
                <div>
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
                <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
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
                    className="mt-1 w-5 h-5 text-blue-600 dark:text-blue-400 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <label htmlFor="agreeTerms" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
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
                        className="mt-1 bg-slate-100 dark:bg-slate-700"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Automatically set to 6 months from start date</p>
                    </div>
                  </div>
                )}

                {/* Signature Section - Only shown after dates are set */}
                {agreedToTerms && formData.start_date && formData.end_date && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                      <div className="border-2 border-green-500 dark:border-green-600 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-16 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 p-2">
                              <img
                                src={signatureDataUrl}
                                alt="Signature"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                ✓ Signature captured
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
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

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    onClick={handleSubmit}
                    disabled={!agreedToTerms || !formData.start_date || !formData.end_date || !signatureDataUrl || submitting}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    {submitting ? "Creating..." : "Create Contract"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Contracts - Shown below the form */}
        {contracts.length > 0 && (
          <div className="space-y-6">
            <div className="grid gap-6">
              {contracts.map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))}
            </div>
          </div>
        )}

        {/* Contract Preview Dialog */}
        <ContractPreviewDialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          onUpload={() => {}}
          user={user}
          contractData={{
            start_date: formData.start_date,
            end_date: formData.end_date,
            signatureDataUrl: signatureDataUrl,
          }}
        />
      </div>
    </div>
  );
}