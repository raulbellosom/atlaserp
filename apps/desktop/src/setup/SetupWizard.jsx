import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Palette,
  ClipboardCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AuthAtmosphere, Button } from "@runly/ui";
import { runly } from "../lib/runly";
import { applyBrandTheme } from "../lib/brandTheme";
import { useBrandingStore } from "../stores/branding";
import { ThemeToggle } from "../components/ThemeToggle";
import { SetupHero } from "./SetupHero";
import { SetupInitView } from "./SetupInitView";
import { StepAdmin } from "./StepAdmin";
import { StepCompany } from "./StepCompany";
import { StepBranding } from "./StepBranding";
import { StepReview } from "./StepReview";

const STEPS = [
  {
    label: "Cuenta admin",
    icon: User,
    title: "Cuenta de administrador",
    description: "Esta será la cuenta principal del sistema.",
  },
  {
    label: "Tu empresa",
    icon: Building2,
    title: "Tu empresa",
    description: "Información básica de la organización.",
  },
  {
    label: "Identidad visual",
    icon: Palette,
    title: "Identidad visual",
    description: "Personalización visual de la instancia.",
  },
  {
    label: "Confirmar",
    icon: ClipboardCheck,
    title: "Revisar y confirmar",
    description: "Verifica los datos antes de inicializar.",
  },
];

const CTA_GRADIENT = { backgroundImage: "linear-gradient(120deg,#FD6016,#E4262A)" };

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 36 : -36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -36 : 36, opacity: 0 }),
};

export function SetupWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setBranding = useBrandingStore((s) => s.setBranding);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showInit, setShowInit] = useState(false);
  const stepRef = useRef(null);
  const [formData, setFormData] = useState({
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
    adminConfirmPassword: "",
    companyName: "",
    legalName: "",
    rfc: "",
    companyType: "",
    companyTypeName: "",
    companyIndustryKey: "",
    companyIndustryName: "",
    companySize: "",
    contactEmail: "",
    phone: "",
    website: "",
    country: "",
    state: "",
    city: "",
    colony: "",
    street: "",
    extNumber: "",
    intNumber: "",
    postalCode: "",
    primaryColor: "#FD6016",
    logo: null,
  });

  function handleChange(patch) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("adminFirstName", formData.adminFirstName);
      fd.append("adminLastName", formData.adminLastName);
      fd.append("adminEmail", formData.adminEmail);
      fd.append("adminPassword", formData.adminPassword);
      fd.append("companyName", formData.companyName);
      fd.append("legalName", formData.legalName);
      fd.append("rfc", formData.rfc);
      fd.append("companyType", formData.companyType);
      fd.append("companyTypeName", formData.companyTypeName);
      fd.append("companyIndustryKey", formData.companyIndustryKey);
      fd.append("companyIndustryName", formData.companyIndustryName);
      fd.append("companySize", formData.companySize);
      fd.append("contactEmail", formData.contactEmail);
      fd.append("phone", formData.phone);
      fd.append("website", formData.website);
      fd.append("country", formData.country);
      fd.append("state", formData.state);
      fd.append("city", formData.city);
      fd.append("colony", formData.colony);
      fd.append("street", formData.street);
      fd.append("extNumber", formData.extNumber);
      fd.append("intNumber", formData.intNumber);
      fd.append("postalCode", formData.postalCode);
      fd.append("primaryColor", formData.primaryColor);
      if (formData.logo) fd.append("logo", formData.logo);
      return runly.setup.initialize(fd);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["instance-status"] });
      try {
        const status = await runly.instance.status();
        applyBrandTheme(status?.branding?.primaryColor);
        setBranding(status?.branding ?? null);
      } catch {}
    },
  });

  function handleNext() {
    if (step === STEPS.length - 1) {
      setShowInit(true);
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

  function handleGoToStep(i) {
    if (i >= step || mutation.isPending) return;
    mutation.reset();
    setShowInit(false);
    setDirection(-1);
    setStep(i);
  }

  function handleRestart() {
    mutation.reset();
    setShowInit(false);
    setDirection(-1);
    setStep(0);
  }

  const stepProps = { ref: stepRef, data: formData, onChange: handleChange };
  const effectiveStep = showInit ? STEPS.length : step;
  const tasks = [
    { label: "Base de datos aprovisionada", meta: "postgres" },
    {
      label: "Esquema de empresa creado",
      meta: formData.companyName?.trim() || "empresa",
    },
    { label: "Cuenta de administrador", meta: "1 usuario" },
    { label: "Módulos base instalados", meta: "4 módulos" },
  ];

  return (
    <div className="relative h-dvh overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)]">
      <AuthAtmosphere />
      <SetupHero />

      <section className="relative z-10 h-dvh box-border flex px-4 py-4 sm:px-8 sm:py-8 lg:px-10">
        <div className="relative w-full flex flex-col gap-6 rounded-[26px] glass-shell px-5 py-6 sm:px-8 sm:py-7 overflow-hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {STEPS.flatMap((s, i) => {
                const nodes = [
                  <div
                    key={`step-${i}`}
                    className="flex flex-col items-center gap-1.5 shrink-0"
                  >
                    {i < effectiveStep ? (
                      <button
                        type="button"
                        onClick={() => handleGoToStep(i)}
                        title={`Editar: ${s.label}`}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full grid place-items-center text-white transition-transform duration-200 hover:scale-105 cursor-pointer"
                        style={{
                          background: "linear-gradient(140deg,#FD6016,#E4262A)",
                          boxShadow: "0 6px 18px rgba(253,96,22,.35)",
                        }}
                      >
                        <Check size={13} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <div
                        className={[
                          "w-7 h-7 sm:w-8 sm:h-8 rounded-full grid place-items-center transition-all duration-300",
                          i === effectiveStep
                            ? "glass-tinted-brand text-(--brand-primary) ring-2 ring-(--brand-primary)/30"
                            : "glass-subtle text-foreground/40",
                        ].join(" ")}
                      >
                        <s.icon size={13} strokeWidth={1.75} />
                      </div>
                    )}
                    <span
                      onClick={i < effectiveStep ? () => handleGoToStep(i) : undefined}
                      className={[
                        "hidden sm:block text-[10px] font-medium whitespace-nowrap transition-colors duration-300",
                        i < effectiveStep
                          ? "text-(--brand-primary)/70 hover:text-(--brand-primary) cursor-pointer"
                          : i === effectiveStep
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
                        "h-px flex-1 mx-1 sm:mx-1.5 mb-4.5 transition-all duration-500",
                        i < effectiveStep ? "bg-(--brand-primary)" : "bg-border",
                      ].join(" ")}
                    />,
                  );
                }
                return nodes;
              })}
            </div>
            <ThemeToggle />
          </div>

          <div className="h-px bg-border shrink-0" />

          <div className="flex-1 min-h-0 overflow-auto pr-2 -mr-2">
            {showInit ? (
              <SetupInitView
                tasks={tasks}
                success={mutation.isSuccess}
                isError={mutation.isError}
                errorMessage={mutation.error?.message}
                onRestart={handleRestart}
                onBack={() => {
                  mutation.reset();
                  setShowInit(false);
                }}
                onEnter={() => navigate("/app/login", { replace: true })}
              />
            ) : (
              <>
                <div className="mb-6 min-h-16">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`header-${step}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                    >
                      <h2 className="text-[27px] font-bold tracking-tight text-foreground">
                        {STEPS[step].title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {STEPS[step].description}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {step === 0 && <StepAdmin {...stepProps} />}
                    {step === 1 && <StepCompany {...stepProps} />}
                    {step === 2 && <StepBranding {...stepProps} />}
                    {step === 3 && (
                      <StepReview
                        ref={stepRef}
                        data={formData}
                        onGoToStep={handleGoToStep}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </div>

          {!showInit && (
            <div className="flex items-center justify-between gap-4 pt-5 border-t border-border shrink-0">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 0}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
              >
                <ChevronLeft size={15} />
                Atrás
              </button>

              <div className="hidden sm:flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === step ? 26 : 6,
                      background:
                        i <= step ? "var(--brand-primary)" : "hsl(var(--border))",
                    }}
                  />
                ))}
              </div>

              <Button type="button" variant="gradient" style={CTA_GRADIENT} onClick={handleNext}>
                {step === STEPS.length - 1 ? "Inicializar" : "Siguiente"}
                <ChevronRight size={15} />
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
