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

    const endpoint =
      contactForm.dataset.endpoint || contactForm.getAttribute("action") || "/api/contact";
    const submitButton = contactForm.querySelector("button[type='submit']");

    contactForm.classList.add("is-busy");
    if (submitButton) submitButton.disabled = true;
    setStatus("loading", "Envoi en cours...");

    try {
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
