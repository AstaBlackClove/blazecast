import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";

type CalculatorProps = {
  query: string;
  onResultAvailable: (result: string | null) => void;
};

// Basic unit types
type UnitType = "length" | "css" | "temperature" | "weight" | "area" | "volume";

// Interface for unit definitions
interface UnitDefinition {
  type: UnitType;
  names: string[]; // All possible names for this unit (e.g., ["mm", "millimeter", "millimeters"])
  toBase: (value: number) => number; // Convert from this unit to base unit
  fromBase: (value: number) => number; // Convert from base unit to this unit
  precision: number; // Default precision for display
  symbol: string; // Symbol to display in the result
}

export function Calculator({ query, onResultAvailable }: CalculatorProps) {
  const [result, setResult] = useState<string | null>(null);
  const [fromValue, setFromValue] = useState<string>("0");
  const [toValue, setToValue] = useState<string>("0");
  const [isUnitConversion, setIsUnitConversion] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Unit definitions - each with conversion to/from a base unit
  const unitDefinitions: Record<string, UnitDefinition> = {
    // Length units (base: mm)
    mm: {
      type: "length",
      names: ["mm", "millimeter", "millimeters"],
      toBase: (value) => value, // mm is the base unit
      fromBase: (value) => value,
      precision: 2,
      symbol: "mm",
    },
    cm: {
      type: "length",
      names: ["cm", "centimeter", "centimeters"],
      toBase: (value) => value * 10, // 1cm = 10mm
      fromBase: (value) => value / 10,
      precision: 2,
      symbol: "cm",
    },
    inch: {
      type: "length",
      names: ["inch", "inches", "in"],
      toBase: (value) => value * 25.4, // 1inch = 25.4mm
      fromBase: (value) => value / 25.4,
      precision: 2,
      symbol: "in",
    },
    m: {
      type: "length",
      names: ["m", "meter", "meters"],
      toBase: (value) => value * 1000, // 1m = 1000mm
      fromBase: (value) => value / 1000,
      precision: 2,
      symbol: "m",
    },
    ft: {
      type: "length",
      names: ["ft", "foot", "feet"],
      toBase: (value) => value * 304.8, // 1ft = 304.8mm
      fromBase: (value) => value / 304.8,
      precision: 2,
      symbol: "ft",
    },

    // CSS units (base: px)
    px: {
      type: "css",
      names: ["px", "pixel", "pixels"],
      toBase: (value) => value, // px is the base unit
      fromBase: (value) => value,
      precision: 0,
      symbol: "px",
    },
    rem: {
      type: "css",
      names: ["rem"],
      toBase: (value) => value * 16, // Assuming 1rem = 16px
      fromBase: (value) => value / 16,
      precision: 4,
      symbol: "rem",
    },
    em: {
      type: "css",
      names: ["em"],
      toBase: (value) => value * 16, // Assuming 1em = 16px (same as rem)
      fromBase: (value) => value / 16,
      precision: 4,
      symbol: "em",
    },
    pt: {
      type: "css",
      names: ["pt", "point", "points"],
      toBase: (value) => value * 1.333333, // 1pt ≈ 1.333333px
      fromBase: (value) => value / 1.333333,
      precision: 2,
      symbol: "pt",
    },

    // Temperature units (no simple base unit conversion)
    celsius: {
      type: "temperature",
      names: ["c", "celsius", "°c"],
      toBase: (value) => value, // Celsius is base unit
      fromBase: (value) => value,
      precision: 1,
      symbol: "°C",
    },
    fahrenheit: {
      type: "temperature",
      names: ["f", "fahrenheit", "°f"],
      toBase: (value) => ((value - 32) * 5) / 9, // Convert to Celsius
      fromBase: (value) => (value * 9) / 5 + 32, // Convert from Celsius
      precision: 1,
      symbol: "°F",
    },
    kelvin: {
      type: "temperature",
      names: ["k", "kelvin"],
      toBase: (value) => value - 273.15, // Convert to Celsius
      fromBase: (value) => value + 273.15, // Convert from Celsius
      precision: 1,
      symbol: "K",
    },

    // Weight units (base: g)
    mg: {
      type: "weight",
      names: ["mg", "milligram", "milligrams"],
      toBase: (value) => value / 1000,
      fromBase: (value) => value * 1000,
      precision: 2,
      symbol: "mg",
    },
    g: {
      type: "weight",
      names: ["g", "gram", "grams"],
      toBase: (value) => value,
      fromBase: (value) => value,
      precision: 2,
      symbol: "g",
    },
    kg: {
      type: "weight",
      names: ["kg", "kilogram", "kilograms"],
      toBase: (value) => value * 1000,
      fromBase: (value) => value / 1000,
      precision: 2,
      symbol: "kg",
    },
    oz: {
      type: "weight",
      names: ["oz", "ounce", "ounces"],
      toBase: (value) => value * 28.3495,
      fromBase: (value) => value / 28.3495,
      precision: 2,
      symbol: "oz",
    },
    lb: {
      type: "weight",
      names: ["lb", "pound", "pounds"],
      toBase: (value) => value * 453.592,
      fromBase: (value) => value / 453.592,
      precision: 2,
      symbol: "lb",
    },
  };

  // Create a mapping of unit names to unit keys
  const getUnitKeyFromName = (name: string): string | null => {
    name = name.toLowerCase();
    for (const [key, unit] of Object.entries(unitDefinitions)) {
      if (unit.names.includes(name)) {
        return key;
      }
    }
    return null;
  };

  // Function to detect and parse unit conversion requests
  const parseUnitConversion = (
    input: string
  ): { value: number; fromUnit: string; toUnit: string } | null => {
    // Try to match the pattern: number + unit + "to" + unit
    const match = input.match(
      /^(\d+(?:\.\d+)?)\s*([a-zA-Z°]+)\s*to\s*([a-zA-Z°]+)$/i
    );
    if (!match) return null;

    const value = parseFloat(match[1]);
    const fromUnitName = match[2].toLowerCase();
    const toUnitName = match[3].toLowerCase();

    const fromUnitKey = getUnitKeyFromName(fromUnitName);
    const toUnitKey = getUnitKeyFromName(toUnitName);

    if (!fromUnitKey || !toUnitKey) return null;

    return {
      value,
      fromUnit: fromUnitKey,
      toUnit: toUnitKey,
    };
  };

  // Function to perform the unit conversion
  const convertUnits = (
    value: number,
    fromUnit: string,
    toUnit: string
  ): {
    value: number;
    fromSymbol: string;
    toSymbol: string;
    precision: number;
  } | null => {
    const fromUnitDef = unitDefinitions[fromUnit];
    const toUnitDef = unitDefinitions[toUnit];

    if (!fromUnitDef || !toUnitDef) return null;

    // Units must be of the same type (except for temperature which has special rules)
    if (fromUnitDef.type !== toUnitDef.type) return null;

    // Convert from the input unit to base, then from base to target unit
    const valueInBase = fromUnitDef.toBase(value);
    const convertedValue = toUnitDef.fromBase(valueInBase);

    return {
      value: convertedValue,
      fromSymbol: fromUnitDef.symbol,
      toSymbol: toUnitDef.symbol,
      precision: toUnitDef.precision,
    };
  };

  useEffect(() => {
    try {
      // Extract the expression from the query
      const expression = query.trim();

      // Skip if expression is empty
      if (!expression) return;

      // First, check if this is a unit conversion request
      const conversionRequest = parseUnitConversion(expression);
      if (conversionRequest) {
        const { value, fromUnit, toUnit } = conversionRequest;
        const conversion = convertUnits(value, fromUnit, toUnit);

        if (conversion) {
          const {
            value: convertedValue,
            fromSymbol,
            toSymbol,
            precision,
          } = conversion;

          // Format the result with the appropriate precision
          const formattedResult = convertedValue.toFixed(precision);

          // Set display values
          setFromValue(`${value} ${fromSymbol}`);
          setToValue(`${formattedResult} ${toSymbol}`);
          setResult(`${formattedResult} ${toSymbol}`);
          setIsUnitConversion(true);

          // Notify parent component about the result
          onResultAvailable(`${formattedResult} ${toSymbol}`);

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
