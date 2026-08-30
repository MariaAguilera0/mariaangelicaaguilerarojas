document.addEventListener("DOMContentLoaded", () => {
    console.log("App.js cargado correctamente.");
    let contador = 0;
    const contadorSpan = document.getElementById("contador");
    const productos = document.querySelectorAll(".producto");

    productos.forEach(producto => {
        producto.addEventListener("click", () => {
            contador++;
            if (contadorSpan) {
                contadorSpan.textContent = contador;
            }
            const sound = document.getElementById("click") || document.getElementById("sonido") || document.getElementById("musica");
            if (sound && typeof sound.play === "function") {
                sound.play().catch(() => {});
            }
        });
    });
});
