import Link from 'next/link'
export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">
        Necesitas acceso a esta organización
      </h1>
      <p className="mt-4">
        No tienes una membresía o el rol necesario. Pide a un propietario o
        administrador una invitación con los permisos adecuados.
      </p>
      <Link className="mt-4 inline-block underline" href="/">
        Volver a mis organizaciones
      </Link>
    </>
  )
}
