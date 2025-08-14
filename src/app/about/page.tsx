import Image from "next/image";
export default function AboutPage() {
  return (
    <main className="flex-1 bg-slate-50 text-slate-900">
      {/* Hero */}
      <section className="py-16 md:py-24 text-center">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
            Master Any Subject, Faster.
          </h1>
          <p className="mx-auto max-w-3xl text-slate-600 md:text-lg">
            BloomCrux is an intelligent learning platform that adapts to you using cognitive
            science principles and gamified logic. We use cognitive science principles to create
            study tools that help you learn more effectively and retain information longer, with
            gamified logic to make learning more interactive and fun.
          </p>
          <div className="mt-8">
            <button className="mx-auto flex h-12 min-w-[180px] items-center justify-center rounded-lg bg-sky-600 px-6 text-base font-bold text-white shadow-lg shadow-sky-600/30 transition hover:opacity-90">
              <span className="truncate">Get started for free</span>
            </button>
          </div>
        </div>
      </section>

      {/* Why it works (with top wave) */}
      <section className="relative bg-white pt-24 pb-16 md:pt-32 md:pb-24">
        {/* top wave */}
        <div className="absolute -top-px left-0 right-0 rotate-0">
          <svg
            className="block h-[120px] w-[calc(100%+1.3px)]"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
              fill="#ffffff"
            />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <h2 className="mb-16 text-center text-3xl font-bold md:mb-24 md:text-4xl">
            Why BloomCrux Works
          </h2>

          <div className="space-y-20">
            {/* Row 1 */}
            <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
              <div className="relative md:w-1/2">
                <div className="aspect-video w-full rotate-[-2deg] overflow-hidden rounded-xl shadow-2xl">
                  <div className="relative w-full aspect-video">
                    <Image
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDXLpTiokTvSa3ExjTteUNjmG-tRiU10xNQ3I_5YXvKK_bDBP0pKtepl-_x2xM51h3C2P-BTuKKkuZq0ifoSiM8dndWWcEb9jsCrk2vN92G_QWlwZN_gqu5Re4g0I7T1XZT4S438ZGK1nkgjQMi1blqN3HYilCgPGOrPYt1AuOcxg8gV94cNMCAmakG_m9u1-0WPOxDSk1AQXuGzZYn4Uouct_p6XOREWxJP3y8ppJRGrS3GRMb4hc1l1eUYFMLRxMry_YJyZZVLJhB"
                      alt="AI-Powered Content"
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  </div>
                </div>
                <div className="absolute left-0 top-0 aspect-video w-full translate-x-4 translate-y-4 overflow-hidden rounded-xl border-4 border-white shadow-lg" />
              </div>
              <div className="md:w-1/2 md:pl-8 text-center md:text-left">
                <h3 className="mb-3 text-2xl font-semibold">AI-Powered Content</h3>
                <p className="text-slate-600">
                  Leverage generative AI to create diverse, high‑quality flashcards—from
                  multiple choice to complex reasoning—in seconds.
                </p>
              </div>
            </div>

            {/* Row 2 (reversed) */}
            <div className="flex flex-col-reverse items-center gap-8 md:flex-row-reverse md:gap-12">
              <div className="relative md:w-1/2">
                <div className="aspect-video w-full rotate-[2deg] overflow-hidden rounded-xl shadow-2xl">
                  <div className="relative w-full aspect-video">
                    <Image
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUf4Thj99fYiVsWw1Kn1v12F1J2lb_ykEKEt2JgebdZUm2v4t6ZTovG58XN0kyzk1yZhbmVoLsEKbI0mQOI9s4qafRj7icIV5CKeTayX4JWkIlENDuVwyFuBDRCAiq7FqicVeYGOajCkl4T6tSPgffbhQcYA00vxqVVFUa7msN5tmIjeCxvxXTwfxJmAIqsOgVS3ngseKIf23Zu8uMl9Or2tffZWTPDfzu87ZR1VTvslQoEkrkTWL9L-b5lrefW74tYUFxirB98m18"
                      alt="Adaptive Study Missions"
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  </div>
                </div>
                <div className="absolute left-0 top-0 aspect-video w-full -translate-x-4 translate-y-4 overflow-hidden rounded-xl border-4 border-white shadow-lg" />
              </div>
              <div className="md:w-1/2 md:pr-8 text-center md:text-left">
                <h3 className="mb-3 text-2xl font-semibold">Adaptive Study Missions</h3>
                <p className="text-slate-600">
                  Engage in various study modes like Quest, Timed Drills, and Target Practice
                  that adapt to your performance and keep you motivated.
                </p>
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
              <div className="relative md:w-1/2">
                <div className="aspect-video w-full rotate-[-2deg] overflow-hidden rounded-xl shadow-2xl">
                  <div className="relative w-full aspect-video">
                    <Image
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuClnUWROfoWsSf5eROcjNM8cOd0Jp3kH-S-a7fHbdUxjYvcEoFUhysJDmZZKWlwqWD7y1AwwfPE2TjtkJnCcAdlb-Wj0_XAZAYMdxVoxrrK1fpAJPen8SMWYLUURPlYhLubN5g1iLdqWoi2TdOPAX22MYB_pnCm623mmvjYjN0zbieH1hlOh5fsLNEIHB2TLJITu4yYMCHYUdwWFOgMHMvdDXgrODBMlejUqhkcJ0Q9hqx8y5er8qV4TqDEepXQEw-owxEvWqWBqzAu"
                      alt="Actionable Progress"
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  </div>
                </div>
                <div className="absolute left-0 top-0 aspect-video w-full translate-x-4 translate-y-4 overflow-hidden rounded-xl border-4 border-white shadow-lg" />
              </div>
              <div className="md:w-1/2 md:pl-8 text-center md:text-left">
                <h3 className="mb-3 text-2xl font-semibold">Actionable Progress</h3>
                <p className="text-slate-600">
                  Track your mastery across different levels of thinking with our{" "}
                  <strong className="text-sky-600">
                    Bloom&rsquo;s Taxonomy‑based dashboard
                  </strong>
                  . Know exactly where to focus your efforts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* bottom wave (colored to background) */}
        <div className="absolute -bottom-px left-0 right-0">
          <svg
            className="block h-[120px] w-[calc(100%+1.3px)]"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
              style={{ fill: "#f9fafb" }}
            />
          </svg>
        </div>
      </section>

      {/* Agent Briefing */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
            Agent Briefing: Field Intelligence
          </h2>

          <div className="mx-auto max-w-3xl space-y-4">
            {/* FAQ 1 */}
            <details className="group rounded-lg border border-slate-200 bg-white p-4 transition-all duration-300 open:bg-sky-50/70 open:shadow-lg">
              <summary className="flex cursor-pointer items-center justify-between gap-4">
                <h4 className="text-base font-semibold">
                  What is Bloom&rsquo;s taxonomy and why is it my core training protocol?
                </h4>
                <div className="text-sky-600 transition-transform duration-300 group-open:rotate-180">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 256 256"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                  >
                    <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                  </svg>
                </div>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                It is a classified hierarchy of cognitive skills, from basic recall (&ldquo;Remember&rdquo;)
                to advanced synthesis (&ldquo;Create&rdquo;). Your training is structured around this protocol to
                ensure you don&rsquo;t just memorize intel but can effectively analyze, evaluate, and apply it
                in high‑stakes scenarios. Each level you master unlocks a deeper dimension of understanding.
              </p>
            </details>

            {/* FAQ 2 */}
            <details className="group rounded-lg border border-slate-200 bg-white p-4 transition-all duration-300 open:bg-sky-50/70 open:shadow-lg">
              <summary className="flex cursor-pointer items-center justify-between gap-4">
                <h4 className="text-base font-semibold">How do I level up and earn tokens?</h4>
                <div className="text-sky-600 transition-transform duration-300 group-open:rotate-180">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 256 256"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                  >
                    <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                  </svg>
                </div>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                You earn Experience Points (XP) for every correct answer. Higher‑difficulty questions
                (like &ldquo;Analyze&rdquo; or &ldquo;Evaluate&rdquo;) yield more XP. Accumulating XP increases your
                Commander Level and your level within each deck. Tokens are awarded for consistent
                performance and deck mastery, which you can spend on powerful upgrades in the Shop.
              </p>
            </details>

            {/* FAQ 3 */}
            <details className="group rounded-lg border border-slate-200 bg-white p-4 transition-all duration-300 open:bg-sky-50/70 open:shadow-lg">
              <summary className="flex cursor-pointer items-center justify-between gap-4">
                <h4 className="text-base font-semibold">What are the different mission types?</h4>
                <div className="text-sky-600 transition-transform duration-300 group-open:rotate-180">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 256 256"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                  >
                    <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                  </svg>
                </div>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Our platform offers various mission profiles to suit your training needs:
                <br />
                <strong className="text-slate-900">Quest:</strong> Standard‑issue progression through a deck&rsquo;s cognitive levels.
                <br />
                <strong className="text-slate-900">Target Practice:</strong> Focus on intel you&rsquo;ve previously answered incorrectly.
                <br />
                <strong className="text-slate-900">Timed Drill:</strong> A high‑pressure test of speed and accuracy.
                <br />
                <strong className="text-slate-900">Level Up:</strong> Concentrate your efforts on mastering a single Bloom&rsquo;s Level at a time.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Footer is likely in layout; leaving page footer to your global layout */}
    </main>
  );
}
