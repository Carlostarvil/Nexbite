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

// MODIFICADO: Ahora pedimos "identificador"
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
  // MODIFICADO: Añadido "identificador" al estado
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
        // MODIFICADO: Le pasamos el identificador al servidor
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
      <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2.5rem', border: '1px solid #e0e0e0', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
        
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: '#333' }}>
          {modo === 'LOGIN' ? 'Iniciar Sesión' : modo === 'REGISTRO' ? 'Crear Cuenta' : modo === 'RECORDAR' ? 'Recuperar Contraseña' : 'Nueva Contraseña'}
        </h2>
        
        {modo === 'RECORDAR' && (
          <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
            Introduce tu <b>correo</b> o <b>nombre de usuario</b> y te enviaremos un enlace a tu correo registrado.
          </p>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {modo === 'REGISTRO' && (
            <>
              <input 
                type="text" 
                placeholder="Tu Nombre" 
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required 
                style={{ padding: '0.9rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box' }}
              />
              
              <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input type="radio" name="rol" value="CLIENTE" checked={formData.rol === 'CLIENTE'} onChange={(e) => setFormData({ ...formData, rol: e.target.value })} />
                  🍕 Soy Cliente
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input type="radio" name="rol" value="VENDEDOR" checked={formData.rol === 'VENDEDOR'} onChange={(e) => setFormData({ ...formData, rol: e.target.value })} />
                  🏪 Soy Vendedor
                </label>
              </div>
            </>
          )}
          
          {/* MODIFICADO: Formulario especial solo para recuperar contraseña (type="text") */}
          {modo === 'RECORDAR' && (
             <input 
              type="text" 
              placeholder="Correo o Nombre de usuario" 
              value={formData.identificador}
              onChange={(e) => setFormData({ ...formData, identificador: e.target.value })}
              required
              style={{ padding: '0.9rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box', width: '100%' }}
            />
          )}

          {/* Formulario normal de Login / Registro (type="email") */}
          {(modo === 'LOGIN' || modo === 'REGISTRO') && (
            <input 
              type="email" 
              placeholder="Correo electrónico" 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              style={{ padding: '0.9rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box', width: '100%' }}
            />
          )}
          
          {(modo === 'LOGIN' || modo === 'REGISTRO' || modo === 'RESTABLECER') && (
            <input 
              type="password" 
              placeholder={modo === 'RESTABLECER' ? "Nueva Contraseña" : "Contraseña"}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              style={{ padding: '0.9rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          )}

          {modo === 'RESTABLECER' && (
            <input 
              type="password" 
              placeholder="Confirmar Nueva Contraseña" 
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required 
              style={{ padding: '0.9rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          )}
          
          <button type="submit" disabled={loading} style={{ padding: '1rem', background: '#ff4500', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: 'background 0.2s', width: '100%' }}>
             {loading ? 'Cargando...' : 
             modo === 'LOGIN' ? 'Entrar' : 
             modo === 'REGISTRO' ? 'Registrarme' : 
             modo === 'RECORDAR' ? 'Enviar enlace de recuperación' : 'Guardar nueva contraseña'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {modo === 'LOGIN' && (
            <>
              <button onClick={() => setModo('RECORDAR')} style={{ color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.95rem' }}>¿Has olvidado tu contraseña?</button>
              <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
                <span style={{ padding: '0 10px', color: '#888', fontSize: '14px' }}>O continúa con</span>
                <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => { console.error('El login con Google falló'); }} useOneTap shape="rectangular" theme="outline" text="signin_with" />
              </div>
              <span style={{ fontSize: '0.95rem', color: '#666', marginTop: '0.5rem' }}>¿No tienes cuenta? <button onClick={() => setModo('REGISTRO')} style={{ color: '#ff4500', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Regístrate aquí</button></span>
            </>
          )}
          
          {modo === 'REGISTRO' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
                <span style={{ padding: '0 10px', color: '#888', fontSize: '14px' }}>O regístrate con</span>
                <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => { console.error('El registro con Google falló'); }} useOneTap shape="rectangular" theme="outline" text="signup_with" />
              </div>
              <span style={{ fontSize: '0.95rem', color: '#666', marginTop: '0.5rem' }}>¿Ya tienes cuenta? <button onClick={() => setModo('LOGIN')} style={{ color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Inicia sesión</button></span>
            </>
          )}

          {modo === 'RECORDAR' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 10px 0' }}>
                ¿Tienes problemas para entrar? <button onClick={() => setModo('LOGIN')} style={{ color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Inicia sesión con Google</button>
              </p>
              <button onClick={() => setModo('LOGIN')} style={{ color: '#333', background: '#eee', padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', width: 'fit-content', margin: '0 auto' }}>Volver al Login</button>
            </>
          )}

          {modo === 'RESTABLECER' && (
             <button onClick={() => {
                window.history.replaceState({}, document.title, "/"); 
                setModo('LOGIN');
             }} style={{ color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.95rem' }}>Cancelar y volver</button>
          )}
        </div>

      </div>
    </GoogleOAuthProvider>
  );
}