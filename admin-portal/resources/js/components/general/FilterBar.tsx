import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface Filter {
  name: string;
  label: string;
  type: 'select' | 'date' | 'text';
  options?: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSearch?: () => void;
  perPage: number;
  onPerPageChange: (value: number) => void;
  perPageOptions?: number[];
  searchPlaceholder?: string;
  filters?: Filter[];
}

export default function FilterBar({
  search,
  onSearchChange,
  onSearch,
  perPage,
  onPerPageChange,
  perPageOptions = [5, 10, 20, 50],
  searchPlaceholder = "Search...",
  filters = [],
}: FilterBarProps) {
  return (
    <div className="space-y-4">
      {/* Search and Action Row */}
      <div className="flex items-center gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSearchChange(e.currentTarget.value);
              onSearch?.();
            }
          }}
          maxLength={50}
          className="max-w-sm"
        />
        {onSearch && <Button onClick={onSearch}>Search</Button>}
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="border rounded p-2 ml-auto text-sm"
        >
          {perPageOptions.map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      </div>

      {/* Additional Filters */}
      {filters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {filters.map((filter) => (
            <div key={filter.name} className="space-y-2">
              <Label htmlFor={filter.name} className="text-sm font-medium">
                {filter.label}
              </Label>
              {filter.type === 'select' && filter.options ? (
                <select
                  id={filter.name}
                  value={filter.value}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                >
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : filter.type === 'date' ? (
                <Input
                  id={filter.name}
                  type="date"
                  value={filter.value}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="w-full"
                />
              ) : (
                <Input
                  id={filter.name}
                  type="text"
                  value={filter.value}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="w-full"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}