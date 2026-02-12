import React from 'react';
import './ErrorBoundary.css';

/**
 * Error Boundary Component
 * Captura errores en el árbol de componentes de React y muestra UI de fallback
 * Previene que la aplicación completa se rompa por un error en un componente
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Actualizar estado para mostrar UI de fallback
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log del error para debugging
    console.error('🔴 Error capturado por ErrorBoundary:', error, errorInfo);

    // Incrementar contador de errores
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Opcionalmente enviar a servicio de logging (Sentry, LogRocket, etc.)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // TODO: Integrar con servicio de logging en producción
    // Ejemplo: Sentry.captureException(error, { extra: errorInfo });

    // Por ahora solo guardar en localStorage para debugging
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        error: {
          message: error.toString(),
          stack: error.stack
        },
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingLogs.push(errorLog);

      // Mantener solo los últimos 10 errores
      const recentLogs = existingLogs.slice(-10);
      localStorage.setItem('error_logs', JSON.stringify(recentLogs));
    } catch (e) {
      console.error('Error al guardar log:', e);
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="error-boundary">
          <div className="error-boundary-container">
            <div className="error-boundary-icon">⚠️</div>

            <h1 className="error-boundary-title">
              Algo salió mal
            </h1>

            <p className="error-boundary-message">
              Lo sentimos, ha ocurrido un error inesperado.
              Intenta recargar la página o volver al inicio.
            </p>

            <div className="error-boundary-actions">
              <button
                className="btn btn-primary"
                onClick={this.handleReset}
              >
                Intentar de nuevo
              </button>
              <button
                className="btn btn-secondary"
                onClick={this.handleReload}
              >
                Recargar página
              </button>
              <button
                className="btn btn-secondary"
                onClick={this.handleGoHome}
              >
                Ir al inicio
              </button>
            </div>

            {isDevelopment && this.state.error && (
              <details className="error-boundary-details">
                <summary>Detalles del error (solo en desarrollo)</summary>
                <div className="error-boundary-stack">
                  <h3>Error:</h3>
                  <pre>{this.state.error.toString()}</pre>

                  <h3>Stack trace:</h3>
                  <pre>{this.state.error.stack}</pre>

                  {this.state.errorInfo && (
                    <>
                      <h3>Component stack:</h3>
                      <pre>{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}

            {this.state.errorCount > 2 && (
              <div className="error-boundary-warning">
                ⚠️ Múltiples errores detectados ({this.state.errorCount}).
                Considera contactar al soporte técnico.
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
