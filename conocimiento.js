/* CONOCIMIENTO DEL CHATBOT — este es el archivo para "entrenarle"
   preguntas : formas en que un cliente podría preguntar (mientras más, mejor)
   respuesta : lo que responde el bot. **texto** = negrita, \n = salto de línea
   accion    : (opcional) botón. pagina = archivo a abrir, url = cualquier enlace
*/

const CONOCIMIENTO = {
  nombreBot: "Asistente SKYAPPS",
  bienvenida: "¡Hola! Bienvenido al asistente de SKYAPPS. Puedo informarte sobre nuestros servicios, tarifas o cómo contactarnos. ¿En qué podemos ayudarte?",
  noEntiendo: "No logramos comprender tu consulta. Puedes formularla con otras palabras o seleccionar una de las siguientes opciones:",
  sugerencias: [
    "¿Qué servicios ofrecen?",
    "¿Cuánto cuesta?",
    "¿Cómo los contacto?"
  ],

  temas: [
    {
      preguntas: ["hola", "buenas", "buenos días", "buenas tardes", "buenas noches", "que tal", "saludos"],
      respuesta: "¡Hola! Bienvenido a **SKYAPPS**. ¿Qué te gustaría saber? Te podemos orientar con nuestros **servicios**, **precios** o **datos de contacto**."
    },
    {
      preguntas: ["gracias", "muchas gracias", "te agradezco", "genial", "excelente"],
      respuesta: "¡Con mucho gusto! Si tienes alguna otra duda o consulta, con gusto te atenderemos."
    },
    {
      preguntas: ["adiós", "chao", "hasta luego", "nos vemos", "bye"],
      respuesta: "¡Hasta pronto! Gracias por visitarnos."
    },
    {
      preguntas: ["que servicios ofrecen", "que hacen", "a que se dedican", "servicios", "que ofrecen", "que venden"],
      respuesta: "Ofrecemos desarrollo de sistemas y aplicaciones a la medida:\n• **Realidad Virtual**: experiencias inmersivas interactivas.\n• **Desarrollo Web**: plataformas digitales modernas para cualquier dispositivo.\n• **Innovación Digital**: soluciones tecnológicas para tu negocio.",
      accion: { texto: "Ver servicios", url: "#servicios" }
    },
    {
      preguntas: ["precio", "cuanto cuesta", "cuanto vale", "precios", "cotización", "cotizar", "tarifas"],
      respuesta: "Los precios dependen de las necesidades de cada proyecto. Escríbenos a **es.freechair@gmail.com** y te enviaremos una cotización personalizada sin costo.",
      accion: { texto: "Pedir cotización", url:"mailto:es.freechair@gmail.com" }
    },
    {
      preguntas: ["contacto", "como los contacto", "correo", "email", "hablar con alguien", "asesor"],
      respuesta: "Puedes escribirnos directamente a nuestro correo de atención:\n\n**es.freechair@gmail.com**",
      accion: { texto: "Enviar correo", url: "mailto:correo@empresa.com" }
    },
    {
      preguntas: ["horario", "a que hora abren", "cuando atienden", "dias de atencion"],
      respuesta: "Atendemos de **lunes a viernes, de 8:00 a.m. a 6:00 p.m.**"
    },
    {
      preguntas: ["donde estan", "dirección", "ubicacion", "como llego", "en que ciudad"],
      respuesta: "Estamos en **Bogotá, Colombia**. También atendemos de forma virtual en todo el país."
    }
  ]
};
