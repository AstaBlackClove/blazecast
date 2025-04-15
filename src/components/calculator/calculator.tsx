import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";

type CalculatorProps = {
  query: string;
  onResultAvailable: (result: string | null) => void;
};

// Define unit conversion types and formulas
interface UnitConversion {
  regex: RegExp;
  convert: (value: number) => { value: number; unit: string };
  fromUnit: string;
  toUnit: string;
}

export function Calculator({ query, onResultAvailable }: CalculatorProps) {
  const [result, setResult] = useState<string | null>(null);
  const [fromValue, setFromValue] = useState<string>("0");
  const [toValue, setToValue] = useState<string>("0");
  const [isUnitConversion, setIsUnitConversion] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Define unit conversion patterns and formulas
  const unitConversions: UnitConversion[] = [
    // Length conversions
    {
      regex: /^(\d+(?:\.\d+)?)\s*mm\s*to\s*cm$/i,
      convert: (mm) => ({ value: mm / 10, unit: "cm" }),
      fromUnit: "mm",
      toUnit: "cm",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*cm\s*to\s*mm$/i,
      convert: (cm) => ({ value: cm * 10, unit: "mm" }),
      fromUnit: "cm",
      toUnit: "mm",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*cm\s*to\s*inch$/i,
      convert: (cm) => ({ value: cm / 2.54, unit: "in" }),
      fromUnit: "cm",
      toUnit: "inch",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*inch\s*to\s*cm$/i,
      convert: (inch) => ({ value: inch * 2.54, unit: "cm" }),
      fromUnit: "inch",
      toUnit: "cm",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*mm\s*to\s*inch$/i,
      convert: (mm) => ({ value: mm / 25.4, unit: "in" }),
      fromUnit: "mm",
      toUnit: "inch",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*inch\s*to\s*mm$/i,
      convert: (inch) => ({ value: inch * 25.4, unit: "mm" }),
      fromUnit: "inch",
      toUnit: "mm",
    },
    // CSS unit conversions
    {
      regex: /^(\d+(?:\.\d+)?)\s*px\s*to\s*rem$/i,
      convert: (px) => ({ value: px / 16, unit: "rem" }),
      fromUnit: "px",
      toUnit: "rem",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*px\s*to\s*em$/i,
      convert: (px) => ({ value: px / 16, unit: "em" }),
      fromUnit: "px",
      toUnit: "em",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*rem\s*to\s*px$/i,
      convert: (rem) => ({ value: rem * 16, unit: "px" }),
      fromUnit: "rem",
      toUnit: "px",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*em\s*to\s*px$/i,
      convert: (em) => ({ value: em * 16, unit: "px" }),
      fromUnit: "em",
      toUnit: "px",
    },
    // Temperature conversions
    {
      regex: /^(\d+(?:\.\d+)?)\s*c\s*to\s*f$/i,
      convert: (celsius) => ({ value: (celsius * 9) / 5 + 32, unit: "°F" }),
      fromUnit: "°C",
      toUnit: "°F",
    },
    {
      regex: /^(\d+(?:\.\d+)?)\s*f\s*to\s*c$/i,
      convert: (fahrenheit) => ({
        value: ((fahrenheit - 32) * 5) / 9,
        unit: "°C",
      }),
      fromUnit: "°F",
      toUnit: "°C",
    },
  ];

  useEffect(() => {
    try {
      // Extract the expression from the query
      const expression = query.trim();

      // Skip if expression is empty
      if (!expression) return;

      // First, check if this is a unit conversion request
      for (const conversion of unitConversions) {
        const match = expression.match(conversion.regex);
        if (match) {
          // We found a matching unit conversion pattern
          const inputValue = parseFloat(match[1]);
          const { value: convertedValue, unit } =
            conversion.convert(inputValue);

          // Format the result based on the type of unit
          // For most length units, show 2 decimal places
          // For px to rem/em conversions, show 4 decimal places
          const precision = unit === "rem" || unit === "em" ? 4 : 2;
          const formattedResult = convertedValue.toFixed(precision);

          // Set display values
          setFromValue(`${inputValue} ${conversion.fromUnit}`);
          setToValue(`${formattedResult} ${unit}`);
          setResult(`${formattedResult} ${unit}`);
          setIsUnitConversion(true);

          // Notify parent component about the result
          onResultAvailable(`${formattedResult} ${unit}`);

          // Reset copied state
          setIsCopied(false);

          return; // Exit early since we handled this as a unit conversion
        }
      }

      // If we get here, it's not a unit conversion - try it as a math calculation
      setIsUnitConversion(false);

      // Evaluate the mathematical expression
      const evaluateExpression = (expr: string): number | null => {
        try {
          // Make it safe by removing anything that's not a number or operator
          const sanitizedExpr = expr.replace(/[^0-9+\-*/.()\s]/g, "");

          // Handle empty expression
          if (!sanitizedExpr) return null;

          // Check if the expression ends with an operator or is incomplete
          if (/[+\-*/]$/.test(sanitizedExpr)) {
            // Expression ends with an operator, consider it incomplete
            return null;
          }

          // Additional check for balanced parentheses
          const openParens = (sanitizedExpr.match(/\(/g) || []).length;
          const closeParens = (sanitizedExpr.match(/\)/g) || []).length;
          if (openParens !== closeParens) {
            return null;
          }

          // Check for valid expression format
          // This is a basic check - won't catch all invalid expressions
          if (
            !/^\d+(?:[+\-*/]\d+)*$|^\d+(?:[+\-*/]\d+)*[+\-*/]\d+$/.test(
              sanitizedExpr.replace(/\s+/g, "")
            )
          ) {
            // Try to evaluate anyway, but be prepared for errors
          }

          // Evaluate the expression
          // eslint-disable-next-line no-eval
          return eval(sanitizedExpr);
        } catch (e) {
          console.error("Calculator evaluation error:", e);
          return null;
        }
      };

      // Calculate result
      const calculatedResult = evaluateExpression(expression);

      // Only update if we got a valid result
      if (calculatedResult !== null && !isNaN(calculatedResult)) {
        // Format the result based on whether it's an integer or decimal
        const formattedResult = Number.isInteger(calculatedResult)
          ? calculatedResult.toString()
          : calculatedResult.toFixed(2);

        // Update display values
        setFromValue(expression);
        setToValue(formattedResult);
        setResult(formattedResult);

        // Notify parent component about the result
        onResultAvailable(formattedResult);

        // Reset copied state
        setIsCopied(false);
      } else {
        // If we got an invalid result, clear the calculator display
        setResult(null);
        onResultAvailable(null);
      }
    } catch (error) {
      console.error("Calculator error:", error);
      // Clear the calculator display on error
      setResult(null);
      onResultAvailable(null);
    }
  }, [query, onResultAvailable]);

  // If no result, don't show the calculator UI
  if (!result) return null;

  return (
    <div className="bg-gray-800 p-2">
      <div className="text-sm text-gray-400 px-2 mb-1">
        {isUnitConversion ? "Unit Conversion" : "Calculator"}
      </div>

      <div className="flex flex-row bg-slate-700/40 rounded-lg overflow-hidden">
        <div className="flex-1 flex items-center justify-between p-4 border-r border-gray-700">
          <div className="flex flex-col">
            <span className="text-2xl font-semibold text-white">
              {fromValue}
            </span>
            <span className="text-xs text-gray-400 mt-1">
              {isUnitConversion ? "From" : "Calculation"}
            </span>
          </div>

          <ChevronRight className="text-gray-500" size={20} />

          <div className="flex flex-col items-end">
            <span className="text-2xl font-semibold text-white">{toValue}</span>
            <span className="text-xs text-gray-400 mt-1">
              {isUnitConversion ? "To" : "Result"}
            </span>
          </div>
        </div>
      </div>

      {/* Indicator message when result is copied */}
      {isCopied && (
        <div className="mt-1 text-xs text-green-400 text-right px-2">
          Result copied to clipboard!
        </div>
      )}
    </div>
  );
}
