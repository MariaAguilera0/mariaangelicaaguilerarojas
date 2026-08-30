window.cargar = function cargar(pagina, titulo) {
    console.log("Cargando página:", pagina, titulo);

    let visor = document.getElementById("visor");

    // Si estamos dentro de un iframe, buscar el elemento #visor en la ventana padre
    if (!visor) {
        try {
            if (window.parent && window.parent !== window && window.parent.document) {
                const parentVisor = window.parent.document.getElementById("visor");
                if (parentVisor) {
                    visor = parentVisor;
                }
            }
        } catch (e) {
            console.log("Acceso al documento padre no disponible:", e);
        }
    }

    if (visor) {
        // Asignar directamente la propiedad src para cambiar la página del iframe
        visor.src = pagina;
        console.log("Iframe src cambiado a:", pagina);

        // Actualizar el estado visual de la ventana padre si se llamó desde el iframe
        try {
            if (window.parent && window.parent !== window && window.parent.document) {
                const parentDoc = window.parent.document;
                const parentTitle = parentDoc.getElementById("titulo-visor");
                if (parentTitle && titulo) {
                    parentTitle.textContent = "Visor Virtual 3D - " + titulo;
                }
                const parentButtons = parentDoc.querySelectorAll(".tabs button");
                parentButtons.forEach(btn => {
                    const onclickAttr = btn.getAttribute("onclick") || "";
                    if (onclickAttr.includes(pagina)) {
                        btn.classList.add("active");
                    } else {
                        btn.classList.remove("active");
                    }
                });
            }
        } catch (e) {
            // Ignorar si hay restricciones entre marcos
        }
    } else {
        // Redireccionar si no existe visor ni marco contenedor
        window.location.href = pagina;
    }

    // Actualizar clase activa en las pestañas del documento actual
    const botones = document.querySelectorAll(".tabs button");
    botones.forEach(btn => {
        const onclickAttr = btn.getAttribute("onclick") || "";
        if (onclickAttr.includes(pagina)) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Actualizar título del contenedor en el documento actual si existe
    const tituloVisor = document.getElementById("titulo-visor");
    if (tituloVisor && titulo) {
        tituloVisor.textContent = "Visor Virtual 3D - " + titulo;
    }
};

function cargar(pagina, titulo) {
    window.cargar(pagina, titulo);
}
