import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

interface SelectContentProps {
  children: React.ReactNode;
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

// Global registry: maps select ID to close function
const selectRegistry = new Map<symbol, () => void>();

export function Select({ value, onValueChange, children, disabled }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const selectIdRef = useRef<symbol>(Symbol(`select-${Date.now()}-${Math.random()}`));
  const setIsOpenRef = useRef(setIsOpen);
  
  // Keep setIsOpen ref updated
  useEffect(() => {
    setIsOpenRef.current = setIsOpen;
  }, []);

  // Extract SelectContent to find selected item label
  useEffect(() => {
    React.Children.forEach(children, (child: any) => {
      if (React.isValidElement(child) && child.type === SelectContent) {
        const contentProps = child.props as SelectContentProps;
        React.Children.forEach(contentProps.children, (item: any) => {
          if (React.isValidElement(item)) {
            const itemProps = item.props as SelectItemProps;
            if (itemProps.value === value) {
              setSelectedLabel(itemProps.children as string || "");
            }
          }
        });
      }
    });
  }, [value, children]);

  // Register/unregister this select
  useEffect(() => {
    const closeFn = () => setIsOpenRef.current(false);
    selectRegistry.set(selectIdRef.current, closeFn);
    
    return () => {
      selectRegistry.delete(selectIdRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (itemValue: string, itemLabel: string) => {
    onValueChange(itemValue);
    setSelectedLabel(itemLabel);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (disabled) return;
    
    const willBeOpen = !isOpen;
    
    if (willBeOpen) {
      // Close all other selects first
      selectRegistry.forEach((closeFn, id) => {
        if (id !== selectIdRef.current) {
          closeFn();
        }
      });
    }
    
    setIsOpen(willBeOpen);
  };

  return (
    <div className="relative w-full" ref={selectRef}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === SelectTrigger) {
            return React.cloneElement(child, {
              ref: triggerRef,
              onClick: handleToggle,
              disabled,
              "aria-expanded": isOpen,
              children: value && selectedLabel ? (
                <span className="text-slate-900">{selectedLabel}</span>
              ) : (
                child.props.children
              ),
            });
          }
          if (child.type === SelectContent && isOpen) {
            return React.cloneElement(child, {
              ref: contentRef,
              onItemClick: handleItemClick,
              triggerWidth: triggerRef.current?.offsetWidth || '100%',
            });
          }
        }
        return child;
      })}
    </div>
  );
}

export function SelectTrigger({ className = "", children, ...props }: SelectTriggerProps) {
  const isOpen = props["aria-expanded"] || false;
  return (
    <button
      className={`flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      <span className="flex-1 text-left">{children}</span>
      <ChevronDown 
        className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
      />
    </button>
  );
}

export function SelectValue({ placeholder, value, children }: { placeholder?: string; value?: string; children?: React.ReactNode }) {
  if (value && children) {
    // Find the selected item's text
    const selectedText = React.Children.toArray(children).find((child: any) => {
      if (React.isValidElement(child)) {
        const itemProps = child.props as SelectItemProps;
        return itemProps.value === value;
      }
      return false;
    });
    if (selectedText && React.isValidElement(selectedText)) {
      const itemProps = selectedText.props as SelectItemProps;
      return <span>{itemProps.children}</span>;
    }
  }
  return <span className="text-slate-500">{placeholder || "Select..."}</span>;
}

export function SelectContent({ children, onItemClick, triggerWidth }: SelectContentProps & { onItemClick?: (value: string, label: string) => void; triggerWidth?: number | string }) {
  return (
    <div 
      className="absolute top-full left-0 z-50 mt-1 rounded-md border border-slate-200 bg-white shadow-lg"
      style={{ width: triggerWidth || '100%', minWidth: '100%' }}
    >
      <div className="max-h-60 overflow-y-auto overflow-x-hidden py-1">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === SelectItem) {
            const itemValue = (child.props as SelectItemProps).value;
            const itemChildren = (child.props as SelectItemProps).children;
            return React.cloneElement(child, {
              key: itemValue,
              onClick: () => onItemClick?.(itemValue, (itemChildren as string) || ""),
            });
          }
          return child;
        })}
      </div>
    </div>
  );
}

export function SelectItem({ className = "", children, value, ...props }: SelectItemProps) {
  return (
    <div
      className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-100 transition-colors whitespace-nowrap block w-full ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
