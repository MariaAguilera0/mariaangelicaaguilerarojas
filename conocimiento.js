/* CONOCIMIENTO DEL CHATBOT — este es el archivo para "entrenarle"
   preguntas : formas en que un cliente podría preguntar (mientras más, mejor)
   respuesta : lo que responde el bot. **texto** = negrita, \n = salto de línea
   accion    : (opcional) botón. pagina = archivo a abrir, url = cualquier enlace
*/

const CONOCIMIENTO = {
  nombreBot: "Asistente SKYAPPS",
  bienvenida: "¡Hola! 👋 Soy el asistente virtual de **SKYAPPS**. Puedo contarte sobre nuestros servicios, precios o cómo contactarnos. ¿En qué te ayudo?",
  noEntiendo: "Mmm, no estoy seguro de haber entendido 🤔. Prueba con otra forma de preguntarlo o elige una de estas opciones:",
  sugerencias: [
    "¿Qué servicios ofrecen?",
    "¿Cuánto cuesta?",
    "¿Cómo los contacto?"
  ],

  temas: [
    {
      preguntas: ["hola", "buenas", "buenos días", "buenas tardes", "buenas noches", "que tal", "saludos"],
      respuesta: "¡Hola! 😊 Soy el asistente de **SKYAPPS**. ¿Qué te gustaría saber? Puedo ayudarte con nuestros **servicios**, **precios** o **datos de contacto**."
    },
    {
      preguntas: ["gracias", "muchas gracias", "te agradezco", "genial", "excelente"],
      respuesta: "¡Con mucho gusto! Si tienes otra pregunta, aquí estoy. 😊"
    },
    {
      preguntas: ["adiós", "chao", "hasta luego", "nos vemos", "bye"],
      respuesta: "¡Hasta pronto! Gracias por visitarnos. 👋"
    },
    {
      preguntas: ["que servicios ofrecen", "que hacen", "a que se dedican", "servicios", "que ofrecen", "que venden"],
      respuesta: "Ofrecemos:\n\n🌐 **Realidad Virtual**: experiencias inmersivas.\n💻 **Desarrollo Web**: sitios modernos para cualquier dispositivo.\n🚀 **Innovación Digital**: transformación digital para tu negocio.",
      accion: { texto: "Ver servicios", url: "#servicios" }
    },
    {
      preguntas: ["precio", "cuanto cuesta", "cuanto vale", "precios", "cotización", "cotizar", "tarifas"],
      respuesta: "Los precios dependen de cada proyecto. Escríbenos a **correo@empresa.com** y te enviamos una **cotización sin costo**. 😊",
      accion: { texto: "Pedir cotización", url: "mailto:correo@empresa.com?subject=Cotización" }
    },
    {
      preguntas: ["contacto", "como los contacto", "telefono", "correo", "email", "whatsapp", "hablar con alguien", "asesor"],
      respuesta: "Puedes escribirnos o llamarnos:\n\n📧 **correo@empresa.com**\n📞 **+57 300 000 0000**",
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
