"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { AuthCard, authInputClass } from "@/components/auth/AuthCard";
import { FieldError } from "@/components/auth/FieldError";
import { PhoneCodeForm } from "@/components/auth/PhoneCodeForm";

export default function B2BRegisterPage() {
  const t = useTranslations("b2bAuth");
  const router = useRouter();
  const setSession = useB2bAuth((state) => state.setSession);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");

  return (
    <AuthCard
      brand={t("brand")}
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/login" className="text-ink font-medium hover:underline">
            {t("toLogin")}
          </Link>
        </>
      }
    >
      <PhoneCodeForm
        intent="register"
        payload={{ name, company_name: companyName }}
        submitLabel={t("register")}
        onSuccess={(token, user) => {
          setSession(token, user);
          router.push("/catalog");
        }}
        fields={(errors) => (
          <>
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-ink mb-1">
                {t("name")} <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={authInputClass}
              />
              <FieldError messages={errors.name} />
            </div>
            <div>
              <label htmlFor="reg-company" className="block text-sm font-medium text-ink mb-1">
                {t("companyName")} <span className="text-muted font-normal">({t("optional")})</span>
              </label>
              <input
                id="reg-company"
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={authInputClass}
                placeholder="ТОО Пример"
              />
              <FieldError messages={errors.company_name} />
            </div>
          </>
        )}
      />
    </AuthCard>
  );
}
