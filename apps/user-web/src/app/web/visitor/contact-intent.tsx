"use client";

import { useEffect, useState } from "react";
import { renderVisitorContactIntent, type VisitorContactIntentState } from "../../../pages/visitor-home";

export function ContactIntent() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const body = document.querySelector<HTMLElement>("[data-contact-intent-body]");
    if (body === null) return;

    let timer: number | undefined;
    const render = (state: VisitorContactIntentState) => {
      body.innerHTML = renderVisitorContactIntent(state);
      if (state === "INVALID") body.querySelector<HTMLInputElement>("#contact-intent-name")?.focus();
    };
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.contactIntentForm !== "true") return;
      event.preventDefault();
      const formData = new FormData(form);
      const name = String(formData.get("contactName") ?? "").trim();
      const topic = String(formData.get("contactTopic") ?? "").trim();
      if (!name || !topic) {
        render("INVALID");
        return;
      }
      render("SUBMITTING");
      timer = window.setTimeout(() => render("CONFIRMED"), 180);
    };

    render("IDLE");
    body.addEventListener("submit", onSubmit);
    setReady(true);
    return () => {
      body.removeEventListener("submit", onSubmit);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return <span hidden data-contact-intent-ready={ready ? "true" : undefined} />;
}
