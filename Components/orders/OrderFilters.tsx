import React from "react";
import { Input } from "@/Components/ui/input";
import { Search, Filter } from "lucide-react";
import { Button } from "@/Components/ui/button";

type OrderFiltersProps = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
};

const statusOptions = [
  { value: "all", label: "All Orders" },
  { value: "eligible", label: "Rebate Ready" },
  { value: "pending", label: "Rebate Pending" },
];

export default function OrderFilters({
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Search by order number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
          <Filter className="w-4 h-4 text-slate-500" />
          Status:
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={filterStatus === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(option.value)}
              className={filterStatus === option.value ? "" : "border-slate-300 text-slate-700"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
