"use client";

import React, { useEffect } from "react";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "success";
  isAlert?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  isAlert = false,
}: ConfirmModalProps) {
  // Close on Escape key & lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "info":
        return <Info className="w-5 h-5 text-[#8C7A6B]" />;
      case "warning":
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    }
  };

  const getIconBg = () => {
    switch (variant) {
      case "danger":
        return "bg-red-50 border-red-200";
      case "success":
        return "bg-emerald-50 border-emerald-200";
      case "info":
        return "bg-[#FAF7F0] border-[#EBE3D5]";
      case "warning":
      default:
        return "bg-amber-50 border-amber-200";
    }
  };

  const getConfirmButtonClasses = () => {
    if (variant === "danger") {
      return "bg-red-600 hover:bg-red-700 text-white shadow-xs";
    }
    return "bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] shadow-xs";
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1E1315]/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white border border-[#EBE3D5] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[#7A6A5E] hover:text-[#1E1315] hover:bg-[#FAF7F0] transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-3 pt-1">
          <div
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${getIconBg()}`}
          >
            {getIcon()}
          </div>
          <div className="space-y-1 pr-4">
            <h3 id="modal-title" className="text-sm font-bold text-[#1E1315] leading-snug">
              {title}
            </h3>
            <p className="text-xs text-[#7A6A5E] leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F4EFE6]">
          {!isAlert && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-[#EBE3D5] text-xs font-mono font-semibold text-[#7A6A5E] hover:text-[#1E1315] hover:bg-[#FAF7F0] transition cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${getConfirmButtonClasses()}`}
          >
            {isAlert ? (confirmText === "Confirm" ? "Understood" : confirmText) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
