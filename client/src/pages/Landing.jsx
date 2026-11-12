// client/src/pages/Landing.jsx
import { useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import toast from "react-hot-toast";
import {
  Check,
  Info,
  Briefcase,
  Search,
  Building2,
  Users,
  ShieldCheck,
  Wallet,
  Star,
  MousePointerClick,
  Clock,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import BrandLogo from "../components/BrandLogo";
import { ClockArt, ConstellationArt } from "../components/landing/LandingArt";
import { useRole } from "../hooks/useRole";
import { openAuthModal } from "../store/authModalSlice";
import { PLATFORM_FEE_FLAT } from "../constants/businessRule";
import ThemeToggle from "../components/ThemeToggle";

const FEATURES = [
  {
    badge: (
      <span className="text-primary flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 text-3xl sm:text-4xl font-extrabold">
        1
      </span>
    ),
    title: "Live Shift Matching",
    body: "Post a shift and get matched with verified hourly workers near you, in real time.",
  },
  {
    badge: (
      <span className="text-secondary flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary/10 text-3xl sm:text-4xl font-extrabold">
        2
      </span>
    ),
    title: "Secure Wallet Escrow",
    body: "Pay is locked in escrow when you accept a worker and released the moment the shift ends.",
  },
  {
    badge: (
      <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-success/10">
        <Check className="text-success w-7 h-7 sm:w-8 sm:h-8" strokeWidth={3} aria-hidden="true" />
      </div>
    ),
    title: "Verified Profiles",
    body: "Every worker and employer is ID-verified, with two-way ratings after every shift.",
  },
];

const FAQS = [
  {
    q: "How do workers get paid?",
    a: "Employers deposit the shift pay into a secure escrow wallet when they accept a worker. Once the shift is completed and both parties confirm, the funds are instantly released to the worker's account.",
  },
  {
    q: "Are the workers vetted?",
    a: "Yes. Every user on the platform must pass an ID verification process before they can apply for shifts or post jobs. We also maintain a strict two-way rating system to ensure high quality.",
  },
  {
    q: "What happens if a worker cancels?",
    a: "If a worker cancels an accepted shift, the escrowed funds are immediately returned to the employer's wallet. The worker will receive a strike on their account; three strikes result in a permanent ban.",
  },
  {
    q: "Is there a subscription fee?",
    a: `No. Shyftra is completely free for workers. Employers only pay a flat ₹${PLATFORM_FEE_FLAT} fee per posted shift. There are no monthly subscriptions or hidden charges.`,
  },
];

function Landing() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { setRole } = useRole();
  const { user } = useSelector((state) => state.auth);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function choose(side) {
    if (user && user.role !== side) {
      toast(
        user.role === "admin"
          ? "You're signed in as an admin."
          : `You're signed in as ${user.role === "worker" ? "a worker" : "an employer"} — log out to use the other side.`,
        {
          icon: <Info className="w-5 h-5 text-info" />,
          id: "role-mismatch",
        },
      );
      navigate("/dashboard");
      return;
    }
    setRole(side);
    navigate(side === "employer" ? "/employer" : "/worker");
  }

  return (
    <div className="bg-base-200 text-base-content relative font-sans selection:bg-primary/20">
      <Helmet>
        <title>Shyftra — The Premier On-Demand Gig Marketplace</title>
        <meta
          name="description"
          content="Post a shift or find hourly work. Verified profiles, live matching and secure wallet escrow."
        />
      </Helmet>

      {/* Decorative artwork */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <ClockArt className="landing-glow-clock hidden md:block absolute -left-14 top-62 w-57.5 h-57.5 opacity-90" />
        <ClockArt className="landing-glow-clock hidden md:block absolute -right-16 top-10 w-52.5 h-52.5 opacity-90" />
        <ConstellationArt className="hidden lg:block absolute right-0 top-75 w-75 h-53.5" />
      </div>

      {/* ---------- Sticky Navbar ---------- */}
      <nav className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200 px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <BrandLogo />

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-semibold text-base-content/80">
            <a href="#features" className="hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">
              How it Works
            </a>
            <a href="#solutions" className="hover:text-primary transition-colors">
              Solutions
            </a>
            <a href="#pricing" className="hover:text-primary transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-primary transition-colors">
              FAQ
            </a>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <div className="h-5 w-px bg-base-300" />
            {user ? (
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="btn btn-sm btn-primary rounded-xl font-bold px-4 shadow-sm"
              >
                Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dispatch(openAuthModal({ mode: "signup" }))}
                className="btn btn-sm btn-primary rounded-xl font-bold px-4 shadow-sm shadow-primary/20"
              >
                Get Started
              </button>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="flex md:hidden items-center gap-1.5">
            <ThemeToggle />
            <button
              type="button"
              className="btn btn-ghost btn-square btn-sm rounded-xl"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-3 border-t border-base-200 mt-3 space-y-1">
            {[
              { href: "#features", label: "Features" },
              { href: "#how-it-works", label: "How it Works" },
              { href: "#solutions", label: "Solutions" },
              { href: "#pricing", label: "Pricing" },
              { href: "#faq", label: "FAQ" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-base-200"
              >
                {link.label}
              </a>
            ))}

            <div className="pt-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/dashboard");
                  }}
                  className="btn btn-sm btn-primary w-full rounded-xl font-bold"
                >
                  Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    dispatch(openAuthModal({ mode: "signup" }));
                  }}
                  className="btn btn-sm btn-primary w-full rounded-xl font-bold"
                >
                  Get Started
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 sm:pt-8 md:pt-12">
        {/* ---------- Hero ---------- */}
        <header className="text-center pt-6 sm:pt-12 md:pt-16 pb-8 sm:pb-10">
          <h1 className="font-extrabold uppercase leading-[1.1] tracking-tight text-[clamp(2rem,7vw,4.5rem)] text-base-content">
            The Premier On-Demand
            <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary">
              Gig Marketplace
            </span>
          </h1>
          <p className="mx-auto mt-5 sm:mt-6 max-w-2xl text-base-content/70 text-base sm:text-lg md:text-xl leading-relaxed px-2">
            Shyftra connects businesses with verified hourly workers in minutes.
            Post a shift or find work near you — pay stays safe in escrow until
            the job is done.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => choose("employer")}
              className="group w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-content px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
            >
              <Briefcase className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Post a Shift
            </button>
            <button
              type="button"
              onClick={() => choose("worker")}
              className="group w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-secondary text-secondary-content px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-bold shadow-lg shadow-secondary/25 hover:shadow-secondary/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
            >
              <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Find Hourly Work
            </button>
          </div>
        </header>

        {/* ---------- Feature cards ---------- */}
        <section
          id="features"
          className="mt-16 sm:mt-24 md:mt-28 grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 scroll-mt-24 sm:scroll-mt-32 relative z-10"
        >
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-3xl border border-base-200 bg-base-100/80 backdrop-blur-sm px-5 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10 text-center shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex justify-center mb-5 sm:mb-6">{f.badge}</div>
              <h2 className="text-lg sm:text-xl font-bold text-base-content mb-2.5 sm:mb-3">
                {f.title}
              </h2>
              <p className="text-sm sm:text-[15px] leading-relaxed text-base-content/70">
                {f.body}
              </p>
            </article>
          ))}
        </section>

        {/* ---------- How it Works ---------- */}
        <section
          id="how-it-works"
          className="mt-20 sm:mt-28 md:mt-32 scroll-mt-24 sm:scroll-mt-32 text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight px-2">
            How Shyftra Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-base-content/70 max-w-xl mx-auto mb-10 sm:mb-12 px-2">
            A seamless experience designed to eliminate no-shows and payment
            delays.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10 md:gap-8 relative">
            {/* Connecting line — desktop only, corrected Tailwind value */}
            <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-0.5 bg-linear-to-r from-primary/30 to-secondary/30 z-0" />

            {[
              {
                icon: MousePointerClick,
                title: "1. Match",
                desc: "Employers post a shift. Verified workers apply with one click.",
              },
              {
                icon: Clock,
                title: "2. Work",
                desc: "Escrow locks the funds. The worker arrives and checks in via OTP.",
              },
              {
                icon: Wallet,
                title: "3. Get Paid",
                desc: "Shift ends, exit is confirmed, and payment is instantly transferred.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className={`relative z-10 flex flex-col items-center ${
                  i === 2 ? "sm:col-span-2 md:col-span-1" : ""
                }`}
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-base-100 border border-base-200 shadow-md flex items-center justify-center mb-5 sm:mb-6">
                  <step.icon className="w-8 h-8 sm:w-10 sm:h-10 text-base-content/80" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-sm sm:text-base text-base-content/70 px-4 max-w-xs">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Solutions ---------- */}
        <section
          id="solutions"
          className="mt-20 sm:mt-28 md:mt-32 scroll-mt-24 sm:scroll-mt-32"
        >
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight px-2">
              One platform, two sides
            </h2>
            <p className="mt-3 text-sm sm:text-base text-base-content/70 max-w-xl mx-auto px-2">
              Everything you need to manage your workforce or find your next
              gig.
            </p>
          </div>

          <div className="grid gap-5 sm:gap-6 grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto">
            {/* Employer Card */}
            <div className="rounded-3xl border border-base-200 bg-base-100 p-6 sm:p-8 shadow-sm hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <div className="p-2.5 sm:p-3 bg-primary/10 rounded-2xl text-primary shrink-0">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-base-content">
                  For Employers
                </h3>
              </div>
              <ul className="space-y-3.5 sm:space-y-4 text-sm sm:text-base text-base-content/70">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>
                    Post a shift with pay, time and location in under a minute.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>
                    Accept the worker you like — their pay is safely held in
                    escrow.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>
                    Confirm arrival and exit seamlessly with one-time codes.
                  </span>
                </li>
              </ul>
            </div>

            {/* Worker Card */}
            <div className="rounded-3xl border border-base-200 bg-base-100 p-6 sm:p-8 shadow-sm hover:border-secondary/30 transition-colors">
              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <div className="p-2.5 sm:p-3 bg-secondary/10 rounded-2xl text-secondary shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-base-content">
                  For Workers
                </h3>
              </div>
              <ul className="space-y-3.5 sm:space-y-4 text-sm sm:text-base text-base-content/70">
                <li className="flex items-start gap-3">
                  <Search className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <span>
                    Browse nearby shifts immediately without signing up.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <span>
                    Apply, get accepted, and check in effortlessly on site.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Wallet className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <span>
                    Get paid directly from escrow the moment the shift ends.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Testimonials ---------- */}
        <section className="mt-20 sm:mt-28 md:mt-32">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight px-2">
              Trusted by thousands
            </h2>
          </div>
          <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {[
              {
                name: "Rahul S.",
                role: "Event Manager",
                quote:
                  "No more last-minute scrambling. If someone drops out, I can post a shift on Shyftra and have a verified replacement in 15 minutes.",
              },
              {
                name: "Priya M.",
                role: "Freelance Server",
                quote:
                  "The escrow feature is a game-changer. I never have to worry about an employer 'forgetting' to pay me at the end of the night.",
              },
              {
                name: "Amit Patel",
                role: "Warehouse Owner",
                quote:
                  "We use Shyftra to scale our loading team during peak season. The OTP check-in system keeps attendance perfectly tracked.",
              },
            ].map((review, i) => (
              <div
                key={i}
                className={`bg-base-100 p-6 sm:p-8 rounded-3xl border border-base-200 shadow-sm flex flex-col ${
                  i === 2 ? "sm:col-span-2 md:col-span-1" : ""
                }`}
              >
                <div className="flex gap-1 text-warning mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm sm:text-base text-base-content/80 mb-6 flex-1 italic">
                  "{review.quote}"
                </p>
                <div className="flex items-center gap-3 border-t border-base-200 pt-4">
                  <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center font-bold text-base-content/50 shrink-0">
                    {review.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight truncate">
                      {review.name}
                    </p>
                    <p className="text-xs text-base-content/60 truncate">
                      {review.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section
          id="pricing"
          className="mt-20 sm:mt-28 md:mt-32 scroll-mt-24 sm:scroll-mt-32"
        >
          <div className="max-w-4xl mx-auto text-center bg-base-100 border border-base-200 rounded-3xl p-8 sm:p-12 md:p-14 shadow-lg shadow-base-content/5 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />

            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight relative z-10">
              Simple, Transparent Pricing
            </h2>

            <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center relative z-10">
              <p className="text-5xl sm:text-6xl font-black text-base-content mb-3">
                ₹{PLATFORM_FEE_FLAT}
              </p>
              <span className="badge badge-primary badge-outline font-bold px-3 sm:px-4 py-3 uppercase tracking-wider text-[10px] sm:text-xs">
                Per Posted Shift
              </span>
            </div>

            <p className="mx-auto mt-6 max-w-md text-base-content/70 text-base sm:text-lg relative z-10">
              Workers <strong className="text-base-content">always</strong> use
              Shyftra for free. Employers pay a flat fee per shift. No
              subscriptions, no hidden charges.
            </p>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section
          id="faq"
          className="mt-20 sm:mt-28 md:mt-32 max-w-3xl mx-auto scroll-mt-24 sm:scroll-mt-32"
        >
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight px-2">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="collapse collapse-arrow bg-base-100 border border-base-200 rounded-2xl"
              >
                <input type="radio" name="faq-accordion" defaultChecked={i === 0} />
                <div className="collapse-title text-base sm:text-lg font-bold pr-10">
                  {faq.q}
                </div>
                <div className="collapse-content text-sm sm:text-base text-base-content/70">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Bottom CTA ---------- */}
        <section className="mt-20 sm:mt-28 md:mt-32 mb-16 sm:mb-20">
          <div className="bg-linear-to-br from-primary/10 via-base-100 to-secondary/10 border border-base-200 rounded-3xl p-8 sm:p-12 md:p-16 text-center shadow-sm">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">
              Ready to get started?
            </h2>
            <p className="text-base sm:text-lg text-base-content/70 max-w-xl mx-auto mb-8 sm:mb-10">
              Join thousands of businesses and workers already using Shyftra to
              streamline hourly work.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() =>
                  user
                    ? choose("employer")
                    : dispatch(openAuthModal({ mode: "signup" }))
                }
                className="w-full sm:w-auto btn btn-primary px-6 sm:px-8 text-white rounded-xl shadow-md shadow-primary/20"
              >
                Hire a Worker <ArrowRight className="w-4 h-4 ml-1" />
              </button>
              <button
                type="button"
                onClick={() =>
                  user
                    ? choose("worker")
                    : dispatch(openAuthModal({ mode: "signup" }))
                }
                className="w-full sm:w-auto btn bg-base-100 border-base-300 hover:bg-base-200 px-6 sm:px-8 rounded-xl"
              >
                Find Work <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ---------- Footer ---------- */}
      <footer className="bg-base-100 border-t border-base-200 pt-12 sm:pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
            {/* Brand — full width on mobile, 1 col on md+ */}
            <div className="col-span-2 md:col-span-1">
              <BrandLogo />
              <p className="mt-4 text-sm text-base-content/60 leading-relaxed max-w-xs">
                The premier on-demand gig marketplace connecting verified hourly
                workers with local businesses in real-time.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm sm:text-base">Platform</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-base-content/70">
                <li>
                  <a href="#how-it-works" className="hover:text-primary transition-colors">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-primary transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="hover:text-primary transition-colors">
                    For Employers
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="hover:text-primary transition-colors">
                    For Workers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm sm:text-base">Company</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-base-content/70">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Contact Support
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-primary transition-colors">
                    Help Center / FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm sm:text-base">Legal</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-base-content/70">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Trust & Safety
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-base-200 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs sm:text-sm text-base-content/50 text-center md:text-left">
              © {new Date().getFullYear()} Shyftra Technologies. All rights reserved.
            </p>
            <div className="flex gap-4">
              {/* Twitter */}
              <a
                href="#"
                className="text-base-content/40 hover:text-primary transition-colors"
                aria-label="Twitter"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href="#"
                className="text-base-content/40 hover:text-primary transition-colors"
                aria-label="Instagram"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href="#"
                className="text-base-content/40 hover:text-primary transition-colors"
                aria-label="LinkedIn"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;