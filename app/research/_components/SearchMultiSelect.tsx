"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SearchOption {
  label: string;
  value: string;
}

interface SearchMultiSelectProps {
  options: SearchOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  selectedValues: string[];
  onChange: (nextValues: string[]) => void;
  showSelectedBadges?: boolean;
}

export function SearchMultiSelect({
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  selectedValues,
  onChange,
  showSelectedBadges = true,
}: SearchMultiSelectProps) {
  const selectedSet = new Set(selectedValues);

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(
        selectedValues.filter((selectedValue) => selectedValue !== value),
      );
      return;
    }

    onChange([...selectedValues, value]);
  };

  return (
    <div className="space-y-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-full justify-between border-input font-normal"
          >
            <span className="truncate text-left">
              {selectedValues.length > 0
                ? `${selectedValues.length} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggleValue(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSet.has(option.value)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showSelectedBadges && selectedValues.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((selectedValue) => {
            const option = options.find((item) => item.value === selectedValue);
            return (
              <Badge
                key={selectedValue}
                variant="secondary"
                className="gap-1.5 py-1"
              >
                <span>{option?.label ?? selectedValue}</span>
                <button
                  type="button"
                  aria-label={`Remove ${option?.label ?? selectedValue}`}
                  className="rounded-full text-muted-foreground transition hover:text-foreground"
                  onClick={() => toggleValue(selectedValue)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
