"use client";
import { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
    {/* Modal container with capped height and internal scroll */}
    <div className="bg-slate-100 rounded-lg shadow-lg max-w-2xl w-full relative max-h-[85vh] overflow-y-auto">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
