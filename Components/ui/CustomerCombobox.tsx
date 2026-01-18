import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search, X, Loader2 } from "lucide-react";
import { User } from "@/entities/User";

interface CustomerComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  includeAll?: boolean;
}

export function CustomerCombobox({ 
  value, 
  onChange, 
  placeholder = "Select customer...", 
  disabled = false,
  className = "",
  includeAll = false
}: CustomerComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Search customers on server
  const searchCustomers = useCallback(async (search: string) => {
    if (search.length < 2 && !includeAll) {
      setCustomers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await User.list(
        {
          search: search || undefined
        },
        1,
        100 // Get up to 100 results
      );
      
      // Filter to only customers (not admin, manager, staff)
      const customerUsers = response.data.filter(u => 
        !['admin', 'manager', 'staff'].includes(u.role || 'user')
      );
      
      setCustomers(customerUsers);
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [includeAll]);

  // Load selected customer if value is set
  useEffect(() => {
    const loadSelectedCustomer = async () => {
      if (value && value !== 'all') {
        try {
          const response = await User.list(undefined, 1, 100);
          const customer = response.data.find(u => u.id === value);
          if (customer) {
            setSelectedCustomer(customer);
          }
        } catch (error) {
          console.error('Error loading selected customer:', error);
        }
      } else {
        setSelectedCustomer(null);
      }
    };
    
    loadSelectedCustomer();
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (isOpen) {
      searchTimeoutRef.current = setTimeout(() => {
        searchCustomers(searchTerm);
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, isOpen, searchCustomers]);

  // Load initial customers when opening
  useEffect(() => {
    if (isOpen && customers.length === 0 && !loading) {
      searchCustomers('');
    }
  }, [isOpen, customers.length, loading, searchCustomers]);

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current && 
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const input = dropdownRef.current?.querySelector("input");
        if (input) input.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const options = [
    ...(includeAll ? [{ value: "all", label: "All customers", subLabel: "" }] : []),
    ...customers.map((c: any) => ({
      value: c.id,
      label: c.full_name || "Unknown Name",
      subLabel: c.email
    }))
  ];

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (option.subLabel && option.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex h-10 w-full items-center justify-between rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className={selectedCustomer || value === 'all' ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
          {value === 'all' ? 'All customers' : selectedCustomer ? selectedCustomer.full_name || "Unknown Name" : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            minWidth: "200px"
          }}
          className="absolute z-[9999] mt-1 max-h-[300px] overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black ring-opacity-5"
        >
          <div className="flex items-center border-b border-slate-200 dark:border-slate-700 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent dark:bg-slate-800 dark:text-slate-100 py-3 text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search customer name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="max-h-[200px] overflow-y-auto p-1">
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                Searching...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {searchTerm.length < 2 ? "Type at least 2 characters to search" : "No customers found."}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
                    value === option.value ? "bg-slate-100 dark:bg-slate-700" : ""
                  }`}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      value === option.value ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="text-slate-900 dark:text-slate-100">{option.label}</span>
                    {option.subLabel && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{option.subLabel}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
