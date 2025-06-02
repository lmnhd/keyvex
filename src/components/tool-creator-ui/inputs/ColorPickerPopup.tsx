'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ColorPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (primaryColor: string, secondaryColor: string) => void;
  initialPrimary?: string;
  initialSecondary?: string;
  isDarkMode: boolean;
}

export function ColorPickerPopup({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialPrimary = '#2563eb', 
  initialSecondary = '#1e40af',
  isDarkMode 
}: ColorPickerPopupProps) {
  const [primaryColor, setPrimaryColor] = useState(initialPrimary);
  const [secondaryColor, setSecondaryColor] = useState(initialSecondary);
  const [hasSelectedColors, setHasSelectedColors] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(primaryColor, secondaryColor);
    onClose();
  };

  const handlePreview = () => {
    setHasSelectedColors(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-xl shadow-2xl border max-w-2xl w-full ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-white border-gray-300'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold ${
            isDarkMode ? 'text-gray-50' : 'text-gray-900'
          }`}>
            Choose Your Color Scheme
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded hover:bg-gray-100 ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
            }`}
            aria-label="Close color picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Color Pickers */}
        <div className="p-6">
          {!hasSelectedColors && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Color Picker */}
                <div className="space-y-3">
                  <div className="text-center">
                    <h4 className={`font-medium mb-2 ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      Primary Color
                    </h4>
                    <div 
                      className="w-16 h-16 rounded-lg border-2 border-gray-300 mx-auto mb-3 shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </div>
                  
                  {/* Full-sized color picker */}
                  <div className="relative">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full h-32 rounded-lg border cursor-pointer"
                      style={{
                        WebkitAppearance: 'none',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      aria-label="Select primary color"
                    />
                  </div>
                  
                  {/* Color value display */}
                  <div className={`text-center text-sm font-mono ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {primaryColor.toUpperCase()}
                  </div>
                </div>

                {/* Secondary Color Picker */}
                <div className="space-y-3">
                  <div className="text-center">
                    <h4 className={`font-medium mb-2 ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      Secondary Color
                    </h4>
                    <div 
                      className="w-16 h-16 rounded-lg border-2 border-gray-300 mx-auto mb-3 shadow-sm"
                      style={{ backgroundColor: secondaryColor }}
                    />
                  </div>
                  
                  {/* Full-sized color picker */}
                  <div className="relative">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full h-32 rounded-lg border cursor-pointer"
                      style={{
                        WebkitAppearance: 'none',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      aria-label="Select secondary color"
                    />
                  </div>
                  
                  {/* Color value display */}
                  <div className={`text-center text-sm font-mono ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {secondaryColor.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="p-4 rounded-lg border-2" style={{ 
                borderColor: primaryColor,
                background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`
              }}>
                <div className="text-center">
                  <h5 className={`font-medium mb-2 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    Live Preview
                  </h5>
                  <div className="flex items-center justify-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className={`text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      +
                    </span>
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: secondaryColor }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className={`flex-1 ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePreview}
                  className="flex-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  Preview Selection
                </Button>
              </div>
            </div>
          )}

          {/* Selected Colors Confirmation View */}
          {hasSelectedColors && (
            <div className="text-center space-y-6">
              <div>
                <h4 className={`text-lg font-semibold mb-4 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Your Selected Color Scheme
                </h4>
                
                {/* Large Color Preview */}
                <div className="flex items-center justify-center gap-6 mb-6">
                  <div className="text-center">
                    <div 
                      className="w-20 h-20 rounded-xl border-2 border-gray-300 mx-auto mb-2 shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Primary
                    </p>
                    <p className={`text-xs font-mono ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {primaryColor.toUpperCase()}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div 
                      className="w-20 h-20 rounded-xl border-2 border-gray-300 mx-auto mb-2 shadow-lg"
                      style={{ backgroundColor: secondaryColor }}
                    />
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Secondary
                    </p>
                    <p className={`text-xs font-mono ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {secondaryColor.toUpperCase()}
                    </p>
                  </div>
                </div>
                
                {/* Edit Colors Button */}
                <Button
                  variant="outline"
                  onClick={() => setHasSelectedColors(false)}
                  className={`${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Edit Colors
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className={`flex-1 ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  Choose
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 