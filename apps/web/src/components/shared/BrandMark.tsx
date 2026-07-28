export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`mrh-brand-mark ${className}`.trim()}
      viewBox="0 0 40 40"
      role="img"
      aria-label="MRH Academy"
    >
      <path
        d="M20 2.5 35 8v10.5c0 9.1-5.8 15.4-15 19-9.2-3.6-15-9.9-15-19V8l15-5.5Z"
        fill="currentColor"
      />
      <path
        d="M11.5 13.2h4.2l4.3 6.1 4.3-6.1h4.2v14.1h-4.2v-7.8L20 25.2l-4.3-5.7v7.8h-4.2V13.2Z"
        fill="white"
      />
    </svg>
  );
}
