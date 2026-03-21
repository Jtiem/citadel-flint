/* React is implicitly available via the JSX transform */

export interface SwitchToggleProps {
    label?: string;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    id?: string;
}

export function SwitchToggle({
    label,
    checked = false,
    onChange,
    disabled = false,
    className = "",
    id,
}: SwitchToggleProps) {
    const fieldId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
        <label
            htmlFor={fieldId}
            className={`inline-flex items-center gap-3 select-none ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
        >
            <button
                id={fieldId}
                role="switch"
                type="button"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange?.(!checked)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 ${
                    checked ? "bg-blue-600" : "bg-slate-300"
                }`}
            >
                <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                        checked ? "translate-x-4" : "translate-x-0.5"
                    }`}
                />
            </button>
            {label && (
                <span className="text-sm text-slate-700">{label}</span>
            )}
        </label>
    );
}
