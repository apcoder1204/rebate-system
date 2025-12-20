import React, { useState, useEffect } from "react";
import { Contract } from "@/entities/Contract";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Combobox } from "@/Components/ui/combobox";
import { Textarea } from "@/Components/ui/textarea";
import { FileText, AlertCircle, CheckCircle, Eye, EyeOff, Pencil } from "lucide-react";
import ContractPreview from "./ContractPreview";

export default function CreateContractDialog({ open, onClose, onSuccess, customers, editingContract = null }) {
  const [formData, setFormData] = useState({
    customer_id: "",
    start_date: "",
    end_date: "",
    rebate_percentage: "1.00",
    status: "pending",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isStatusEditing, setIsStatusEditing] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingContract) {
        setFormData({
          customer_id: editingContract.customer_id || "",
          start_date: editingContract.start_date || "",
          end_date: editingContract.end_date || "",
          rebate_percentage: editingContract.rebate_percentage?.toString() || "1.00",
          status: editingContract.status || "pending",
        });
      } else {
        // Reset form for new contract
        setFormData({
          customer_id: "",
          start_date: "",
          end_date: "",
          rebate_percentage: "1.00",
          status: "pending",
        });
      }
      setErrors({});
      setShowPreview(false);
      setIsStatusEditing(false);
    } else {
      // Reset when dialog closes
      setFormData({
        customer_id: "",
        start_date: "",
        end_date: "",
        rebate_percentage: "1.00",
        status: "pending",
      });
      setErrors({});
      setSubmitting(false);
      setShowPreview(false);
      setIsStatusEditing(false);
    }
  }, [open, editingContract]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_id) {
      newErrors.customer_id = "Please select a customer";
    }

    if (!formData.start_date) {
      newErrors.start_date = "Start date is required";
    }

    if (!formData.end_date) {
      newErrors.end_date = "End date is required";
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) <= new Date(formData.start_date)) {
        newErrors.end_date = "End date must be after start date";
      }
    }

    const rebatePercent = parseFloat(formData.rebate_percentage);
    if (isNaN(rebatePercent) || rebatePercent < 0 || rebatePercent > 100) {
      newErrors.rebate_percentage = "Rebate percentage must be between 0 and 100";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user selects
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const calculateDuration = () => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const months = Math.floor(diffDays / 30);
      const days = diffDays % 30;
      return { days: diffDays, months, display: months > 0 ? `${months} months, ${days} days` : `${diffDays} days` };
    }
    return null;
  };

  const duration = calculateDuration();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const contractData = {
        customer_id: formData.customer_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        rebate_percentage: parseFloat(formData.rebate_percentage),
        status: formData.status,
      };

      if (editingContract) {
        await Contract.update(editingContract.id, contractData);
      } else {
        await Contract.create(contractData);
      }
      
      onSuccess();
      setFormData({
        customer_id: "",
        start_date: "",
        end_date: "",
        rebate_percentage: "1.00",
        status: "pending",
      });
      setErrors({});
      onClose();
    } catch (error: any) {
      console.error("Error saving contract:", error);
      setErrors({ submit: error.message || "Failed to save contract. Please try again." });
    }
    setSubmitting(false);
  };

  const selectedCustomer = customers.find((c: any) => c.id === formData.customer_id);

  const customerOptions = customers.map((c: any) => ({
    value: c.id,
    label: c.full_name || "Unknown Name",
    subLabel: c.email
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${showPreview ? 'sm:max-w-6xl' : 'sm:max-w-2xl'} max-h-[90vh] overflow-y-auto transition-all duration-300 p-6 md:p-8`}>
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {editingContract ? "Edit Contract" : "Create New Contract"}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              {showPreview ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide Preview
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show Preview
                </>
              )}
            </Button>
          </div>
        </DialogHeader>
        
        <div className={`grid ${showPreview ? 'grid-cols-1 lg:grid-cols-2 gap-8' : 'grid-cols-1'} mt-6`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Selection */}
            <div>
              <Label htmlFor="customer_id">Customer *</Label>
              <Combobox 
                options={customerOptions}
                value={formData.customer_id}
                onChange={(value) => handleSelectChange("customer_id", value)}
                disabled={!!editingContract}
                placeholder="Select a customer"
                className={`mt-1 ${errors.customer_id ? 'border-red-500' : ''}`}
              />
              {errors.customer_id && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.customer_id}
                </p>
              )}
              {selectedCustomer && (
                <p className="text-sm text-slate-600 mt-1">
                  {selectedCustomer.phone && `Phone: ${selectedCustomer.phone}`}
                </p>
              )}
            </div>

            {/* Date Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  className={`mt-1 ${errors.start_date ? 'border-red-500' : ''}`}
                  required
                />
                {errors.start_date && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.start_date}
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="end_date">End Date *</Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                  min={formData.start_date || undefined}
                  className={`mt-1 ${errors.end_date ? 'border-red-500' : ''}`}
                  required
                />
                {errors.end_date && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.end_date}
                  </p>
                )}
                {duration && !errors.end_date && (
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Duration: {duration.display}
                  </p>
                )}
              </div>
            </div>

            {/* Rebate Percentage and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="rebate_percentage">Rebate Percentage (%) *</Label>
                <Input
                  id="rebate_percentage"
                  name="rebate_percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.rebate_percentage}
                  onChange={handleInputChange}
                  className={`mt-1 ${errors.rebate_percentage ? 'border-red-500' : ''}`}
                  placeholder="1.00"
                  required
                />
                {errors.rebate_percentage && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.rebate_percentage}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Default is 1% (0.01). Enter as decimal (e.g., 1.5 for 1.5%)
                </p>
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                {!isStatusEditing ? (
                  <div className="mt-1 flex items-center justify-between p-2 border border-slate-200 rounded-md bg-slate-50">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${formData.status === 'active' ? 'bg-green-100 text-green-800' : 
                          formData.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          formData.status === 'expired' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'}`}>
                        {formData.status}
                      </span>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsStatusEditing(true)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Select 
                        value={formData.status} 
                        onValueChange={(value) => handleSelectChange("status", value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsStatusEditing(false)}
                      className="mt-1"
                    >
                      Done
                    </Button>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Current contract status
                </p>
              </div>
            </div>

            {/* Contract Info Display */}
            {editingContract && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-2">Contract Information</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-600">Contract Number:</span>
                    <span className="ml-2 font-mono">{editingContract.contract_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Created:</span>
                    <span className="ml-2">
                      {editingContract.created_date 
                        ? new Date(editingContract.created_date).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errors.submit}
                </p>
              </div>
            )}

            <DialogFooter className="md:col-span-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={submitting || customers.length === 0}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {submitting 
                  ? (editingContract ? "Updating..." : "Creating...") 
                  : (editingContract ? "Update" : "Create")}
              </Button>
            </DialogFooter>
          </form>

          {showPreview && (
            <div className="border-t lg:border-t-0 lg:border-l border-slate-200 lg:pl-8 pt-8 lg:pt-0">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Contract Preview</h3>
              <ContractPreview 
                customer={selectedCustomer}
                startDate={formData.start_date}
                endDate={formData.end_date}
                contractNumber={editingContract?.contract_number}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
