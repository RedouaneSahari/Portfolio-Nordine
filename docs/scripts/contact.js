const contactForm = document.querySelector("#contactForm");
const statusBox = document.querySelector("#formStatus");

const getFieldValue = (formData, name) => String(formData.get(name) || "").trim();

const clearStatus = () => {
  if (!statusBox) return;
  statusBox.textContent = "";
  statusBox.dataset.type = "";
  statusBox.classList.remove("is-visible");
};

const setStatus = (type, message) => {
  if (!statusBox) return;
  statusBox.textContent = String(message || "").trim();
  statusBox.dataset.type = type;
  statusBox.classList.add("is-visible");
};

const decodeTarget = (value) => {
  if (!value) return "";

  try {
    return window.atob(value).trim();
  } catch (error) {
    console.error("Impossible de décoder l'adresse de contact :", error);
    return "";
  }
};

const buildFormSubmitPayload = (payload) => {
  const formPayload = new FormData();
  formPayload.append("name", payload.name);
  formPayload.append("email", payload.email);
  formPayload.append("phone", payload.phone);
  formPayload.append("subject", payload.subject);
  formPayload.append("message", payload.message);
  formPayload.append("_subject", payload.subject || "Nouveau message portfolio");
  formPayload.append("_template", "table");
  formPayload.append("_replyto", payload.email);
  return formPayload;
};

if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    const formData = new FormData(contactForm);
    if (!contactForm.reportValidity()) {
      return;
    }

    const honeypot = getFieldValue(formData, "website");
    if (honeypot) {
      contactForm.reset();
      return;
    }

    const payload = {
      name: getFieldValue(formData, "name"),
      email: getFieldValue(formData, "email"),
      phone: getFieldValue(formData, "phone"),
      subject: getFieldValue(formData, "subject"),
      message: getFieldValue(formData, "message"),
    };

    if (!payload.name || !payload.email || !payload.message) {
      return;
    }

    const endpoint = contactForm.dataset.endpoint || contactForm.getAttribute("action") || "#";
    const staticContactMode = contactForm.dataset.staticContact || "";
    const staticTarget = decodeTarget(contactForm.dataset.contactTarget);
    const submitButton = contactForm.querySelector("button[type='submit']");

    contactForm.classList.add("is-busy");
    if (submitButton) submitButton.disabled = true;
    setStatus("loading", "Envoi en cours...");

    try {
      if (staticContactMode === "formsubmit" && staticTarget) {
        const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(staticTarget)}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
          body: buildFormSubmitPayload(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok) {
          contactForm.reset();
          setStatus("success", "Message envoyé");
          return;
        }

        console.error("Erreur FormSubmit:", response.status, result);
        setStatus(
          "error",
          result.message || "Impossible d'envoyer le message pour le moment."
        );
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        contactForm.reset();
        setStatus("success", "Message envoyé");
      } else {
        console.error("Erreur envoi contact:", response.status);
        setStatus(
          "error",
          result.message || "Impossible d'envoyer le message pour le moment."
        );
      }
    } catch (error) {
      console.error("Erreur réseau contact:", error);
      setStatus(
        "error",
        "Erreur réseau. Vérifiez votre connexion puis réessayez."
      );
    } finally {
      contactForm.classList.remove("is-busy");
      if (submitButton) submitButton.disabled = false;
    }
  });
}
