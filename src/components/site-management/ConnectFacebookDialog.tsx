
'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import type { WordPressSite } from "@/lib/types";
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface ConnectFacebookDialogProps {
  site: WordPressSite;
  children: React.ReactNode;
  onFacebookPageConnected?: () => void; // Callback para refrescar UI si es necesario
}

export function ConnectFacebookDialog({ site, children, onFacebookPageConnected }: ConnectFacebookDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // El manejo del éxito/error ahora ocurriría después del flujo de redirección de OAuth
  // y la actualización del estado se haría en la página principal o a través de `onFacebookPageConnected`.

  const handleConnectClick = () => {
    // Aquí, en una implementación completa, podrías querer hacer alguna preparación
    // o validación antes de redirigir.
    // Por ahora, el Link se encarga de la navegación.
    // Cerramos el diálogo ya que el usuario será redirigido.
    // Idealmente, el estado de carga o de "conectando" se manejaría de forma más robusta.
    toast({ title: "Redirigiendo a Facebook...", description: "Por favor, autoriza la aplicación en Facebook." });
    // No cerramos el diálogo inmediatamente para que el toast sea visible.
    // El cierre ocurrirá por la navegación o el usuario podría cerrarlo.
    // setIsOpen(false); // Comentado para que el toast se vea brevemente
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Conectar Página de Facebook</DialogTitle>
          <DialogDescription>
            Para conectar tu sitio "{site.name}" a una Página de Facebook, serás redirigido a Facebook para autorizar a Social Streamer.
            Una vez autorizado, podrás seleccionar la página a la que quieres publicar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          {/* El Link inicia el flujo OAuth. Pasa el siteId para saber a qué sitio asociar la conexión. */}
          <Button asChild onClick={handleConnectClick}>
            <Link href={`/api/auth/facebook/connect?siteId=${site.id}`}>
              Continuar a Facebook
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
