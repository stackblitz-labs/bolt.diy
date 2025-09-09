import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface ModelInputProps {
  provider: string;
  value: string;
  onChange: (value: string) => void;
  suggestedModels?: string[];
  validateModel?: (model: string) => boolean;
  placeholder?: string;
  label?: string;
  helpText?: string;
}

export function ModelInput({
  provider,
  value,
  onChange,
  suggestedModels = [],
  validateModel,
  placeholder = 'Enter model name',
  label = 'Custom Model',
  helpText,
}: ModelInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (inputValue && suggestedModels.length > 0) {
      const filtered = suggestedModels.filter((model) => model.toLowerCase().includes(inputValue.toLowerCase()));
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions(suggestedModels);
    }
  }, [inputValue, suggestedModels]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setShowSuggestions(true);

      if (newValue && validateModel) {
        setIsValid(validateModel(newValue));
      } else {
        setIsValid(null);
      }
    },
    [validateModel],
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => setShowSuggestions(false), 200);

    if (inputValue !== value) {
      onChange(inputValue);
    }
  }, [inputValue, value, onChange]);

  const handleSuggestionClick = useCallback(
    (model: string) => {
      setInputValue(model);
      onChange(model);
      setShowSuggestions(false);

      if (validateModel) {
        setIsValid(validateModel(model));
      }
    },
    [onChange, validateModel],
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={`${provider}-model-input`}>{label}</Label>
      <div className="relative">
        <div className="relative">
          <Input
            id={`${provider}-model-input`}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className={`pr-10 ${isValid === false ? 'border-red-500' : isValid === true ? 'border-green-500' : ''}`}
          />
          {isValid !== null && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isValid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          )}
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md bg-popover border border-border shadow-lg">
            <ul className="max-h-60 overflow-auto rounded-md py-1">
              {filteredSuggestions.map((model) => (
                <li
                  key={model}
                  className="cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSuggestionClick(model)}
                >
                  <div className="font-medium">{model}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {helpText && <p className="text-sm text-muted-foreground">{helpText}</p>}

      {isValid === false && inputValue && (
        <div className="mt-2 rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>This model name may not be valid for {provider}. Please check the model name.</span>
          </div>
        </div>
      )}
    </div>
  );
}
