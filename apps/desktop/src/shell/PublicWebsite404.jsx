import { Link } from 'react-router-dom'

export function PublicWebsite404() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="text-8xl font-bold text-gray-100 select-none">404</p>
        <h1 className="text-2xl font-semibold text-gray-900">Pagina no encontrada</h1>
        <p className="text-gray-500 text-sm">
          La pagina que buscas no existe o no ha sido publicada todavia.
        </p>
        <Link
          to="/"
          className="inline-block mt-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
