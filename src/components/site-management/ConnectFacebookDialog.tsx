
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
// No se importa Link de next/link

interface ConnectFacebookDialogProps {
  site: WordPressSite;
  children: React.ReactNode;
  onFacebookPageConnected?: () => void; 
}

export function ConnectFacebookDialog({ site, children, onFacebookPageConnected }: ConnectFacebookDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleConnectClick = () => {
    toast({ title: "Redirigiendo a Facebook...", description: "Por favor, autoriza la aplicación en Facebook." });
    // La navegación real será manejada por la etiqueta <a>.
    // Es posible que no necesitemos cerrar el diálogo aquí, ya que la página navegará.
    // setIsOpen(false); 
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
          {/* 
            Usando una etiqueta <a> estándar para el botón "Continuar a Facebook".
            Esto asegura una navegación completa del navegador a la ruta API,
            que luego realiza una redirección del lado del servidor a Facebook.
            Esto evita problemas de CORS que pueden ocurrir si Next.js <Link>
            intenta obtener el contenido de la ruta API directamente.
            Se aplican clases de Tailwind para que se vea como un botón.
          */}
          <a 
            href={`/api/auth/facebook/connect?siteId=${site.id}`}
            onClick={handleConnectClick}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            // No es necesario asChild aquí porque <a> es el elemento final.
          >
            Continuar a Facebook
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

