export function Ocean() {
  return (
    <div className="ocean-world" aria-hidden="true">
      <div className="ocean-photograph" />
      <img className="moon-photograph" src="/assets/moon-detail.jpg" alt="" draggable={false} />
      <svg className="shore-lighthouse" viewBox="0 0 100 120" fill="none">
        <path d="m0 114 19-9 14 2 16-6 21 7 12-2 18 8v6H0Z" fill="#142532" />
        <path d="m39 106 4-76h15l5 76Z" fill="#c5c9ba" />
        <path d="M42 48h17l1 16H41Zm-2 33h21l1 15H39Z" fill="#9f6d5d" />
        <path d="M40 26h21v7H40Z" fill="#162c3d" />
        <path d="M43 12h15v14H43Z" fill="#eadba9" />
        <path d="m39 12 11-9 12 9Z" fill="#142d3b" />
        <circle cx="50" cy="20" r="4" fill="#fff1be" />
      </svg>
    </div>
  );
}
