"use client";
import React, { useState } from "react";
import ShopCard from "../../components/shop/ShopCard";

const powerUps = [
  {
    title: "Retry",
    description: "Get a second chance on a wrong answer during a study session.",
    price: 20,
    soon: false,
    icon: (
      <svg fill="currentColor" height="20" width="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <path d="M228,100a12,12,0,0,0-10.33,6l-47,81.42a12,12,0,0,0,20.66,12l47-81.42A12,12,0,0,0,228,100Zm-78.33,18,23-39.84a12,12,0,1,0-20.66-12L129,106,72.33,8.16a12,12,0,0,0-20.66,12L74.67,60H36a12,12,0,0,0,0,24H86.38l-47,81.42a12,12,0,1,0,20.66,12L116,114l56.67,98.16a12,12,0,0,0,20.66-12L167,158h41a12,12,0,0,0,0-24H157.38Z" />
      </svg>
    ),
  },
  {
    title: "Hint",
    description: "Reveal a helpful clue or memory aid for the current flashcard.",
    price: 50,
    soon: true,
    icon: (
      <svg fill="currentColor" height="20" width="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <path d="M228,100a12,12,0,0,0-10.33,6l-47,81.42a12,12,0,0,0,20.66,12l47-81.42A12,12,0,0,0,228,100Zm-78.33,18,23-39.84a12,12,0,1,0-20.66-12L129,106,72.33,8.16a12,12,0,0,0-20.66,12L74.67,60H36a12,12,0,0,0,0,24H86.38l-47,81.42a12,12,0,1,0,20.66,12L116,114l56.67,98.16a12,12,0,0,0,20.66-12L167,158h41a12,12,0,0,0,0-24H157.38Z" />
      </svg>
    ),
  },
  {
    title: "50/50",
    description: "Eliminate two incorrect options from a multiple-choice question.",
    price: 100,
    soon: false,
    icon: (
      <svg fill="currentColor" height="20" width="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <path d="M228,100a12,12,0,0,0-10.33,6l-47,81.42a12,12,0,0,0,20.66,12l47-81.42A12,12,0,0,0,228,100Zm-78.33,18,23-39.84a12,12,0,1,0-20.66-12L129,106,72.33,8.16a12,12,0,0,0-20.66,12L74.67,60H36a12,12,0,0,0,0,24H86.38l-47,81.42a12,12,0,1,0,20.66,12L116,114l56.67,98.16a12,12,0,0,0,20.66-12L167,158h41a12,12,0,0,0,0-24H157.38Z" />
      </svg>
    ),
  },
  {
    title: "Time Warp",
    description: "Instantly add 15 seconds to the clock in a Timed Drill mission.",
    price: 15,
    soon: false,
    icon: (
      <svg fill="currentColor" height="20" width="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <path d="M228,100a12,12,0,0,0-10.33,6l-47,81.42a12,12,0,0,0,20.66,12l47-81.42A12,12,0,0,0,228,100Zm-78.33,18,23-39.84a12,12,0,1,0-20.66-12L129,106,72.33,8.16a12,12,0,0,0-20.66,12L74.67,60H36a12,12,0,0,0,0,24H86.38l-47,81.42a12,12,0,1,0,20.66,12L116,114l56.67,98.16a12,12,0,0,0,20.66-12L167,158h41a12,12,0,0,0,0-24H157.38Z" />
      </svg>
    ),
  },
  {
    title: "Focus Lens",
    description: "Highlight important keywords or phrases on the flashcard.",
    price: 20,
    soon: true,
    icon: (
      <svg fill="currentColor" height="20" width="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <path d="M228,100a12,12,0,0,0-10.33,6l-47,81.42a12,12,0,0,0,20.66,12l47-81.42A12,12,0,0,0,228,100Zm-78.33,18,23-39.84a12,12,0,1,0-20.66-12L129,106,72.33,8.16a12,12,0,0,0-20.66,12L74.67,60H36a12,12,0,0,0,0,24H86.38l-47,81.42a12,12,0,1,0,20.66,12L116,114l56.67,98.16a12,12,0,0,0,20.66-12L167,158h41a12,12,0,0,0,0-24H157.38Z" />
      </svg>
    ),
  },
  {
    title: "Bloom Unlock",
    description: "Bypass the 80% mastery requirement to unlock the next Bloom level.",
    price: 200,
    soon: false,
    icon: (
      <svg fill="currentColor" height="20" width="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <path d="M228,100a12,12,0,0,0-10.33,6l-47,81.42a12,12,0,0,0,20.66,12l47-81.42A12,12,0,0,0,228,100Zm-78.33,18,23-39.84a12,12,0,1,0-20.66-12L129,106,72.33,8.16a12,12,0,0,0-20.66,12L74.67,60H36a12,12,0,0,0,0,24H86.38l-47,81.42a12,12,0,1,0,20.66,12L116,114l56.67,98.16a12,12,0,0,0,20.66-12L167,158h41a12,12,0,0,0,0-24H157.38Z" />
      </svg>
    ),
  },
];

export default function ShopPage() {
  const [preview, setPreview] = useState(true);
  return (
    <div style={{ background: '#f3f6fb' }}>
      <main className="max-w-5xl mx-auto px-6 pt-10 pb-20">
        <h1 className="text-center text-5xl font-extrabold tracking-tight text-slate-900">Commander’s Emporium</h1>
        <p className="mt-2 text-center text-lg text-slate-600">Spend your hard-earned tokens on powerful upgrades and boosts.</p>
        <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-center">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-500 mr-3">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z" />
            </svg>
          </span>
          <span className="text-blue-700 font-medium">Viewing Mock Data</span>
          <span className="ml-2 text-blue-600">This is a preview of the shop. Please <a href="#" className="underline">log in</a> to make purchases.</span>
        </div>
        <div className="mt-8 flex flex-col items-center">
          <button className="rounded-full bg-blue-100 text-blue-700 px-6 py-2 font-semibold text-base mb-2 shadow-sm">Power‑Up Inventory</button>
          <div className="flex items-center gap-2">
            <span className="text-slate-700 text-base">Preview mode</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={preview} onChange={() => setPreview(!preview)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition-all"></div>
              <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all peer-checked:translate-x-5"></div>
            </label>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {powerUps.map((item) => (
            <ShopCard key={item.title} {...item} preview={preview} />
          ))}
        </div>
      </main>
    </div>
  );
}
