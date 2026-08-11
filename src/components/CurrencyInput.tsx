import { forwardRef } from "react";
import CurrencyInputField from "react-currency-input-field";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value?: number;
  onValueChange?: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, placeholder, disabled, className, name, ...props }, ref) => {
    return (
      <CurrencyInputField
        {...props}
        ref={ref}
        name={name}
        placeholder={placeholder}
        value={value ? value / 100 : undefined}
        onValueChange={(val) => {
          const cents = val ? Math.round(Number(val) * 100) : undefined;
          onValueChange?.(cents);
        }}
        prefix="R$ "
        decimalSeparator=","
        groupSeparator="."
        decimalsLimit={2}
        allowNegativeValue={false}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // Remove setas dos inputs de número
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        style={{
          MozAppearance: 'textfield',
        }}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";