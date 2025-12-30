import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

interface ComboboxOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select...", 
  disabled = false,
  className = "" 
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (option.subLabel && option.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedOption = options.find(opt => opt.value === value);

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

  // Handle click outside and scroll/resize
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
      // Removed scroll and resize listeners to prevent closing on mobile interactions (keyboard open, list scroll)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow render
      setTimeout(() => {
        const input = dropdownRef.current?.querySelector("input");
        if (input) input.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className={selectedOption ? "text-slate-900" : "text-slate-500"}>
          {selectedOption ? selectedOption.label : placeholder}
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
          className="absolute z-[9999] mt-1 max-h-[300px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5"
        >
          <div className="flex items-center border-b border-slate-200 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                No results found.
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
                    value === option.value ? "bg-slate-100" : ""
                  }`}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      value === option.value ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.subLabel && (
                      <span className="text-xs text-slate-500">{option.subLabel}</span>
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

