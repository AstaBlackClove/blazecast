import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";

type CalculatorProps = {
  query: string;
  onResultAvailable: (result: string | null) => void;
};

export function Calculator({ query, onResultAvailable }: CalculatorProps) {
  const [result, setResult] = useState<string | null>(null);
  const [fromValue, setFromValue] = useState<string>("0");
  const [toValue, setToValue] = useState<string>("0");
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    try {
      // Extract the expression from the query
      const expression = query.trim();

      // Skip if expression is empty
      if (!expression) return;

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
      <div className="text-sm text-gray-400 px-2 mb-1">Calculator</div>

      <div className="flex flex-row bg-slate-700/40 rounded-lg overflow-hidden">
        <div className="flex-1 flex items-center justify-between p-4 border-r border-gray-700">
          <div className="flex flex-col">
            <span className="text-2xl font-semibold text-white">
              {fromValue}
            </span>
            <span className="text-xs text-gray-400 mt-1">Calculation</span>
          </div>

          <ChevronRight className="text-gray-500" size={20} />

          <div className="flex flex-col items-end">
            <span className="text-2xl font-semibold text-white">{toValue}</span>
            <span className="text-xs text-gray-400 mt-1">Result</span>
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
