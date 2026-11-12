'use client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'

export default function RemoveMemberDialog({
  email,
  action,
  pending,
  message,
  onOpenChange,
  onCloseAutoFocus,
}: {
  email: string
  action: (data: FormData) => void
  pending: boolean
  message: string
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus: () => void
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>Quitar miembro</DialogTitle>
        <DialogDescription>
          Se quitará el acceso de {email} a esta organización.
        </DialogDescription>
        <form action={action}>
          <input type="hidden" name="intent" value="remove" />
          <Button type="submit" disabled={pending}>
            Confirmar baja
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
        </form>
        {message && <p role="alert">{message}</p>}
      </DialogContent>
    </Dialog>
  )
}
