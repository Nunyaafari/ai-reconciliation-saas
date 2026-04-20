"use client";

type AppBrandProps = {
  compact?: boolean;
  subtitle?: string;
  className?: string;
  logoClassName?: string;
};

export default function AppBrand({
  compact = false,
  subtitle,
  className = "",
  logoClassName = "",
}: AppBrandProps) {
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <img
        src="/brand/ezlogo.svg"
        alt="EZIRECON"
        className={`${compact ? "h-8 w-auto" : "h-10 w-auto"} ${logoClassName}`.trim()}
      />
      {subtitle ? (
        <p className="mt-1 text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
