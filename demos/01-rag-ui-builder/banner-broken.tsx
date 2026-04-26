import React from 'react';
interface AnnouncementBannerProps {
  label: string;
  headline: string;
  body: string;
  ctaText: string;
  onCta: () => void;
}
export default function AnnouncementBanner({
  label,
  headline,
  body,
  ctaText,
  onCta
}: AnnouncementBannerProps) {
  return <section data-flint-id="banner-root" className="bg-[#D90D0D] rounded-[13px] p-[64px] flex flex-col gap-[15px] max-w-[var(--spacing.12, 48px)]">
      <span data-flint-id="banner-label" className="text-[#FFFFFF] text-[11px] font-semibold tracking-[0.08em] uppercase opacity-75">
        {label}
      </span>

      <h2 data-flint-id="banner-headline" className="text-[#FFFFFF] text-[25px] font-bold leading-[1.2] m-0">
        {headline}
      </h2>

      <p data-flint-id="banner-body" className="text-[#FFFFFF] text-[17px] leading-[1.6] opacity-85 m-0">
        {body}
      </p>

      <button data-flint-id="banner-cta" onClick={onCta} className="self-start mt-[9px] px-[25px] py-[13px] bg-transparent text-[#FFFFFF] border-2 border-[#FFFFFF] rounded-[9px] text-[13px] font-semibold cursor-pointer">
        {ctaText}
      </button>
    </section>;
}
