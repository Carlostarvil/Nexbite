import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const REGISTRAR_USUARIO = gql`
  mutation RegistrarUsuario($nombre: String!, $email: String!, $password: String!, $rol: String!) {
    registrarUsuario(nombre: $nombre, email: $email, password: $password, rol: $rol) { 
      id_usuario, nombre, rol, token 
    }
  }
`;

const INICIAR_SESION = gql`
  mutation IniciarSesion($email: String!, $password: String!) {
    iniciarSesion(email: $email, password: $password) { id_usuario, nombre, rol, token }
  }
`;

const INICIAR_SESION_GOOGLE = gql`
  mutation IniciarSesionGoogle($token_google: String!, $rol: String) {
    iniciarSesionGoogle(token_google: $token_google, rol: $rol) {
      id_usuario, nombre, rol, token
    }
  }
`;

const SOLICITAR_RECUPERACION = gql`
  mutation SolicitarRecuperacion($identificador: String!) {
    solicitarRecuperacionPassword(identificador: $identificador)
  }
`;

const RESTABLECER_PASSWORD = gql`
  mutation RestablecerPassword($token: String!, $nueva_password: String!) {
    restablecerPassword(token: $token, nueva_password: $nueva_password)
  }
`;

const GOOGLE_CLIENT_ID = "843824368024-1tkoj6d49643fmj3puiab75roa60ig10.apps.googleusercontent.com";

export default function Auth({ onLogin }) {
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '', rol: 'CLIENTE', confirmPassword: '', identificador: '' });
  const [modo, setModo] = useState('LOGIN'); 
  const [tokenURL, setTokenURL] = useState(null);

  const [registrar, { loading: loadingReg }] = useMutation(REGISTRAR_USUARIO);
  const [iniciarSesion, { loading: loadingLog }] = useMutation(INICIAR_SESION);
  const [iniciarGoogle, { loading: loadingGoogle }] = useMutation(INICIAR_SESION_GOOGLE);
  const [solicitarRecuperacion, { loading: loadingRecup }] = useMutation(SOLICITAR_RECUPERACION);
  const [restablecerPassword, { loading: loadingRest }] = useMutation(RESTABLECER_PASSWORD);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
      setTokenURL(token);
      setModo('RESTABLECER');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    try {
      if (modo === 'LOGIN') {
        const respuesta = await iniciarSesion({ variables: { email: formData.email, password: formData.password } });
        localStorage.setItem('nexbite_token', respuesta.data.iniciarSesion.token);
        localStorage.setItem('user', JSON.stringify(respuesta.data.iniciarSesion));
        onLogin();
      } 
      else if (modo === 'REGISTRO') {
        const respuesta = await registrar({ variables: { nombre: formData.nombre, email: formData.email, password: formData.password, rol: formData.rol } });
        localStorage.setItem('nexbite_token', respuesta.data.registrarUsuario.token);
        localStorage.setItem('user', JSON.stringify(respuesta.data.registrarUsuario));
        onLogin();
      }
      else if (modo === 'RECORDAR') {
        const { data } = await solicitarRecuperacion({ variables: { identificador: formData.identificador } });
        alert(data.solicitarRecuperacionPassword);
        setModo('LOGIN'); 
      } 
      else if (modo === 'RESTABLECER') {
        if (formData.password !== formData.confirmPassword) return alert("Las contraseñas no coinciden");
        if (formData.password.length < 6) return alert("La contraseña debe tener al menos 6 caracteres");
        
        const { data } = await restablecerPassword({ variables: { token: tokenURL, nueva_password: formData.password } });
        alert(data.restablecerPassword);
        
        window.history.replaceState({}, document.title, "/"); 
        setModo('LOGIN');
        setFormData({ ...formData, password: '', confirmPassword: '' });
      }
    } catch (err) {
      alert(err.message.replace("GraphQL error: ", ""));
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const respuesta = await iniciarGoogle({ 
        variables: { token_google: credentialResponse.credential, rol: formData.rol } 
      });
      localStorage.setItem('nexbite_token', respuesta.data.iniciarSesionGoogle.token);
      localStorage.setItem('user', JSON.stringify(respuesta.data.iniciarSesionGoogle));
      onLogin();
    } catch (err) {
      alert(err.message.replace("GraphQL error: ", ""));
    }
  };

  const loading = loadingLog || loadingReg || loadingGoogle || loadingRecup || loadingRest;

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      
      {/* Estilos globales para micro-interacciones dentro del auth */}
      <style>{`
        .auth-input:focus { border-color: #ff4500 !important; background-color: #fff !important; }
        .auth-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(255, 69, 0, 0.25); }
        .auth-link:hover { color: #ff4500 !important; text-decoration: underline; }
      `}</style>

      <div style={{ 
        width: '100%', 
        margin: '0 auto', 
        padding: '3rem 2.5rem', 
        border: '1px solid #eaeaea', 
        borderRadius: '24px', 
        backgroundColor: '#fff', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
        boxSizing: 'border-box'
      }}>
        
        {/* Cabecera visual */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '64px', height: '64px', margin: '0 auto 1rem', 
            backgroundColor: '#fff5f2', borderRadius: '16px', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', color: '#ff4500' 
          }}>
            {modo === 'LOGIN' && <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>}
            {modo === 'REGISTRO' && <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>}
            {modo === 'RECORDAR' && <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>}
            {modo === 'RESTABLECER' && <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"></path><circle cx="16.5" cy="7.5" r=".5"></circle></svg>}
          </div>

          <h2 style={{ margin: '0 0 0.5rem 0', color: '#1a1a1a', fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
            {modo === 'LOGIN' ? '¡Hola de nuevo!' : 
             modo === 'REGISTRO' ? 'Únete a NexBite' : 
             modo === 'RECORDAR' ? 'Recuperar acceso' : 'Nueva contraseña'}
          </h2>
          
          <p style={{ margin: 0, color: '#666', fontSize: '15px' }}>
            {modo === 'LOGIN' ? 'Inicia sesión para gestionar tus pedidos.' : 
             modo === 'REGISTRO' ? 'Crea tu cuenta en menos de un minuto.' : 
             modo === 'RECORDAR' ? 'Te enviaremos un enlace a tu correo.' : 'Introduce tu nueva contraseña segura.'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* SECCIÓN REGISTRO: Selección de Rol mucho más visual sin emojis */}
          {modo === 'REGISTRO' && (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                <div 
                  onClick={() => setFormData({ ...formData, rol: 'CLIENTE' })}
                  style={{ 
                    flex: 1, padding: '15px', borderRadius: '14px', border: formData.rol === 'CLIENTE' ? '2px solid #ff4500' : '1px solid #eaeaea', 
                    backgroundColor: formData.rol === 'CLIENTE' ? '#fff5f2' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' 
                  }}
                >
                  <div style={{
                    width: '44px', height: '44px', margin: '0 auto 10px', borderRadius: '50%',
                    backgroundColor: formData.rol === 'CLIENTE' ? '#ff4500' : '#f5f5f5',
                    color: formData.rol === 'CLIENTE' ? '#fff' : '#888',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: formData.rol === 'CLIENTE' ? '#ff4500' : '#555' }}>Cliente</span>
                </div>
                <div 
                  onClick={() => setFormData({ ...formData, rol: 'VENDEDOR' })}
                  style={{ 
                    flex: 1, padding: '15px', borderRadius: '14px', border: formData.rol === 'VENDEDOR' ? '2px solid #ff4500' : '1px solid #eaeaea', 
                    backgroundColor: formData.rol === 'VENDEDOR' ? '#fff5f2' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' 
                  }}
                >
                  <div style={{
                    width: '44px', height: '44px', margin: '0 auto 10px', borderRadius: '50%',
                    backgroundColor: formData.rol === 'VENDEDOR' ? '#ff4500' : '#f5f5f5',
                    color: formData.rol === 'VENDEDOR' ? '#fff' : '#888',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9h18v2H3z"></path>
                      <path d="M4 11v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9"></path>
                      <path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"></path>
                      <path d="M12 11v10"></path>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: formData.rol === 'VENDEDOR' ? '#ff4500' : '#555' }}>Vendedor</span>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                <input 
                  type="text" placeholder="Nombre completo" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required 
                  className="auth-input"
                  style={{ width: '100%', padding: '15px 15px 15px 48px', borderRadius: '12px', border: '1px solid #eaeaea', backgroundColor: '#fafafa', fontSize: '15px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s' }}
                />
              </div>
            </>
          )}
          
          {modo === 'RECORDAR' && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>
              </span>
              <input 
                type="text" placeholder="Correo o nombre de usuario" value={formData.identificador} onChange={(e) => setFormData({ ...formData, identificador: e.target.value })} required
                className="auth-input"
                style={{ width: '100%', padding: '15px 15px 15px 48px', borderRadius: '12px', border: '1px solid #eaeaea', backgroundColor: '#fafafa', fontSize: '15px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s' }}
              />
            </div>
          )}

          {(modo === 'LOGIN' || modo === 'REGISTRO') && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </span>
              <input 
                type="email" placeholder="Correo electrónico" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required
                className="auth-input"
                style={{ width: '100%', padding: '15px 15px 15px 48px', borderRadius: '12px', border: '1px solid #eaeaea', backgroundColor: '#fafafa', fontSize: '15px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s' }}
              />
            </div>
          )}
          
          {(modo === 'LOGIN' || modo === 'REGISTRO' || modo === 'RESTABLECER') && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </span>
              <input 
                type="password" placeholder={modo === 'RESTABLECER' ? "Nueva contraseña" : "Contraseña"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required
                className="auth-input"
                style={{ width: '100%', padding: '15px 15px 15px 48px', borderRadius: '12px', border: '1px solid #eaeaea', backgroundColor: '#fafafa', fontSize: '15px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s' }}
              />
            </div>
          )}

          {modo === 'RESTABLECER' && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <input 
                type="password" placeholder="Confirmar nueva contraseña" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required 
                className="auth-input"
                style={{ width: '100%', padding: '15px 15px 15px 48px', borderRadius: '12px', border: '1px solid #eaeaea', backgroundColor: '#fafafa', fontSize: '15px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s' }}
              />
            </div>
          )}
          
          <button type="submit" disabled={loading} className="auth-btn" style={{ padding: '16px', background: '#ff4500', color: '#fff', border: 'none', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px', transition: 'all 0.2s', width: '100%', marginTop: '10px', opacity: loading ? 0.7 : 1 }}>
             {loading ? 'Cargando...' : 
             modo === 'LOGIN' ? 'Entrar a mi cuenta' : 
             modo === 'REGISTRO' ? 'Crear cuenta' : 
             modo === 'RECORDAR' ? 'Enviar enlace de recuperación' : 'Guardar nueva contraseña'}
          </button>
        </form>

        {/* PIE DEL FORMULARIO Y GOOGLE LOGIN */}
        <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {modo === 'LOGIN' && (
            <>
              <button onClick={() => setModo('RECORDAR')} className="auth-link" style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', transition: 'color 0.2s' }}>¿Has olvidado tu contraseña?</button>
              
              <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#eaeaea' }}></div>
                <span style={{ padding: '0 15px', color: '#999', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>O continúa con</span>
                <div style={{ flex: 1, height: '1px', background: '#eaeaea' }}></div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => { console.error('El login con Google falló'); }} useOneTap shape="pill" theme="outline" size="large" text="signin_with" />
              </div>
              
              <span style={{ fontSize: '14.5px', color: '#555', marginTop: '1rem' }}>
                ¿No tienes cuenta? <button onClick={() => setModo('REGISTRO')} className="auth-link" style={{ color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14.5px', padding: 0 }}>Regístrate aquí</button>
              </span>
            </>
          )}
          
          {modo === 'REGISTRO' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#eaeaea' }}></div>
                <span style={{ padding: '0 15px', color: '#999', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>O regístrate con</span>
                <div style={{ flex: 1, height: '1px', background: '#eaeaea' }}></div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => { console.error('El registro con Google falló'); }} useOneTap shape="pill" theme="outline" size="large" text="signup_with" />
              </div>
              
              <span style={{ fontSize: '14.5px', color: '#555', marginTop: '1rem' }}>
                ¿Ya tienes cuenta? <button onClick={() => setModo('LOGIN')} className="auth-link" style={{ color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14.5px', padding: 0 }}>Inicia sesión</button>
              </span>
            </>
          )}

          {modo === 'RECORDAR' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#eaeaea' }}></div>
              </div>
              <button onClick={() => setModo('LOGIN')} className="auth-link" style={{ color: '#555', background: '#f5f5f5', padding: '12px 20px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: 'fit-content', margin: '0 auto', transition: 'background 0.2s' }} onMouseEnter={(e)=> e.currentTarget.style.background = '#ebebeb'} onMouseLeave={(e)=> e.currentTarget.style.background = '#f5f5f5'}>
                &larr; Volver al Login
              </button>
            </>
          )}

          {modo === 'RESTABLECER' && (
             <button onClick={() => {
                window.history.replaceState({}, document.title, "/"); 
                setModo('LOGIN');
             }} className="auth-link" style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px' }}>Cancelar y volver</button>
          )}
        </div>

      </div>
    </GoogleOAuthProvider>
  );
}