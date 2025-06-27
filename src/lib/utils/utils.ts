import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncate long tool titles for UI display
 * Handles cases where coreConcept contains descriptions instead of just titles
 */
export function truncateToolTitle(title: string, maxLength: number = 50): string {
  if (!title) return 'Untitled Tool';
  
  // If title contains a colon, it's likely a "Title: Description" format
  // Extract just the title part
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0 && colonIndex < maxLength) {
    const titlePart = title.substring(0, colonIndex).trim();
    if (titlePart.length > 0) {
      return titlePart;
    }
  }
  
  // For normal truncation
  if (title.length <= maxLength) {
    return title;
  }
  
  // Truncate at word boundary if possible
  const truncated = title.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Extract title from long coreConcept strings that contain descriptions
 */
export function extractToolTitle(coreConcept?: string): string {
  if (!coreConcept) return 'Untitled Tool';
  
  // Look for patterns like "Title: Description"
  const colonIndex = coreConcept.indexOf(':');
  if (colonIndex > 0) {
    const titlePart = coreConcept.substring(0, colonIndex).trim();
    if (titlePart.length > 0 && titlePart.length < 100) {
      return titlePart;
    }
  }
  
  // Look for patterns like "Title - Description" or "Title | Description"
  const separators = [' - ', ' | ', ' — '];
  for (const separator of separators) {
    const sepIndex = coreConcept.indexOf(separator);
    if (sepIndex > 0 && sepIndex < 80) {
      const titlePart = coreConcept.substring(0, sepIndex).trim();
      if (titlePart.length > 0) {
        return titlePart;
      }
    }
  }
  
  // If no clear separator, truncate long strings
  return truncateToolTitle(coreConcept, 50);
}
