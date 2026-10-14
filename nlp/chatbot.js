import { NlpManager } from 'node-nlp';

// Entrenamiento y procesamiento de mensajes del modelo node-nlp.
const nlpManager = new NlpManager({ languages: ['es'], forceNER: true });

export const inicializarChatbot = async () => {
    nlpManager.addDocument('es', 'Hola', 'saludo');
    nlpManager.addDocument('es', 'Buenos dias', 'saludo');
    nlpManager.addDocument('es', 'Qué tal', 'saludo');
    nlpManager.addAnswer('es', 'saludo', '¡Hola! Soy el asistente virtual de NexBite. ¿En qué te puedo ayudar hoy?');

    nlpManager.addDocument('es', 'Quiero pedir comida', 'hacer_pedido');
    nlpManager.addDocument('es', 'Tengo hambre, quiero unos tacos', 'hacer_pedido');
    nlpManager.addDocument('es', 'Me gustaría ordenar algo de comer', 'hacer_pedido');
    nlpManager.addAnswer('es', 'hacer_pedido', '¡Claro! Revisa nuestras recomendaciones en pantalla. ¿Te gustaría comida Mexicana o Italiana?');

    await nlpManager.train();
    nlpManager.save();
    console.log('🤖 Cerebro NLP de NexBite entrenado y listo.');
    
    return nlpManager;
};

export const procesarMensaje = async (mensaje) => {
    const respuestaIA = await nlpManager.process('es', mensaje);
    return respuestaIA.answer || "Lo siento, aún estoy aprendiendo. ¿Podrías decirlo de otra forma?";
};