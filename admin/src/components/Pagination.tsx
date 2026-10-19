type PaginationProps = {
  page: number;
  pages: number;
  total: number;
  // "record" / "records"
  noun: [string, string];
  disabled?: boolean;
  onPage: (page: number) => void;
};

export function Pagination({ page, pages, total, noun, disabled = false, onPage }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-secondary btn-small"
        disabled={page <= 1 || disabled}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {pages} · {total} {total === 1 ? noun[0] : noun[1]}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-small"
        disabled={page >= pages || disabled}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
