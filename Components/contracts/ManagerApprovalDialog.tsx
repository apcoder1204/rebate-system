import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { CheckCircle, XCircle, PenTool, Eye } from "lucide-react";
import { Contract } from "@/entities/Contract";
import SignaturePad from "./SignaturePad";
import { ContractPreviewDialog } from "./index";
import { useToast } from "@/Context/ToastContext";

interface ManagerApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: any;
  currentUser: any;
}

export default function ManagerApprovalDialog({
  open,
  onClose,
  onSuccess,
  contract,
  currentUser,
}: ManagerApprovalDialogProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [managerName, setManagerName] = useState(currentUser?.full_name || "");
  const [managerPosition, setManagerPosition] = useState("Director / Manager");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
    setShowSignaturePad(false);
  };

  const handleSignatureCancel = () => {
    setShowSignaturePad(false);
  };

  const handleApprove = async () => {
    if (!managerName.trim()) {
      showWarning("Please enter your name");
      return;
    }
    if (!managerPosition.trim()) {
      showWarning("Please enter your position");
      return;
    }
    if (!signatureDataUrl) {
      showWarning("Please provide your signature");
      return;
    }

    setApproving(true);
    try {
      await Contract.update(contract.id, {
        manager_name: managerName,
        manager_position: managerPosition,
        manager_signature_data_url: signatureDataUrl,
        status: "active", // Set directly to active when approved
        approved_by: currentUser?.id,
      });

      showSuccess("Contract approved successfully! The customer can now track orders and rebates.", 6000);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error approving contract:", error);
      showError("Failed to approve contract. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      showWarning("Please provide a reason for rejection");
      setShowRejectDialog(true);
      return;
    }

    setRejecting(true);
    try {
      await Contract.update(contract.id, {
        status: "rejected",
      });

      showSuccess("Contract rejected successfully.", 5000);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error rejecting contract:", error);
      showError("Failed to reject contract. Please try again.");
    } finally {
      setRejecting(false);
      setShowRejectDialog(false);
      setRejectionReason("");
    }
  };

  const handleClose = () => {
    setManagerName(currentUser?.full_name || "");
    setManagerPosition("Director / Manager");
    setSignatureDataUrl(null);
    setShowSignaturePad(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              Approve Contract
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {/* Contract Info */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Contract Details</h3>
              <div className="space-y-1 text-sm text-slate-600">
                <p><span className="font-medium">Contract Number:</span> {contract.contract_number}</p>
                <p><span className="font-medium">Customer:</span> {contract.customer_name}</p>
                <p><span className="font-medium">Email:</span> {contract.customer_email}</p>
                <p>
                  <span className="font-medium">Period:</span>{" "}
                  {contract.start_date && new Date(contract.start_date).toLocaleDateString()} -{" "}
                  {contract.end_date && new Date(contract.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Manager Details */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Your Name (CCTV POINT Representative)
              </label>
              <Input
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Your Position
              </label>
              <Input
                value={managerPosition}
                onChange={(e) => setManagerPosition(e.target.value)}
                placeholder="e.g., Director, Manager"
                required
              />
            </div>

            {/* Signature Section */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Your Signature (CCTV POINT)
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

              <p className="text-xs text-slate-500 mt-2">
                Draw your signature using your mouse or touchscreen. This signature will be added to the CCTV POINT (BZ TECH Co. LTD) section of the contract.
              </p>
            </div>

            {/* Preview Button */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Contract with Your Signature
              </Button>
            </div>

            {/* Rejection Reason - Show when reject button is clicked */}
            {showRejectDialog && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for Rejection *
                </label>
                <Input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection"
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-6 border-t border-slate-100 mt-6">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!showRejectDialog) {
                  setShowRejectDialog(true);
                } else {
                  handleReject();
                }
              }}
              disabled={approving || rejecting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              {rejecting ? "Rejecting..." : showRejectDialog ? "Confirm Rejection" : "Reject"}
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approving || rejecting || !signatureDataUrl || !managerName.trim() || !managerPosition.trim()}
              className="bg-gradient-to-r from-green-600 to-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {approving ? "Approving..." : "Approve Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog with Manager Signature */}
      {showPreview && (
        <ContractPreviewDialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          onUpload={() => {}}
          user={null}
          contractData={{
            ...contract,
            manager_name: managerName,
            manager_position: managerPosition,
            manager_signature_data_url: signatureDataUrl,
          }}
        />
      )}
    </>
  );
}
