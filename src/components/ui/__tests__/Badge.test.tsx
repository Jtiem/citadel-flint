import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../Badge";

describe("Badge", () => {
    it("renders children", () => {
        render(<Badge>Hello</Badge>);
        expect(screen.getByText("Hello")).toBeTruthy();
    });

    it("renders default variant classes when variant is default", () => {
        const { container } = render(<Badge variant="default">Label</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("bg-zinc-800");
        expect(badge.className).toContain("text-zinc-400");
        expect(badge.className).toContain("border-zinc-700");
    });

    it("renders neutral variant classes", () => {
        const { container } = render(<Badge variant="neutral">Label</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("bg-zinc-700");
        expect(badge.className).toContain("text-zinc-300");
        expect(badge.className).toContain("border-zinc-600");
    });

    it("renders success variant classes", () => {
        const { container } = render(<Badge variant="success">OK</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("text-emerald-400");
        expect(badge.className).toContain("border-emerald-700/50");
    });

    it("renders warning variant classes", () => {
        const { container } = render(<Badge variant="warning">Warn</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("text-amber-400");
        expect(badge.className).toContain("border-amber-700/50");
    });

    it("renders error variant classes", () => {
        const { container } = render(<Badge variant="error">Fail</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("text-red-400");
        expect(badge.className).toContain("border-red-700/50");
    });

    it("renders info variant classes", () => {
        const { container } = render(<Badge variant="info">Info</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("text-blue-400");
        expect(badge.className).toContain("border-blue-700/50");
    });

    it("applies sm size classes by default", () => {
        const { container } = render(<Badge>Label</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("text-xs");
        expect(badge.className).toContain("px-1.5");
    });

    it("applies md size classes when size is md", () => {
        const { container } = render(<Badge size="md">Label</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("text-sm");
        expect(badge.className).toContain("px-2");
    });

    it("merges custom className", () => {
        const { container } = render(<Badge className="my-custom-class">Label</Badge>);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("my-custom-class");
    });

    it("custom className does not replace variant classes", () => {
        const { container } = render(
            <Badge variant="success" className="my-custom-class">Label</Badge>
        );
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("text-emerald-400");
        expect(badge.className).toContain("my-custom-class");
    });
});
