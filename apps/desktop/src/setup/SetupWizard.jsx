import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Building2,
  Shield,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { atlas } from "../lib/atlas";
import { StepAdmin } from "./StepAdmin";
import { StepCompany } from "./StepCompany";
import { StepBranding } from "./StepBranding";
import { StepReview } from "./StepReview";

const STEPS = [
  {
    label: "Cuenta admin",
    subtitle: "Esto define quién tiene el control total.",
    title: "Cuenta de administrador",
    description: "Esta será la cuenta principal del sistema.",
  },
  {
    label: "Tu empresa",
    subtitle: "El punto de partida de toda tu operación.",
    title: "Tu empresa",
    description: "Información básica de la organización.",
  },
  {
    label: "Identidad visual",
    subtitle: "La cara de Atlas en tu instancia.",
    title: "Identidad visual",
    description: "Personalización visual de la instancia.",
  },
  {
    label: "Confirmar",
    subtitle: "Un último vistazo antes de arrancar.",
    title: "Revisar y confirmar",
    description: "Verifica los datos antes de inicializar.",
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Modular por diseño",
    desc: "Cada módulo que instalas tiene un propósito. Sin dependencias ocultas, sin peso extra.",
  },
  {
    icon: Building2,
    title: "Multi-empresa",
    desc: "Varias organizaciones bajo una sola instancia, con datos completamente separados.",
  },
  {
    icon: Shield,
    title: "Datos en tu servidor",
    desc: "Sin intermediarios. Tus datos viven donde tú decides.",
  },
  {
    icon: Zap,
    title: "Rendimiento real",
    desc: "Diseñado para producción desde el primer día. Rápido donde importa.",
  },
];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 36 : -36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -36 : 36, opacity: 0 }),
};

export function SetupWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const stepRef = useRef(null);
  const [formData, setFormData] = useState({
    adminDisplayName: "",
    adminEmail: "",
    adminPassword: "",
    adminConfirmPassword: "",
    companyName: "",
    primaryColor: "#6366f1",
    logo: null,
  });

  function handleChange(patch) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("adminDisplayName", formData.adminDisplayName);
      fd.append("adminEmail", formData.adminEmail);
      fd.append("adminPassword", formData.adminPassword);
      fd.append("companyName", formData.companyName);
      fd.append("primaryColor", formData.primaryColor);
      if (formData.logo) fd.append("logo", formData.logo);
      return atlas.setup.initialize(fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instance-status"] });
      navigate("/login", { replace: true });
    },
  });

  function handleNext() {
    if (step === STEPS.length - 1) {
      mutation.mutate();
      return;
    }
    const valid = stepRef.current?.validate?.() ?? true;
    if (valid) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step === 0) return;
    mutation.reset();
    setDirection(-1);
    setStep((s) => s - 1);
  }

  const stepProps = { ref: stepRef, data: formData, onChange: handleChange };

  return (
    <div className="h-dvh overflow-hidden bg-background lg:grid lg:grid-cols-2">
      {/* ── LEFT PANEL: Branding — desktop only ── */}
      <div
        className="hidden lg:flex relative flex-col justify-between px-14 py-12 overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, hsl(239 84% 11%) 0%, hsl(263 70% 9%) 55%, hsl(285 60% 7%) 100%)",
        }}
      >
        {/* Glow orbs */}
        <div
          className="pointer-events-none absolute -top-40 -left-40 w-150 h-150 rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, hsl(239 84% 67%) 0%, transparent 65%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 w-120 h-120 rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, hsl(263 70% 66%) 0%, transparent 65%)",
          }}
        />
        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        {/* Header wordmark */}
        <motion.div
          className="relative z-10 flex items-center gap-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "hsl(239 84% 67%)" }}
          >
            <Layers size={15} className="text-white" />
          </div>
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-white/50">
            Atlas ERP
          </span>
        </motion.div>

        {/* Hero + features */}
        <motion.div
          className="relative z-10 flex flex-col gap-10"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          <div>
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-white leading-[1.1]">
              Gestión empresarial
              <br />
              <span style={{ color: "hsl(263 70% 78%)" }}>sin límites.</span>
            </h1>
            <p
              className="mt-4 text-sm xl:text-base leading-relaxed max-w-xs"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Configura tu instancia en minutos. Todo bajo tu control, en tu
              infraestructura.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className="flex items-start gap-3.5 rounded-xl p-3.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.45,
                  delay: 0.18 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(99,102,241,0.22)" }}
                >
                  <f.icon size={15} style={{ color: "hsl(239 84% 82%)" }} />
                </div>
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "rgba(255,255,255,0.88)" }}
                  >
                    {f.title}
                  </p>
                  <p
                    className="text-xs mt-0.5 leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.42)" }}
                  >
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
            Atlas ERP — Meridian Edition
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
            v0.1.0
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL / FULL SCREEN on mobile: Form ── */}
      <div className="flex flex-col h-dvh overflow-hidden bg-background">
        {/* Mobile/Tablet branding header — hidden on desktop */}
        <motion.div
          className="lg:hidden shrink-0 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(145deg, hsl(239 84% 11%) 0%, hsl(263 70% 9%) 55%, hsl(285 60% 7%) 100%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Glow orbs */}
          <div
            className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20"
            style={{
              background:
                "radial-gradient(circle, hsl(239 84% 67%) 0%, transparent 65%)",
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-10 -right-10 w-52 h-52 rounded-full opacity-10"
            style={{
              background:
                "radial-gradient(circle, hsl(263 70% 66%) 0%, transparent 65%)",
            }}
          />
          {/* Grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />

          {/* Logo + headline */}
          <div className="relative z-10 px-5 sm:px-8 pt-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "hsl(239 84% 67%)" }}
              >
                <Layers size={13} className="text-white" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-white/50">
                Atlas ERP
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-[1.15]">
              Gestión empresarial{" "}
              <span style={{ color: "hsl(263 70% 78%)" }}>sin límites.</span>
            </p>
            <p
              className="text-xs mt-1.5"
              style={{ color: "rgba(255,255,255,0.42)" }}
            >
              Configura tu instancia en minutos. Todo bajo tu control.
            </p>
          </div>

          {/* Feature chips — horizontal scroll */}
          <div className="relative z-10 flex gap-2 px-5 sm:px-8 pb-5 overflow-x-auto scrollbar-none">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 shrink-0"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <f.icon size={12} style={{ color: "hsl(239 84% 82%)" }} />
                <span
                  className="text-[11px] font-medium whitespace-nowrap"
                  style={{ color: "rgba(255,255,255,0.80)" }}
                >
                  {f.title}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-auto">
          <div className="flex flex-col px-5 sm:px-8 lg:px-10 xl:px-14 py-8 lg:py-10">
            <div className="w-full max-w-100 mx-auto flex flex-col">
              {/* Steps progress — part of the form flow */}
              <motion.div
                className="flex items-start w-full mb-7"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                {STEPS.flatMap((s, i) => {
                  const nodes = [
                    <div
                      key={`step-${i}`}
                      className="flex flex-col items-center gap-1.5 shrink-0"
                    >
                      <div
                        className={[
                          "w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold transition-all duration-300",
                          i < step
                            ? "bg-primary text-primary-foreground"
                            : i === step
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                              : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {i < step ? (
                          <Check size={11} strokeWidth={2.5} />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className={[
                          "text-[9px] sm:text-[10px] font-medium whitespace-nowrap transition-colors duration-300",
                          i === step
                            ? "text-foreground"
                            : "text-muted-foreground/60",
                        ].join(" ")}
                      >
                        {s.label}
                      </span>
                    </div>,
                  ];
                  if (i < STEPS.length - 1) {
                    nodes.push(
                      <div
                        key={`conn-${i}`}
                        className={[
                          "h-px flex-1 mx-1.5 sm:mx-2 mt-3 sm:mt-3.5 transition-all duration-500",
                          i < step ? "bg-primary" : "bg-border",
                        ].join(" ")}
                      />,
                    );
                  }
                  return nodes;
                })}
              </motion.div>

              <div className="border-t border-border mb-7" />

              {/* Step title + description — fades only, never moves */}
              <div className="mb-7 min-h-16">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`header-${step}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                  >
                    <h2 className="text-2xl font-bold tracking-tight">
                      {STEPS[step].title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {STEPS[step].description}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Animated fields only — slides in/out */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  style={{ width: "100%" }}
                >
                  {step === 0 && <StepAdmin {...stepProps} />}
                  {step === 1 && <StepCompany {...stepProps} />}
                  {step === 2 && <StepBranding {...stepProps} />}
                  {step === 3 && (
                    <StepReview
                      ref={stepRef}
                      data={formData}
                      error={mutation.error?.message}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="w-full mt-8 pt-6 border-t border-border flex items-center justify-between">
                <button
                  onClick={handleBack}
                  disabled={step === 0 || mutation.isPending}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  <ChevronLeft size={16} />
                  Atrás
                </button>

                <span className="text-xs text-muted-foreground tabular-nums">
                  {step + 1} / {STEPS.length}
                </span>

                <button
                  onClick={handleNext}
                  disabled={mutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {mutation.isPending
                    ? "Inicializando..."
                    : step === STEPS.length - 1
                      ? "Inicializar"
                      : "Siguiente"}
                  {!mutation.isPending && step < STEPS.length - 1 && (
                    <ChevronRight size={16} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
