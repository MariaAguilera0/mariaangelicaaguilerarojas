// recuperar.jss - Controlador para la recuperación y restablecimiento de contraseña
import { recuperarContrasena } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const formRecuperar = document.getElementById("form-recuperar");
  const emailInput = document.getElementById("email-recuperar");
  const btnRecuperar = document.getElementById("btn-recuperar");
  const alertError = document.getElementById("alert-error");
  const alertSuccess = document.getElementById("alert-success");

  function mostrarError(mensaje) {
    if (alertSuccess) alertSuccess.style.display = "none";
    if (alertError) {
      alertError.textContent = mensaje;
      alertError.style.display = "block";
    }
  }

  function mostrarExito(mensaje) {
    if (alertError) alertError.style.display = "none";
    if (alertSuccess) {
      alertSuccess.textContent = mensaje;
      alertSuccess.style.display = "block";
    }
  }

  function ocultarAlertas() {
    if (alertError) alertError.style.display = "none";
    if (alertSuccess) alertSuccess.style.display = "none";
  }

  if (formRecuperar) {
    formRecuperar.addEventListener("submit", async (e) => {
      e.preventDefault();
      ocultarAlertas();

      const email = emailInput ? emailInput.value.trim() : "";

      if (!email) {
        mostrarError("Por favor ingresa tu correo electrónico.");
        return;
      }

      if (btnRecuperar) {
        btnRecuperar.disabled = true;
        btnRecuperar.textContent = "Enviando enlace...";
      }

      try {
        const res = await recuperarContrasena(email);

        if (res.success) {
          mostrarExito(res.mensaje || "Se ha enviado un enlace de recuperación a tu correo.");
          if (emailInput) emailInput.value = "";
          if (btnRecuperar) {
            btnRecuperar.textContent = "¡Enlace Enviado!";
          }
        } else {
          mostrarError(res.error || "Ocurrió un error al enviar el enlace.");
          if (btnRecuperar) {
            btnRecuperar.disabled = false;
            btnRecuperar.textContent = "Enviar enlace de recuperación";
          }
        }
      } catch (err) {
        console.error("Error inesperado al recuperar contraseña:", err);
        mostrarError("Ocurrió un error inesperado. Por favor intenta de nuevo.");
        if (btnRecuperar) {
          btnRecuperar.disabled = false;
          btnRecuperar.textContent = "Enviar enlace de recuperación";
        }
      }
    });
  }
});
