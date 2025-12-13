import { router } from '@inertiajs/react';
import { Button } from '../ui/button';

interface PaginationProps {
  currentPage: number;
  lastPage: number;
  total: number;
  url: string;
}

export default function Pagination({ currentPage, lastPage, total, url }: PaginationProps) {
  const handlePageChange = (page: number) => {
    // Get current URL search parameters
    const currentSearchParams = new URLSearchParams(window.location.search);
    
    // Convert to a plain object for Inertia.js
    const params: Record<string, string> = {};
    currentSearchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    // Add/update the page parameter
    params.page = String(page);
    
    // Use Inertia.js router with parameters object (not URL string)
    router.get(url, params, { preserveState: true });
  };

  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {lastPage} — {total} total
      </div>
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === lastPage}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}