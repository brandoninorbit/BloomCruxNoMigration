"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

export default function AboutPage() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  // Track a Set of open accordion indexes to match original behavior (multiple can be open)
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set());
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);

  const faqItems = useMemo(
    () => [
      {
        q: "What is Bloom&apos;s Taxonomy and why is it my core training protocol?",
        a:
          "Bloom&apos;s Taxonomy is a framework for categorizing educational goals. We use it to structure your learning path from simple recall to complex problem-solving, ensuring a deep and robust understanding of the subject matter.",
      },
      {
        q: "How do I level up and earn tokens?",
        a:
          "You level up and earn tokens by successfully completing study missions and demonstrating mastery of concepts. The more you learn and practice, the faster you&apos;ll advance and unlock new content and features.",
      },
      {
        q: "What are the different mission types?",
        a:
          "Mission types are designed to target different aspects of learning. They include 'Timed Drills' for quick recall, 'Target Practice' for focusing on weak areas, and 'Boost' missions to accelerate your progress on specific topics.",
      },
    ],
    []
  );

  // Close popup on Escape key like the original snippet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPopupOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="bg-gray-50 text-gray-800">
      {/* Popup Modal for Bloom's Taxonomy */}
      {isPopupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsPopupOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              className="absolute right-4 top-4 text-gray-500 transition-colors hover:text-gray-800"
              onClick={() => setIsPopupOpen(false)}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h3 className="mb-4 text-2xl font-bold text-gray-900">
              Bloom&apos;s Taxonomy Levels
            </h3>
            <div className="space-y-3 text-gray-600">
              <p>
                Bloom&apos;s Taxonomy is a framework that classifies different levels of intellectual
                behavior important in learning. It provides a structure for categorizing educational
                goals and objectives, moving from simpler cognitive skills to more complex ones.
              </p>
              <p>
                Using these levels helps improve studying and memory retention by encouraging deeper,
                more meaningful engagement with the material. Instead of just memorizing facts (Remembering),
                you&apos;re pushed to explain concepts (Understanding), use information in new situations (Applying),
                draw connections (Analyzing), justify a stance (Evaluating), and create original work (Creating).
                This structured approach builds a stronger, more lasting neural network of knowledge.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Wavy background hero */}
      <section className="wavy-bg-container">
        <div className="wavy-bg relative overflow-hidden bg-gradient-to-br from-[#2481f9] to-[#66aaff] text-white">
          {/* moving wave overlay */}
          <div className="wave-overlay" />
          <div className="relative z-10 py-20 md:py-32">
            <div className="container mx-auto px-6 text-center">
              <h1 className="text-5xl font-bold leading-tight md:text-7xl">
                Master Any Subject, Faster.
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-lg text-blue-200 md:text-xl">
                BloomCrux is an intelligent learning platform that adapts to you using cognitive science principles and gamified logic. We use cognitive science principles to create study tools that help you learn more effectively and retain information longer, with gamified logic to make learning more interactive and fun.
              </p>
              <div className="mt-12">
                <a
                  href="#"
                  className="inline-block transform rounded-full bg-white px-10 py-4 text-lg font-bold text-[#2481f9] transition-transform hover:scale-105 hover:bg-blue-50"
                >
                  Get started for free
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="blur-transition" />

        {/* component-scoped styles to match provided HTML */}
        <style jsx>{`
          .wavy-bg-container { position: relative; }
          .wave-overlay {
            position: absolute;
            inset: 0;
            left: -50%;
            width: 200%;
            height: 100%;
            background-repeat: no-repeat;
            background-position: bottom;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23ffffff' fill-opacity='0.1' d='M0,192L48,170.7C96,149,192,107,288,112C384,117,480,171,576,192C672,213,768,203,864,181.3C960,160,1056,128,1152,112C1248,96,1344,96,1392,96L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E");
            animation: wave 10s linear infinite;
          }
          @keyframes wave {
            0% { transform: translateX(0); }
            50% { transform: translateX(-25%); }
            100% { transform: translateX(0); }
          }
          .blur-transition {
            position: absolute;
            bottom: -1px;
            left: 0;
            width: 100%;
            height: 100px;
            background: linear-gradient(to top, white, rgba(255, 255, 255, 0));
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
          }
        `}</style>
      </section>

      <main>
        {/* Why it works */}
        <section className="bg-white py-20 md:py-32" id="works">
          <div className="container relative mx-auto px-6">
            <div className="mb-16 text-center">
              <h2 className="text-4xl font-bold text-gray-900 md:text-5xl">Why BloomCrux Works</h2>
            </div>

            {/* Row 1 */}
            <div className="relative grid items-center gap-16 md:grid-cols-2">
              <svg
                className="absolute left-1/2 top-1/2 hidden h-[150px] w-[550px] -translate-x-1/2 -translate-y-1/2 text-[#2481f9] -z-10 md:block"
                fill="none"
                viewBox="0 0 550 150"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.5 144.5C65 49 146.5 -20 231.5 19.5C316.5 59 369 133.5 432.5 106.5C496 79.5 528.5 21 544.5 5.5"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="10 10"
                />
              </svg>
              <div className="order-2 relative z-10 md:order-1">
                <h3 className="mb-4 text-3xl font-bold text-[#2481f9]">Import With Ease</h3>
                <p className="text-lg leading-relaxed text-gray-600">
                  With CSV formatting, you can import many cards in a set at once, our system chomps through csv&apos;s like there&apos;s no tomorrow with ready to study flashcards with{' '}
                  <button
                    type="button"
                    onClick={() => setIsPopupOpen(true)}
                    className="font-semibold text-[#2481f9] hover:underline"
                  >
                    Bloom&apos;s Taxonomy levels
                  </button>
                  .
                </p>
              </div>
              <div className="order-1 relative z-10 md:order-2">
                {/* TODO: Replace with optimized <Image /> when feature is ready */}
                <Image
                  alt="Stylized image of flashcards on a board, representing AI-powered content creation."
                  className="rounded-3xl shadow-2xl"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZXYDhE1Pts8G1eI8k1YO5QvuHOTKE-X7mqv-4sfvxDWmQPKXDOU88zCniHQK6LMOqLdlZ6nU5bW-qxMCs9cwiyp4o8X1WlgsrzBQTkTV_ekVRr1daJIq3QlV_OXZO3ElQKS1E7Bpi3Pk7GmN2Cxm76PxwDawBgTa0b_hnKoGJbtwD7hX3-nlziidfWS29i60d1X5Kd1ZbWx7m4oSFV_wVAonkFzF79r0deOFf4esk4C0STk8nk2EeIcKiJJ1lrzgg5hn3PWKCA911"
                  width={600}
                  height={400}
                  unoptimized
                  priority
                />
              </div>
            </div>

            {/* Row 2 (reversed) */}
            <div className="relative mt-24 grid items-center gap-16 md:grid-cols-2">
              <svg
                className="absolute left-1/2 top-1/2 hidden h-[150px] w-[550px] -translate-x-1/2 -translate-y-1/2 scale-x-[-1] text-[#2481f9] -z-10 md:block"
                fill="none"
                viewBox="0 0 550 150"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.5 144.5C65 49 146.5 -20 231.5 19.5C316.5 59 369 133.5 432.5 106.5C496 79.5 528.5 21 544.5 5.5"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="10 10"
                />
              </svg>
              <div className="relative z-10 md:order-1">
                {/* TODO: Replace with optimized <Image /> when feature is ready */}
                <Image
                  alt="A chalk drawing on a blackboard that reads 'Adaptive Study Missions Sale', illustrating personalized learning paths."
                  className="rounded-3xl shadow-2xl"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCI0qCiaXIlBv3y_93G3eHUE8wygaRz4pmXmtrvErqrd7S51QWxP_GhYQDAu77IapIL_hswJnusLKeP4aGBWjO8TEVGHKRVbW2WaEY7ieX1QwRoOTW0JGmeWHT_Pjq5oIW6zZk_Wck_Ur2HvZna_chEDhAFOK37F2hxtEqzGjHmHSsUGvD6srE8XC0fUKC8QSv8xogpurokAJRlTpjwp_Wc9gDQr004r0DCyynpCA_Z-A4_fSYqi-B1E-nZArhxuGEu1PGmjDisS9pU"
                  width={600}
                  height={400}
                  unoptimized
                  priority
                />
              </div>
              <div className="relative z-10 md:order-2">
                <h3 className="mb-4 text-3xl font-bold text-[#2481f9]">Adaptive Study Missions</h3>
                <p className="text-lg leading-relaxed text-gray-600">
                  Engage in various mission types like Boost, Timed Drills, and Target Practice that adapt to your performance and keep you motivated, ensuring you&apos;re always learning efficiently.
                </p>
              </div>
            </div>

            {/* Row 3 */}
            <div className="relative mt-24 grid items-center gap-16 md:grid-cols-2">
              <svg
                className="absolute left-1/2 top-1/2 hidden h-[150px] w-[550px] -translate-x-1/2 -translate-y-1/2 text-[#2481f9] -z-10 md:block"
                fill="none"
                viewBox="0 0 550 150"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.5 144.5C65 49 146.5 -20 231.5 19.5C316.5 59 369 133.5 432.5 106.5C496 79.5 528.5 21 544.5 5.5"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="10 10"
                />
              </svg>
              <div className="order-2 relative z-10 md:order-1">
                <h3 className="mb-4 text-3xl font-bold text-[#2481f9]">Actionable Progress</h3>
                <p className="text-lg leading-relaxed text-gray-600">
                  Track your mastery across different levels with our{' '}
                  <a href="#" className="font-semibold text-[#2481f9] hover:underline">
                    Taxonomy-based dashboard
                  </a>
                  . Know exactly where to focus your efforts and watch your knowledge grow.
                </p>
              </div>
              <div className="order-1 relative z-10 md:order-2">
                {/* TODO: Replace with optimized <Image /> when feature is ready */}
                <Image
                  alt="A whiteboard with a bar chart showing upward progress, symbolizing actionable progress tracking."
                  className="rounded-3xl shadow-2xl"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB9nihWnaZGkfGIY2JgXhWGmMXENON_Jdw3as8d_KJrLJPGf4XkQ0UrCfYHn32sJr1nQ9mHsF24beGfCXvKMVB3VXWslU6hac2gbCnAA-C8AWCYYaHZTGZHMe-GzFaMlrlIxjyuUXLZ7yl_wilj8xC45RsXvEFsNI7ZxTSXcIEO6qRVCItsRFBqOrXPYThv3pKs4WvcIrTVOijS0HjClkmWklN25lp2oF79c83LSlw60WjOo8EBEQ21nXO0BHm9xmQDxHLBG7-2pxMv"
                  width={600}
                  height={400}
                  unoptimized
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-gray-50 py-20 md:py-32" id="faq">
          <div className="container mx-auto max-w-4xl px-6">
            <div className="mb-16 text-center">
              <h2 className="text-4xl font-bold text-gray-900 md:text-5xl">
                Agent Briefing: Field Intelligence
              </h2>
            </div>

            <div className="space-y-6">
              {faqItems.map((item, idx) => {
                const isOpen = openFaqs.has(idx);
                return (
                  <div
                    key={idx}
                    className={`accordion-item rounded-2xl bg-white p-6 shadow-lg transition-all duration-300 ${isOpen ? "open bg-sky-50/70 shadow-lg" : "border border-slate-200"}`}
                  >
                    <button
                      className="flex w-full items-center justify-between text-left text-xl font-semibold text-gray-800 focus:outline-none"
                      onClick={() =>
                        setOpenFaqs((prev) => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        })
                      }
                      aria-expanded={isOpen}
                    >
                      <span>{item.q}</span>
                      <span
                        className={`accordion-icon transform transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`}
                        aria-hidden
                      >
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                        </svg>
                      </span>
                    </button>
                    <div
                      ref={(el) => {
                        contentRefs.current[idx] = el;
                      }}
                      className="accordion-content overflow-hidden transition-[max-height] duration-300 ease-out"
                      style={{
                        maxHeight: isOpen
                          ? `${contentRefs.current[idx]?.scrollHeight ?? 0}px`
                          : "0",
                      }}
                    >
                      <p className="mt-4 text-gray-600">{item.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </main>
  );
}