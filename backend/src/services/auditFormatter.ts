function fmtAmount(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `Tsh ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const AuditFormatter = {
  updateSetting(actorName: string, key: string, oldValue: string | null, newValue: string): string {
    const label = key.replace(/_/g, ' ');
    if (oldValue !== null && oldValue !== undefined) {
      return `${actorName} updated system setting "${label}" from "${oldValue}" to "${newValue}".`;
    }
    return `${actorName} set system setting "${label}" to "${newValue}".`;
  },

  activateUser(actorName: string, targetName: string, targetEmail: string): string {
    return `${actorName} activated the account of ${targetName} (${targetEmail}).`;
  },

  deactivateUser(actorName: string, targetName: string, targetEmail: string): string {
    return `${actorName} deactivated the account of ${targetName} (${targetEmail}).`;
  },

  triggerOrderReminders(actorName: string, emailsSent: number, errors: number): string {
    const errNote = errors > 0 ? ` (${errors} error(s) encountered)` : '';
    return `${actorName} triggered order reminder emails — ${emailsSent} reminder(s) sent${errNote}.`;
  },

  lockOrder(actorName: string, orderNumber: string, customerName: string): string {
    return `${actorName} manually locked order ${orderNumber} for customer ${customerName}.`;
  },

  unlockOrder(actorName: string, orderNumber: string, customerName: string): string {
    return `${actorName} manually unlocked order ${orderNumber} for customer ${customerName}.`;
  },

  payRebate(actorName: string, customerName: string, totalPaid: number, orderCount: number, notes: string | null): string {
    const base = `${actorName} paid a rebate of ${fmtAmount(totalPaid)} to ${customerName} covering ${orderCount} order(s).`;
    return notes ? `${base} Note: ${notes}` : base;
  },

  requestRebate(customerName: string, contractNumber: string, totalRebateAmount: number): string {
    return `${customerName} submitted a rebate request for contract ${contractNumber} (amount: ${fmtAmount(totalRebateAmount)}).`;
  },

  approveRebate(actorName: string, customerName: string, contractNumber: string, totalRebateAmount: number | string): string {
    return `${actorName} approved the rebate request from ${customerName} for contract ${contractNumber} and paid ${fmtAmount(totalRebateAmount)}.`;
  },

  rejectRebate(actorName: string, customerName: string, contractNumber: string, totalRebateAmount: number | string, staffNotes: string | null): string {
    const reason = staffNotes ? ` Reason: ${staffNotes}` : '';
    return `${actorName} rejected the rebate request from ${customerName} for contract ${contractNumber} (${fmtAmount(totalRebateAmount)}).${reason}`;
  },

  renewContract(actorName: string, customerName: string, sourceContractNumber: string, newContractNumber: string, renewalCount: number): string {
    return `${actorName} renewed contract ${sourceContractNumber} for customer ${customerName} — new contract ${newContractNumber} created (renewal #${renewalCount}).`;
  },

  approveRenewal(actorName: string, customerName: string, contractNumber: string): string {
    return `${actorName} approved the renewal of contract ${contractNumber} for customer ${customerName} — contract is now active.`;
  },

  bulkExpireContracts(actorName: string, count: number): string {
    return `${actorName} manually ended the program cycle — ${count} active contract(s) set to expired.`;
  },
};
