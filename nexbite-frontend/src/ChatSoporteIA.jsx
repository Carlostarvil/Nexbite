import { useState, useRef, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

// Consulta GraphQL integrada con el backend de NexBite
const CHATEAR_CON_BOT = gql`
  query ChatearConBot($mensaje: String!) {
    chatearConBot(mensaje: $mensaje)
  }
`;

export default function ChatSoporteIA() {
  const [abierto, setAbierto] = useState(false);
  const [oculto, setOculto] = useState(false); // NUEVO ESTADO PARA ESCONDER EL WIDGET
  const [mensajes, setMensajes] = useState([
    {
      remitente: 'bot',
      texto: '¡Hola! 👋 Soy NexBot, el asistente de soporte de NexBite. ¿En qué puedo ayudarte hoy con tus pedidos o entregas?',
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputTexto, setInputTexto] = useState('');
  const finMensajesRef = useRef(null);

  const [ejecutarConsultaBot, { loading: escribiendo }] = useLazyQuery(CHATEAR_CON_BOT, {
    fetchPolicy: 'network-only'
  });

  useEffect(() => {
    if (abierto) {
      finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, escribiendo, abierto]);

  const preguntasFrecuentes = [
    '¿Dónde está mi pedido?',
    'Quiero cancelar mi pedido',
    '¿Cómo pido un reembolso?',
    'Tiempos de entrega',
    'Hablar con un agente'
  ];

  const enviarMensaje = async (textoAEnviar) => {
    const texto = (textoAEnviar || inputTexto).trim();
    if (!texto || escribiendo) return;

    const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setMensajes((prev) => [
      ...prev,
      { remitente: 'usuario', texto, hora: horaActual }
    ]);
    setInputTexto('');

    try {
      const { data } = await ejecutarConsultaBot({ variables: { mensaje: texto } });
      const respuestaTexto = data?.chatearConBot || 
        'No he podido procesar tu solicitud en este momento. Por favor, escribe a soporte@nexbite.com.';

      setMensajes((prev) => [
        ...prev,
        {
          remitente: 'bot',
          texto: respuestaTexto,
          hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          remitente: 'bot',
          texto: 'Ha ocurrido un error de conexión con el servicio de soporte. Inténtalo de nuevo en unos instantes.',
          hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enviarMensaje();
    }
  };

  return (
    <>
      {/* 1. MODO OCULTO: Pestaña diminuta en el borde derecho */}
      {oculto && (
        <button
          onClick={() => setOculto(false)}
          title="Abrir soporte"
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '0',
            width: '24px',
            height: '48px',
            backgroundColor: '#ff4500',
            color: '#fff',
            border: 'none',
            borderTopLeftRadius: '8px',
            borderBottomLeftRadius: '8px',
            boxShadow: '-2px 2px 10px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            opacity: 0.6,
            transition: 'all 0.2s ease-out'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.width = '32px'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.width = '24px'; }}
        >
          ◀
        </button>
      )}

      {/* 2. MODO VISIBLE: Burbuja flotante y Chat */}
      {!oculto && (
        <>
          {/* Contenedor del Botón Flotante */}
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px'
          }}>
            {/* Pequeña "x" para ocultar la burbuja sin tener que abrir el chat */}
            {!abierto && (
              <button
                onClick={() => setOculto(true)}
                title="Ocultar asistente"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  color: '#888',
                  border: '1px solid #ddd',
                  fontSize: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s',
                  padding: 0
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#d63031'; e.currentTarget.style.borderColor = '#d63031'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#ddd'; }}
              >
                ✖
              </button>
            )}

            <button
              onClick={() => setAbierto(!abierto)}
              aria-label="Atención al cliente con IA"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#ff4500',
                color: '#fff',
                border: 'none',
                boxShadow: '0 4px 15px rgba(255, 69, 0, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                transition: 'transform 0.2s, background-color 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {abierto ? '✕' : '🤖'}
            </button>
          </div>

          {/* Ventana emergente del chat interactivo */}
          {abierto && (
            <div
              style={{
                position: 'fixed',
                bottom: '80px',
                right: '20px',
                width: '320px',
                maxWidth: 'calc(100vw - 40px)',
                height: '450px',
                maxHeight: 'calc(100vh - 100px)',
                backgroundColor: '#fff',
                borderRadius: '14px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 9998,
                border: '1px solid #eee',
                animation: 'aparecerChat 0.2s ease-out'
              }}
            >
              <style>
                {`
                  @keyframes aparecerChat {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  .ocultar-scrollbar-chat::-webkit-scrollbar { display: none; }
                  .ocultar-scrollbar-chat { -ms-overflow-style: none; scrollbar-width: none; }
                `}
              </style>

              {/* Cabecera del bot con NUEVOS CONTROLES */}
              <div
                style={{
                  backgroundColor: '#ff4500',
                  color: '#fff',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🤖</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>NexBot Soporte</h4>
                    <span style={{ fontSize: '10px', opacity: 0.9 }}>🟢 En línea 24/7</span>
                  </div>
                </div>
                
                {/* Botones de Minimizar y Cerrar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setAbierto(false)}
                    title="Minimizar a burbuja"
                    style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', opacity: 0.8, padding: 0 }}
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => { setAbierto(false); setOculto(true); }}
                    title="Cerrar y ocultar"
                    style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', opacity: 0.8, padding: 0 }}
                  >
                    ✖
                  </button>
                </div>
              </div>

              {/* Área de mensajes con scroll independiente */}
              <div
                style={{
                  flex: 1,
                  padding: '14px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: '#f9f9fb'
                }}
              >
                {mensajes.map((m, index) => {
                  const esUsuario = m.remitente === 'usuario';
                  return (
                    <div
                      key={index}
                      style={{
                        alignSelf: esUsuario ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: esUsuario ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: esUsuario ? '#ff4500' : '#fff',
                          color: esUsuario ? '#fff' : '#333',
                          padding: '8px 12px',
                          borderRadius: esUsuario ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          fontSize: '13px',
                          lineHeight: '1.4',
                          boxShadow: esUsuario ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
                          border: esUsuario ? 'none' : '1px solid #eee'
                        }}
                      >
                        {m.texto}
                      </div>
                      <span style={{ fontSize: '9px', color: '#999', marginTop: '3px' }}>
                        {m.hora}
                      </span>
                    </div>
                  );
                })}

                {escribiendo && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: '#fff',
                      padding: '6px 12px',
                      borderRadius: '10px',
                      border: '1px solid #eee',
                      fontSize: '11px',
                      color: '#777'
                    }}
                  >
                    NexBot está pensando... 💭
                  </div>
                )}
                <div ref={finMensajesRef} />
              </div>

              {/* Accesos rápidos sugeridos */}
              <div
                style={{
                  padding: '10px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  backgroundColor: '#fff',
                  borderTop: '1px solid #f0f0f0',
                  flexShrink: 0
                }}
              >
                {preguntasFrecuentes.map((pregunta, i) => (
                  <button
                    key={i}
                    onClick={() => enviarMensaje(pregunta)}
                    disabled={escribiendo}
                    style={{
                      whiteSpace: 'nowrap',
                      fontSize: '11px',
                      padding: '5px 10px',
                      borderRadius: '12px',
                      border: '1px solid #ffd2c2',
                      backgroundColor: '#fff5f2',
                      color: '#ff4500',
                      cursor: escribiendo ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      opacity: escribiendo ? 0.6 : 1,
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => !escribiendo && (e.currentTarget.style.backgroundColor = '#ffe5db')}
                    onMouseLeave={(e) => !escribiendo && (e.currentTarget.style.backgroundColor = '#fff5f2')}
                  >
                    {pregunta}
                  </button>
                ))}
              </div>

              {/* Barra de entrada y envío */}
              <div
                style={{
                  padding: '10px',
                  borderTop: '1px solid #eee',
                  backgroundColor: '#fff',
                  display: 'flex',
                  gap: '8px',
                  flexShrink: 0
                }}
              >
                <input
                  type="text"
                  placeholder="Escribe tu consulta o ID..."
                  value={inputTexto}
                  onChange={(e) => setInputTexto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={escribiendo}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    outline: 'none',
                    fontSize: '12.5px'
                  }}
                />
                <button
                  onClick={() => enviarMensaje()}
                  disabled={!inputTexto.trim() || escribiendo}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: '#ff4500',
                    color: '#fff',
                    border: 'none',
                    cursor: !inputTexto.trim() || escribiendo ? 'not-allowed' : 'pointer',
                    opacity: !inputTexto.trim() || escribiendo ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px'
                  }}
                >
                  ➤
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}