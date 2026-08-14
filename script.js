function cargar(pagina) {
    console.log("Botón pulsado:", pagina);

    const visor = document.getElementById("visor");

    if (visor) {
        visor.src = pagina;
        console.log("Iframe cambiado a:", visor.src);
    } else {
        console.error("No existe el elemento #visor");
    }
}
