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
  onCta,
}: AnnouncementBannerProps) {
  return (
    <section
      data-flint-id="banner-root"
      className="bg-[#0066FF] rounded-[12px] p-[48px] flex flex-col gap-[16px] max-w-[640px]"
    >
      <span
        data-flint-id="banner-label"
        className="text-[#FFFFFF] text-[12px] font-semibold tracking-[0.08em] uppercase opacity-75"
      >
        {label}
      </span>

      <h2
        data-flint-id="banner-headline"
        className="text-[#FFFFFF] text-[24px] font-bold leading-[1.2] m-0"
      >
        {headline}
      </h2>

      <p
        data-flint-id="banner-body"
        className="text-[#FFFFFF] text-[16px] leading-[1.6] opacity-85 m-0"
      >
        {body}
      </p>

      <button
        data-flint-id="banner-cta"
        onClick={onCta}
        className="self-start mt-[8px] px-[24px] py-[12px] bg-transparent text-[#FFFFFF] border-2 border-[#FFFFFF] rounded-[8px] text-[14px] font-semibold cursor-pointer"
      >
        {ctaText}
      </button>
    </section>
  );
}
