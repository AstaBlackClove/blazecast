import { useState } from "react";

export function useCalculator() {
  const [calculatorResult, setCalculatorResult] = useState<string | null>(null);
  const [showCalculatorCopied, setShowCalculatorCopied] = useState(false);

  const isMathCalculation = (query: string): boolean => {
    // Check if it matches a unit conversion pattern
    const unitConversionPattern =
      /^\d+(?:\.\d+)?\s*[a-zA-Z°]+\s*to\s*[a-zA-Z°]+$/i;
    if (unitConversionPattern.test(query.trim())) {
      return true;
    }

    // If not a unit conversion, check if it's a math calculation
    // Check if the query contains numeric values and mathematical operators
    const mathPattern = /[\d+\-*/.()\s]+/;

    // Check if query has at least one digit and one operator
    const hasDigit = /\d/.test(query);
    const hasOperator = /[+\-*/]/.test(query);

    // Make sure the query doesn't have other characters
    const hasOnlyMathChars = /^[\d+\-*/.()\s]+$/.test(query);

    return (
      mathPattern.test(query) && hasDigit && hasOperator && hasOnlyMathChars
    );
  };

  const handleCalculatorResult = (result: string | null) => {
    setCalculatorResult(result);
  };

  return {
    calculatorResult,
    showCalculatorCopied,
    setShowCalculatorCopied,
    isMathCalculation,
    handleCalculatorResult,
  };
}
